import { Photo } from '../types';
import { generateId } from '../data/propertyTemplates';

export async function capturePhoto(): Promise<Photo | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      try {
        const compressed = await compressImage(file, 1200, 0.8);
        const dataUrl = await blobToDataUrl(compressed);

        let lat: number | undefined;
        let lng: number | undefined;

        if ('geolocation' in navigator) {
          try {
            const pos = await new Promise<GeolocationPosition>((res, rej) => {
              navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000, enableHighAccuracy: true });
            });
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
          } catch {
            // Geolocation not available
          }
        }

        resolve({
          id: generateId(),
          url: dataUrl,
          timestamp: new Date().toISOString(),
          gpsLat: lat,
          gpsLng: lng,
        });
      } catch {
        resolve(null);
      }
    };

    input.oncancel = () => resolve(null);
    input.click();
  });
}

function compressImage(file: File, maxWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to compress'));
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function getLocation(): Promise<{ latitude: number; longitude: number; address?: string } | null> {
  if (!('geolocation' in navigator)) return null;

  try {
    const pos = await new Promise<GeolocationPosition>((res, rej) => {
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000, enableHighAccuracy: true });
    });

    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    };
  } catch {
    return null;
  }
}

export async function getIPAddress(): Promise<string | undefined> {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    if (res.ok) {
      const data = await res.json();
      return data.ip;
    }
  } catch {
    // Fallback: try alternate API
    try {
      const res = await fetch('https://api.ip.sb/jsonip');
      if (res.ok) {
        const data = await res.json();
        return data.ip;
      }
    } catch {
      // Give up
    }
  }
  return undefined;
}

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Generate a SHA-256 hash of report data for tamper detection.
 * Returns a truncated hex string suitable for display.
 */
export async function generateReportHash(inspection: {
  id: string;
  createdAt: string;
  completedAt?: string;
  meta: {
    ipAddress?: string;
    location?: { latitude: number; longitude: number };
    inspectorName: string;
  };
  rooms: { items: { condition: string | null }[] }[];
  signatures: { signedAt: string; role: string }[];
}): Promise<string> {
  // Build a canonical string from key report fields
  const payload = [
    inspection.id,
    inspection.createdAt,
    inspection.completedAt || '',
    inspection.meta.inspectorName,
    inspection.meta.ipAddress || '',
    inspection.meta.location
      ? `${inspection.meta.location.latitude},${inspection.meta.location.longitude}`
      : '',
    inspection.rooms
      .flatMap((r) => r.items.map((i) => `${i.condition}`))
      .join('|'),
    inspection.signatures
      .map((s) => `${s.role}:${s.signedAt}`)
      .join('|'),
  ].join('::');

  // Encode and hash
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  // Return first 64 characters (full SHA-256 hex)
  return hashHex;
}
