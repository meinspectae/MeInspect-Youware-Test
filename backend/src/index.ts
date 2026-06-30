import { Hono } from "hono";
import type { Client } from "@sdk/server-types";
import { tables, buckets } from "@generated";
import { eq, and } from "drizzle-orm";

const PROVIDER = 'stripe';

function getEnv(): "staging" | "production" {
  return "staging";
}

function tryParse(json: string | null | undefined): any {
  if (!json) return {};
  try { return JSON.parse(json); } catch { return {}; }
}

export async function createApp(edgespark: Client<typeof tables>): Promise<Hono> {
  const app = new Hono();

  // Global error handler
  app.onError((err, c) => {
    console.error("[API] error:", err);
    return c.json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  });

  // ==================== CUSTOM AUTH ENDPOINTS ====================

  // Sign up (public - no auth required)
  app.post('/api/public/auth/signup', async (c) => {
    const { email, password, name, phone, location } = await c.req.json();
    if (!email || !password || !name) {
      return c.json({ error: 'Email, password, and name are required' }, 400);
    }

    // Check if user already exists
    const existing = await edgespark.db.select().from(tables.users).where(eq(tables.users.email, email));
    if (existing.length > 0) {
      return c.json({ error: 'An account with this email already exists' }, 409);
    }

    // Hash password using Web Crypto API (PBKDF2)
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const hash = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial, 256
    );
    const hashArray = Array.from(new Uint8Array(hash));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const passwordHash = `${saltHex}:${hashHex}`;

    // Create user in our users table
    await edgespark.db.insert(tables.users).values({
      id: email,
      email,
      name,
      phone: phone || '',
      location: location || '',
      passwordHash,
    });

    // Generate session token
    const token = await createToken(email);

    return c.json({
      success: true,
      user: { id: email, email, name },
      token,
    });
  });

  // Sign in (public - no auth required)
  app.post('/api/public/auth/login', async (c) => {
    const { email, password } = await c.req.json();
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // Find user
    const users = await edgespark.db.select().from(tables.users).where(eq(tables.users.email, email));
    if (users.length === 0) {
      return c.json({ error: 'No account found with this email' }, 401);
    }

    const user = users[0];

    // Verify password
    if (!user.passwordHash) {
      return c.json({ error: 'Account has no password set' }, 401);
    }

    const [saltHex, hashHex] = user.passwordHash.split(':');
    const encoder = new TextEncoder();
    const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const hash = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial, 256
    );
    const hashArray = Array.from(new Uint8Array(hash));
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (computedHash !== hashHex) {
      return c.json({ error: 'Incorrect password' }, 401);
    }

    // Generate session token
    const token = await createToken(email);

    return c.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  });

  // Get current user (public - checks token from header)
  app.get('/api/public/auth/me', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const token = authHeader.slice(7);
    const email = await verifyToken(token);
    if (!email) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const users = await edgespark.db.select().from(tables.users).where(eq(tables.users.email, email));
    if (users.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }

    const user = users[0];
    return c.json({
      user: { id: user.id, email: user.email, name: user.name },
    });
  });

  // ==================== TOKEN HELPERS ====================

  async function createToken(email: string): Promise<string> {
    const encoder = new TextEncoder();
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      sub: email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 * 7,
    }));
    const data = `${header}.${payload}`;
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode('meinspect-secret-key-2024'),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${data}.${sigHex}`;
  }

  async function verifyToken(token: string): Promise<string | null> {
    try {
      const [header, payload, sigHex] = token.split('.');
      if (!header || !payload || !sigHex) return null;
      const encoder = new TextEncoder();
      const data = `${header}.${payload}`;
      const key = await crypto.subtle.importKey(
        'raw', encoder.encode('meinspect-secret-key-2024'),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
      );
      const sigBytes = new Uint8Array(sigHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
      const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data));
      if (!valid) return null;
      const payloadData = JSON.parse(atob(payload));
      if (payloadData.exp < Math.floor(Date.now() / 1000)) return null;
      return payloadData.sub;
    } catch {
      return null;
    }
  }

  // ==================== USER PROFILE ENDPOINTS ====================

  // Save/update user profile (phone, location) - called after signup
  app.post('/api/public/user/profile', async (c) => {
    const { email, phone, location } = await c.req.json();
    if (!email) return c.json({ error: 'email required' }, 400);

    const existing = await edgespark.db.select().from(tables.users)
      .where(eq(tables.users.email, email));

    if (existing.length > 0) {
      await edgespark.db.update(tables.users).set({
        phone: phone || existing[0].phone,
        location: location || existing[0].location,
        updatedAt: new Date().toISOString(),
      }).where(eq(tables.users.email, email));
    } else {
      await edgespark.db.insert(tables.users).values({
        id: email,
        email,
        name: '',
        phone: phone || '',
        location: location || '',
      });
    }
    return c.json({ success: true });
  });

  // Get user profile
  app.get('/api/public/user/profile/:email', async (c) => {
    const email = c.req.param('email');
    const result = await edgespark.db.select().from(tables.users)
      .where(eq(tables.users.email, email));
    if (result.length === 0) return c.json({ data: null });
    return c.json({ data: result[0] });
  });

  // ==================== INSPECTION ENDPOINTS ====================
  // /api/* routes auto-enforce authentication via Youbase

  // List inspections for authenticated user
  app.get('/api/inspections', async (c) => {
    const userId = edgespark.auth.user!.id;
    const inspections = await edgespark.db.select().from(tables.inspections)
      .where(eq(tables.inspections.userId, userId));
    return c.json({ data: inspections });
  });

  // Get single inspection
  app.get('/api/inspections/:id', async (c) => {
    const id = c.req.param('id');
    const result = await edgespark.db.select().from(tables.inspections)
      .where(eq(tables.inspections.id, id));
    if (result.length === 0) return c.json({ error: 'Not found' }, 404);
    return c.json({ data: result[0] });
  });

  // Create inspection
  app.post('/api/inspections', async (c) => {
    const data = await c.req.json();
    const userId = edgespark.auth.user!.id;

    const inspection = await edgespark.db.insert(tables.inspections).values({
      id: data.id,
      userId,
      propertyType: data.propertyType || 'apartment',
      status: data.status || 'draft',
      generalNotes: data.generalNotes || '',
      propertyData: JSON.stringify(data.property || {}),
      tenantData: JSON.stringify(data.tenant || {}),
      landlordData: JSON.stringify(data.landlord || {}),
      agentData: JSON.stringify(data.agent || {}),
      tenancyData: JSON.stringify(data.tenancy || {}),
      roomsData: JSON.stringify(data.rooms || []),
      propertyItems: JSON.stringify(data.propertyItems || []),
      signatures: JSON.stringify(data.signatures || []),
      overallPhotos: JSON.stringify(data.overallPhotos || []),
      paymentData: JSON.stringify(data.payment || {}),
      reportGenerated: data.reportGenerated ? 1 : 0,
      pdfUrl: data.pdfUrl || '',
    }).returning();

    return c.json({ data: inspection[0] }, 201);
  });

  // Update inspection
  app.put('/api/inspections/:id', async (c) => {
    const id = c.req.param('id');
    const data = await c.req.json();

    // First check if the inspection exists
    const existing = await edgespark.db.select().from(tables.inspections)
      .where(eq(tables.inspections.id, id));
    if (existing.length === 0) {
      return c.json({ error: 'Inspection not found' }, 404);
    }

    const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (data.status !== undefined) updateData.status = data.status;
    if (data.generalNotes !== undefined) updateData.generalNotes = data.generalNotes;
    if (data.property !== undefined) updateData.propertyData = JSON.stringify(data.property);
    if (data.tenant !== undefined) updateData.tenantData = JSON.stringify(data.tenant);
    if (data.landlord !== undefined) updateData.landlordData = JSON.stringify(data.landlord);
    if (data.agent !== undefined) updateData.agentData = JSON.stringify(data.agent);
    if (data.tenancy !== undefined) updateData.tenancyData = JSON.stringify(data.tenancy);
    if (data.rooms !== undefined) updateData.roomsData = JSON.stringify(data.rooms);
    if (data.propertyItems !== undefined) updateData.propertyItems = JSON.stringify(data.propertyItems);
    if (data.signatures !== undefined) updateData.signatures = JSON.stringify(data.signatures);
    if (data.overallPhotos !== undefined) updateData.overallPhotos = JSON.stringify(data.overallPhotos);
    if (data.payment !== undefined) updateData.paymentData = JSON.stringify(data.payment);
    if (data.reportGenerated !== undefined) updateData.reportGenerated = data.reportGenerated ? 1 : 0;
    if (data.completedAt !== undefined) updateData.completedAt = data.completedAt;
    if (data.pdfUrl !== undefined) updateData.pdfUrl = data.pdfUrl;

    await edgespark.db.update(tables.inspections).set(updateData).where(eq(tables.inspections.id, id));
    return c.json({ success: true });
  });

  // Delete inspection
  app.delete('/api/inspections/:id', async (c) => {
    const id = c.req.param('id');
    await edgespark.db.delete(tables.inspections).where(eq(tables.inspections.id, id));
    return c.json({ success: true });
  });

  // ==================== EMAIL ENDPOINTS ====================
  // Public endpoint - no auth required for sending emails

  // Send inspection report email via Resend API
  app.post('/api/public/send-email', async (c) => {
    const { to, subject, html, from } = await c.req.json();
    if (!to || !subject || !html) {
      return c.json({ error: 'to, subject, and html are required' }, 400);
    }

    const apiKey = edgespark.secret.get('RESEND_API_KEY');
    if (!apiKey) {
      return c.json({ error: 'Email service not configured (RESEND_API_KEY missing)' }, 500);
    }

    const fromAddress = from || 'MeInspect <onboarding@resend.dev>';
    const recipients = Array.isArray(to) ? to : [to];

    try {
      const results: { email: string; success: boolean; id?: string; error?: string }[] = [];

      for (const recipient of recipients) {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: fromAddress,
              to: [recipient],
              subject,
              html,
            }),
          });

          const data = await res.json() as any;
          if (res.ok) {
            results.push({ email: recipient, success: true, id: data.id });
          } else {
            results.push({ email: recipient, success: false, error: data.message || 'Send failed' });
          }
        } catch (err) {
          results.push({
            email: recipient,
            success: false,
            error: err instanceof Error ? err.message : 'Network error',
          });
        }
      }

      const allSuccess = results.every(r => r.success);
      return c.json({
        success: allSuccess,
        results,
        sentCount: results.filter(r => r.success).length,
        failedCount: results.filter(r => !r.success).length,
      });
    } catch (err) {
      return c.json({
        error: err instanceof Error ? err.message : 'Email sending failed',
      }, 500);
    }
  });

  // ==================== INSPECTION HISTORY SYNC ====================

  // Sync all inspection data from backend (full sync)
  app.get('/api/sync/inspections', async (c) => {
    const userId = edgespark.auth.user!.id;

    const inspections = await edgespark.db.select().from(tables.inspections)
      .where(eq(tables.inspections.userId, userId));

    // Parse JSON fields back to objects
    const parsed = inspections.map((row: any) => ({
      id: row.id,
      userId: row.userId,
      propertyType: row.propertyType,
      status: row.status,
      generalNotes: row.generalNotes,
      reportGenerated: row.reportGenerated,
      pdfUrl: row.pdfUrl || '',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt,
      property: tryParse(row.propertyData),
      tenant: tryParse(row.tenantData),
      landlord: tryParse(row.landlordData),
      agent: tryParse(row.agentData),
      tenancy: tryParse(row.tenancyData),
      rooms: tryParse(row.roomsData),
      propertyItems: tryParse(row.propertyItems),
      signatures: tryParse(row.signatures),
      overallPhotos: tryParse(row.overallPhotos),
      payment: tryParse(row.paymentData),
    }));

    return c.json({ data: parsed, count: parsed.length });
  });

  // Batch sync: upload multiple inspections from frontend
  app.post('/api/sync/push', async (c) => {
    const userId = edgespark.auth.user!.id;
    const { inspections: items } = await c.req.json();
    if (!Array.isArray(items)) return c.json({ error: 'inspections array required' }, 400);

    let created = 0;
    let updated = 0;

    for (const inspection of items) {
      try {
        // Try update first
        const existing = await edgespark.db.select().from(tables.inspections)
          .where(eq(tables.inspections.id, inspection.id));

        const updateData: Record<string, any> = {
          status: inspection.status,
          generalNotes: inspection.generalNotes || '',
          propertyType: inspection.propertyType || 'apartment',
          propertyData: JSON.stringify(inspection.property || {}),
          tenantData: JSON.stringify(inspection.tenant || {}),
          landlordData: JSON.stringify(inspection.landlord || {}),
          agentData: JSON.stringify(inspection.agent || {}),
          tenancyData: JSON.stringify(inspection.tenancy || {}),
          roomsData: JSON.stringify(inspection.rooms || []),
          propertyItems: JSON.stringify(inspection.propertyItems || []),
          signatures: JSON.stringify(inspection.signatures || []),
          overallPhotos: JSON.stringify(inspection.overallPhotos || []),
          paymentData: JSON.stringify(inspection.payment || {}),
          reportGenerated: inspection.reportGenerated ? 1 : 0,
          pdfUrl: inspection.pdfUrl || '',
          updatedAt: new Date().toISOString(),
        };
        if (inspection.completedAt) updateData.completedAt = inspection.completedAt;

        if (existing.length > 0) {
          await edgespark.db.update(tables.inspections)
            .set(updateData)
            .where(eq(tables.inspections.id, inspection.id));
          updated++;
        } else {
          await edgespark.db.insert(tables.inspections).values({
            id: inspection.id,
            userId,
            ...updateData,
            createdAt: inspection.createdAt || new Date().toISOString(),
          });
          created++;
        }
      } catch (err) {
        console.warn(`Failed to sync inspection ${inspection.id}:`, err);
      }
    }

    return c.json({ success: true, created, updated });
  });

  // ==================== STORAGE ENDPOINTS (PDF & Photos) ====================

  // Get presigned upload URL for PDF report
  app.post('/api/upload/pdf', async (c) => {
    const { inspectionId } = await c.req.json();
    if (!inspectionId) return c.json({ error: 'inspectionId required' }, 400);

    const userId = edgespark.auth.user!.id;
    const path = `reports/${userId}/${inspectionId}.pdf`;

    const { uploadUrl, expiresAt } = await edgespark.storage
      .from(buckets.meinspect_reports)
      .createPresignedPutUrl(path, 3600);

    // Update the inspection record with the pdf URL path
    await edgespark.db.update(tables.inspections)
      .set({ pdfUrl: path, updatedAt: new Date().toISOString() })
      .where(eq(tables.inspections.id, inspectionId));

    return c.json({ uploadUrl, path, expiresAt });
  });

  // Get presigned download URL for PDF report
  app.get('/api/download/pdf/:inspectionId', async (c) => {
    const inspectionId = c.req.param('inspectionId');

    // Verify the inspection exists and belongs to the user
    const inspection = await edgespark.db.select().from(tables.inspections)
      .where(eq(tables.inspections.id, inspectionId));
    if (inspection.length === 0) return c.json({ error: 'Not found' }, 404);

    const path = inspection[0].pdfUrl;
    if (!path) return c.json({ error: 'PDF not available for this inspection' }, 404);

    const { downloadUrl, expiresAt } = await edgespark.storage
      .from(buckets.meinspect_reports)
      .createPresignedGetUrl(path, 3600);

    return c.json({ downloadUrl, expiresAt });
  });

  // Get presigned upload URL for a photo
  app.post('/api/upload/photo', async (c) => {
    const { inspectionId, photoId, contentType } = await c.req.json();
    if (!inspectionId || !photoId) return c.json({ error: 'inspectionId and photoId required' }, 400);

    const userId = edgespark.auth.user!.id;
    const ext = (contentType || 'image/jpeg').includes('png') ? 'png' : 'jpg';
    const path = `photos/${userId}/${inspectionId}/${photoId}.${ext}`;

    const { uploadUrl, expiresAt } = await edgespark.storage
      .from(buckets.meinspect_reports)
      .createPresignedPutUrl(path, 3600);

    return c.json({ uploadUrl, path, expiresAt });
  });

  // Get presigned download URL for a photo
  app.get('/api/download/photo', async (c) => {
    const path = c.req.query('path');
    if (!path) return c.json({ error: 'path query param required' }, 400);

    const { downloadUrl, expiresAt } = await edgespark.storage
      .from(buckets.meinspect_reports)
      .createPresignedGetUrl(path, 3600);

    return c.json({ downloadUrl, expiresAt });
  });

  // Batch get presigned download URLs for multiple photos
  app.post('/api/download/photos', async (c) => {
    const { paths } = await c.req.json();
    if (!Array.isArray(paths)) return c.json({ error: 'paths array required' }, 400);

    const urls = await Promise.all(
      paths.map(async (path: string) => {
        try {
          const { downloadUrl, expiresAt } = await edgespark.storage
            .from(buckets.meinspect_reports)
            .createPresignedGetUrl(path, 3600);
          return { path, downloadUrl, expiresAt, ok: true };
        } catch {
          return { path, ok: false };
        }
      })
    );

    return c.json({ urls });
  });

  // ==================== PAYMENT ENDPOINTS (DUMMY MODE) ====================

  // Create checkout session (dummy mode - simulates Stripe)
  // Public endpoint for demo mode
  app.post('/api/public/checkout', async (c) => {
    const { amount, currency = 'AED', userId = 'guest', inspectionId, discountCode, discountAmount } = await c.req.json();

    const sessionId = `cs_test_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Record the order
    const order = await edgespark.db.insert(tables.orders).values({
      environment: getEnv(),
      userId,
      inspectionId: inspectionId || null,
      amount: amount || 500,
      currency,
      status: 'pending',
      type: 'one_time',
      provider: 'dummy',
      providerSessionId: sessionId,
      discountCode: discountCode || null,
      discountAmount: discountAmount || 0,
    }).returning();

    // In dummy mode, immediately mark as paid
    await edgespark.db.update(tables.orders)
      .set({ status: 'paid', paidAt: Math.floor(Date.now() / 1000) })
      .where(eq(tables.orders.id, order[0].id));

    return c.json({
      success: true,
      sessionId,
      orderId: order[0].id,
      status: 'paid',
      message: 'Dummy payment processed successfully',
    });
  });

  // Verify payment status (public for demo)
  app.get('/api/public/checkout/:sessionId', async (c) => {
    const sessionId = c.req.param('sessionId');
    const result = await edgespark.db.select().from(tables.orders)
      .where(eq(tables.orders.providerSessionId, sessionId));
    if (result.length === 0) return c.json({ error: 'Session not found' }, 404);
    return c.json({ data: result[0] });
  });

  // Get user's payment history
  app.get('/api/orders', async (c) => {
    const userId = edgespark.auth.user!.id;
    const orders = await edgespark.db.select().from(tables.orders)
      .where(eq(tables.orders.userId, userId));
    return c.json({ data: orders });
  });

  // ==================== ADMIN ENDPOINTS ====================

  // Create payment price (for future Stripe integration)
  app.post('/api/admin/prices', async (c) => {
    const { name, amount, currency = 'AED', type = 'one_time' } = await c.req.json();
    const env = getEnv();

    const row = await edgespark.db.insert(tables.paymentPrices).values({
      environment: env,
      name,
      amount,
      currency,
      type,
      provider: PROVIDER,
    }).returning();

    return c.json({ data: row[0] }, 201);
  });

  // List payment prices
  app.get('/api/admin/prices', async (c) => {
    const env = getEnv();
    const prices = await edgespark.db.select().from(tables.paymentPrices)
      .where(eq(tables.paymentPrices.environment, env));
    return c.json({ data: prices });
  });

  return app;
}
