import { Hono } from "hono";
import type { Client } from "@sdk/server-types";
import { tables, buckets } from "@generated";
import { eq, and } from "drizzle-orm";

function getEnv(): "staging" | "production" {
  return "staging";
}

function tryParse(json: string | null | undefined): any {
  if (!json) return {};
  try { return JSON.parse(json); } catch { return {}; }
}

/**
 * Verify that the authenticated user owns the given inspection.
 * Returns the inspection row if authorized, or sends an error response and returns null.
 */
async function requireOwnership(
  edgespark: Client<typeof tables>,
  userId: string,
  inspectionId: string
): Promise<any | null> {
  const rows = await edgespark.db
    .select()
    .from(tables.inspections)
    .where(
      and(
        eq(tables.inspections.id, inspectionId),
        eq(tables.inspections.userId, userId)
      )
    );
  if (rows.length === 0) return null;
  return rows[0];
}

export async function createApp(edgespark: Client<typeof tables>): Promise<Hono> {
  const app = new Hono();

  // Global error handler
  app.onError((err, c) => {
    console.error("[API] error:", err);
    return c.json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  });

  // ==================== USER PROFILE ENDPOINTS ====================
  // Authenticated endpoints — use edgespark.auth.user for identity

  // Save/update user profile (phone, location) — authenticated
  app.post('/api/user/profile', async (c) => {
    const userId = edgespark.auth.user!.id;
    const { phone, location } = await c.req.json();

    const existing = await edgespark.db.select().from(tables.users)
      .where(eq(tables.users.email, userId));

    if (existing.length > 0) {
      await edgespark.db.update(tables.users).set({
        phone: phone !== undefined ? phone : existing[0].phone,
        location: location !== undefined ? location : existing[0].location,
        updatedAt: new Date().toISOString(),
      }).where(eq(tables.users.email, userId));
    } else {
      // Create user record if it doesn't exist yet
      await edgespark.db.insert(tables.users).values({
        id: userId,
        email: userId,
        name: '',
        phone: phone || '',
        location: location || '',
      });
    }
    return c.json({ success: true });
  });

  // Get own user profile — authenticated
  app.get('/api/user/profile', async (c) => {
    const userId = edgespark.auth.user!.id;
    const result = await edgespark.db.select().from(tables.users)
      .where(eq(tables.users.email, userId));
    if (result.length === 0) return c.json({ data: null });
    return c.json({ data: result[0] });
  });

  // ==================== INSPECTION ENDPOINTS ====================
  // All /api/* routes enforce authentication via Youbase.
  // Additional ownership checks prevent IDOR.

  // List inspections for authenticated user
  app.get('/api/inspections', async (c) => {
    const userId = edgespark.auth.user!.id;
    const inspections = await edgespark.db.select().from(tables.inspections)
      .where(eq(tables.inspections.userId, userId));
    return c.json({ data: inspections });
  });

  // Get single inspection — ownership check
  app.get('/api/inspections/:id', async (c) => {
    const userId = edgespark.auth.user!.id;
    const id = c.req.param('id');
    const row = await requireOwnership(edgespark, userId, id);
    if (!row) return c.json({ error: 'Not found' }, 404);
    return c.json({ data: row });
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

  // Update inspection — ownership check
  app.put('/api/inspections/:id', async (c) => {
    const userId = edgespark.auth.user!.id;
    const id = c.req.param('id');
    const data = await c.req.json();

    // Ownership check
    const existing = await requireOwnership(edgespark, userId, id);
    if (!existing) return c.json({ error: 'Inspection not found' }, 404);

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

    await edgespark.db.update(tables.inspections).set(updateData)
      .where(eq(tables.inspections.id, id));
    return c.json({ success: true });
  });

  // Delete inspection — ownership check
  app.delete('/api/inspections/:id', async (c) => {
    const userId = edgespark.auth.user!.id;
    const id = c.req.param('id');

    // Ownership check
    const existing = await requireOwnership(edgespark, userId, id);
    if (!existing) return c.json({ error: 'Inspection not found' }, 404);

    await edgespark.db.delete(tables.inspections).where(
      and(
        eq(tables.inspections.id, id),
        eq(tables.inspections.userId, userId)
      )
    );
    return c.json({ success: true });
  });

  // ==================== EMAIL ENDPOINTS ====================

  // Send inspection report email via Resend API
  app.post('/api/send-email', async (c) => {
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
        // Check if inspection belongs to this user
        const existing = await edgespark.db.select().from(tables.inspections)
          .where(
            and(
              eq(tables.inspections.id, inspection.id),
              eq(tables.inspections.userId, userId)
            )
          );

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

  // Get presigned upload URL for PDF report — ownership check
  app.post('/api/upload/pdf', async (c) => {
    const { inspectionId } = await c.req.json();
    if (!inspectionId) return c.json({ error: 'inspectionId required' }, 400);

    const userId = edgespark.auth.user!.id;
    const row = await requireOwnership(edgespark, userId, inspectionId);
    if (!row) return c.json({ error: 'Inspection not found' }, 404);

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

  // Get presigned download URL for PDF report — ownership check
  app.get('/api/download/pdf/:inspectionId', async (c) => {
    const userId = edgespark.auth.user!.id;
    const inspectionId = c.req.param('inspectionId');

    const row = await requireOwnership(edgespark, userId, inspectionId);
    if (!row) return c.json({ error: 'Not found' }, 404);

    const path = (row as any).pdfUrl;
    if (!path) return c.json({ error: 'PDF not available for this inspection' }, 404);

    const { downloadUrl, expiresAt } = await edgespark.storage
      .from(buckets.meinspect_reports)
      .createPresignedGetUrl(path, 3600);

    return c.json({ downloadUrl, expiresAt });
  });

  // Get presigned upload URL for a photo — ownership check
  app.post('/api/upload/photo', async (c) => {
    const { inspectionId, photoId, contentType } = await c.req.json();
    if (!inspectionId || !photoId) return c.json({ error: 'inspectionId and photoId required' }, 400);

    const userId = edgespark.auth.user!.id;
    const row = await requireOwnership(edgespark, userId, inspectionId);
    if (!row) return c.json({ error: 'Inspection not found' }, 404);

    const ext = (contentType || 'image/jpeg').includes('png') ? 'png' : 'jpg';
    const path = `photos/${userId}/${inspectionId}/${photoId}.${ext}`;

    const { uploadUrl, expiresAt } = await edgespark.storage
      .from(buckets.meinspect_reports)
      .createPresignedPutUrl(path, 3600);

    return c.json({ uploadUrl, path, expiresAt });
  });

  // Get presigned download URL for a photo — ownership check via path prefix
  app.get('/api/download/photo', async (c) => {
    const userId = edgespark.auth.user!.id;
    const path = c.req.query('path');
    if (!path) return c.json({ error: 'path query param required' }, 400);

    // Verify the path belongs to this user
    if (!path.startsWith(`photos/${userId}/`) && !path.startsWith(`reports/${userId}/`)) {
      return c.json({ error: 'Access denied' }, 403);
    }

    const { downloadUrl, expiresAt } = await edgespark.storage
      .from(buckets.meinspect_reports)
      .createPresignedGetUrl(path, 3600);

    return c.json({ downloadUrl, expiresAt });
  });

  // Batch get presigned download URLs for multiple photos — ownership check
  app.post('/api/download/photos', async (c) => {
    const userId = edgespark.auth.user!.id;
    const { paths } = await c.req.json();
    if (!Array.isArray(paths)) return c.json({ error: 'paths array required' }, 400);

    const urls = await Promise.all(
      paths.map(async (path: string) => {
        try {
          // Verify each path belongs to this user
          if (!path.startsWith(`photos/${userId}/`) && !path.startsWith(`reports/${userId}/`)) {
            return { path, ok: false, error: 'Access denied' };
          }
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

  // ==================== PAYMENT ENDPOINTS ====================

  // Create checkout session (dummy mode - simulates Stripe)
  app.post('/api/checkout', async (c) => {
    const userId = edgespark.auth.user!.id;
    const { amount, currency = 'AED', inspectionId, discountCode, discountAmount } = await c.req.json();

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

  // Verify payment status — ownership check
  app.get('/api/checkout/:sessionId', async (c) => {
    const userId = edgespark.auth.user!.id;
    const sessionId = c.req.param('sessionId');
    const result = await edgespark.db.select().from(tables.orders)
      .where(
        and(
          eq(tables.orders.providerSessionId, sessionId),
          eq(tables.orders.userId, userId)
        )
      );
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
      provider: 'stripe',
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
