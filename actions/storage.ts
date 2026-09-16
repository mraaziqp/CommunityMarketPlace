import { memoryStore } from '../db';
import * as schema from '../db/schema';
import {
  SignedUploadUrlRequest,
  SignedUploadUrlResponse,
  SystemLogModel,
} from '../src/types';

/**
 * ============================================================================
 * MEDIA STORAGE PIPELINE — CLIENT-SIDE IMAGE INTAKE
 *
 * ShareHub is a static app with no server and no object bucket, so there is
 * nothing to pre-sign against. Listing photos are instead normalised in the
 * browser: validated, downscaled on a canvas, and re-encoded as a data URL
 * that is stored alongside the listing.
 *
 * Downscaling is not cosmetic. A raw phone photo is several megabytes, and the
 * store is persisted to localStorage, whose quota is around 5MB in total. An
 * image bounded to MAX_IMAGE_DIMENSION at JPEG quality 0.72 lands in the low
 * hundreds of kilobytes, which keeps a realistic listing well inside budget
 * and, unlike an object URL, still resolves after a reload.
 *
 * To move to real bucket storage later, replace prepareListingImage with a
 * call that PUTs to a genuinely pre-signed URL issued by a server; every
 * caller already treats the result as an opaque URL.
 * ============================================================================
 */

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const MAX_IMAGE_DIMENSION = 1280;
const OUTPUT_QUALITY = 0.72;
const OUTPUT_MIME = 'image/jpeg';

/**
 * Validates an image the user picked, without reading its contents.
 * Kept separate so the UI can reject a bad file before any decoding work.
 */
export function validateImageFile(
  request: SignedUploadUrlRequest
): { valid: true } | { valid: false; error: string } {
  const { contentType, fileSizeBytes } = request;

  if (!ALLOWED_MIME_TYPES.includes((contentType || '').toLowerCase())) {
    return {
      valid: false,
      error: `Unsupported format (${contentType || 'unknown'}). Please upload JPEG, PNG, WebP, or AVIF.`,
    };
  }

  if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'File exceeds maximum allowed size (10MB).' };
  }

  return { valid: true };
}

/** Builds the stable object key a listing photo would occupy in a bucket. */
function buildObjectKey(filename: string, listingId?: string): string {
  const extension = (filename.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const timestamp = Date.now();
  const randomEntropy = Math.random().toString(36).substring(2, 10);
  const prefix = listingId ? `listings/${listingId}` : 'listings/temp';
  return `${prefix}/${timestamp}-${randomEntropy}.${extension || 'jpg'}`;
}

/** Decodes a File into an <img> via an object URL, always revoking the URL. */
function decodeImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = objectUrl;
  });
}

/**
 * Validates, downscales and encodes a picked file into a storable data URL.
 */
export async function prepareListingImage(
  file: File,
  listingId?: string
): Promise<SignedUploadUrlResponse> {
  const key = buildObjectKey(file.name, listingId);

  const validation = validateImageFile({
    filename: file.name,
    contentType: file.type || 'image/jpeg',
    fileSizeBytes: file.size,
    listingId,
  });

  if (validation.valid === false) {
    return {
      success: false,
      uploadUrl: '',
      publicUrl: '',
      key: '',
      expiresInSeconds: 0,
      error: validation.error,
    };
  }

  try {
    const img = await decodeImage(file);

    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is unavailable in this browser.');

    // Flatten onto white: source PNG/WebP transparency would otherwise go black
    // once re-encoded as JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL(OUTPUT_MIME, OUTPUT_QUALITY);

    return {
      success: true,
      uploadUrl: dataUrl,
      publicUrl: dataUrl,
      key,
      headers: { 'Content-Type': OUTPUT_MIME },
      expiresInSeconds: 0,
    };
  } catch (error: any) {
    console.error('Error preparing listing image:', error);
    return {
      success: false,
      uploadUrl: '',
      publicUrl: '',
      key: '',
      expiresInSeconds: 0,
      error: error?.message || 'Failed to process the selected image.',
    };
  }
}

/**
 * Completes and registers uploaded photo in the listing and system audit log.
 */
export async function registerUploadedListingPhoto(params: {
  listingId: string;
  photoUrl: string;
  key: string;
  userId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { listingId, photoUrl, key, userId } = params;

    // Record audit event in SystemLogs
    const logId = `sys_img_${Date.now()}`;
    const systemLog: schema.SystemLog = {
      id: logId,
      eventType: 'IMAGE_UPLOADED',
      userId: userId || 'usr_me',
      targetId: listingId || key,
      metadata: {
        photoUrl,
        key,
        listingId,
        uploadedAt: new Date().toISOString(),
      },
      createdAt: new Date(),
    };
    memoryStore.systemLogs.set(logId, systemLog);

    return { success: true };
  } catch (error: any) {
    console.error('Error registering uploaded listing photo:', error);
    return { success: false, error: error.message };
  }
}
