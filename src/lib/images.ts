/**
 * Photos are validated and downscaled in the browser before upload, so a
 * several-megabyte phone photo becomes a ~200 KB JPEG data URL that is sent
 * to the server with the listing (or return check-in).
 */

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 1280;
const QUALITY = 0.72;

export type PreparedImage = { success: true; dataUrl: string } | { success: false; error: string };

function decode(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!ALLOWED_TYPES.includes((file.type || '').toLowerCase())) {
    return { success: false, error: 'Please choose a JPEG, PNG, WebP or AVIF photo.' };
  }
  if (file.size > MAX_FILE_BYTES) return { success: false, error: 'That photo is larger than 10 MB.' };

  try {
    const img = await decode(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return { success: false, error: 'Photo processing is not available in this browser.' };
    // Flatten transparency onto white; JPEG would otherwise turn it black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { success: true, dataUrl: canvas.toDataURL('image/jpeg', QUALITY) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'That photo could not be added.' };
  }
}
