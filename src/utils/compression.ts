/**
 * Photo compression utility for MeInspect
 * Compresses base64 data URL photos to reduce storage size
 */

interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

const DEFAULT_OPTIONS: CompressOptions = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 0.7,
};

/**
 * Compress a base64 data URL image
 * Returns compressed base64 data URL
 */
export async function compressPhoto(
  dataUrl: string,
  options: CompressOptions = {}
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return dataUrl; // Not a base64 image, return as-is
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      // Scale down if too large
      if (width > opts.maxWidth! || height > opts.maxHeight!) {
        const ratio = Math.min(opts.maxWidth! / width, opts.maxHeight! / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl); // Fallback to original
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Get compressed JPEG (smaller than PNG for photos)
      const compressed = canvas.toDataURL('image/jpeg', opts.quality);
      resolve(compressed);
    };

    img.onerror = () => {
      resolve(dataUrl); // Fallback to original on error
    };

    img.src = dataUrl;
  });
}

/**
 * Get the size of a base64 data URL in bytes
 */
export function getDataUrlSize(dataUrl: string): number {
  if (!dataUrl || !dataUrl.startsWith('data:')) return 0;
  const base64 = dataUrl.split(',')[1] || '';
  return Math.round(base64.length * 0.75);
}

/**
 * Convert a base64 data URL to a Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(parts[1]);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

/**
 * Convert a Uint8Array (PDF bytes) to a Blob
 */
export function uint8ArrayToBlob(data: Uint8Array, type = 'application/pdf'): Blob {
  return new Blob([data], { type });
}
