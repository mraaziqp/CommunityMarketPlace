import { randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { memoryStore, COLLECTIONS } from '../db';
import { config } from './config';

/**
 * Firebase Storage for listing / return photos and nightly database backups.
 *
 * Optional: enabled when FIREBASE_STORAGE_BUCKET and
 * FIREBASE_SERVICE_ACCOUNT_BASE64 (a base64-encoded service-account JSON key)
 * are set. Without them, photos stay inline in Postgres and backups rely on
 * RDS snapshots only.
 */

let bucketPromise: Promise<any> | null = null;

export function firebaseEnabled() {
  const f = config().firebase;
  return !!(f.bucket && f.serviceAccountBase64);
}

async function bucket() {
  if (!firebaseEnabled()) throw new Error('Firebase Storage is not configured.');
  bucketPromise ??= (async () => {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getStorage } = await import('firebase-admin/storage');
    const f = config().firebase;
    const credentials = JSON.parse(Buffer.from(f.serviceAccountBase64, 'base64').toString('utf8'));
    const app = getApps().find((a) => a.name === 'sharehub') ?? initializeApp({ credential: cert(credentials), storageBucket: f.bucket }, 'sharehub');
    return getStorage(app).bucket();
  })();
  return bucketPromise;
}

const DATA_URL = /^data:(image\/(?:jpeg|png|webp|avif));base64,([A-Za-z0-9+/=]+)$/;
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/**
 * Moves inline (data URL) images to Firebase Storage and returns their public
 * download URLs. https URLs pass through unchanged. When Firebase is not
 * configured, images are returned as they are and stored inline.
 */
export async function storeImages(images: unknown, folder: 'listings' | 'returns' | 'avatars'): Promise<string[]> {
  if (!Array.isArray(images)) return [];
  const list = images.filter((i): i is string => typeof i === 'string').slice(0, 12);
  if (!firebaseEnabled()) return list;

  const b = await bucket();
  return Promise.all(
    list.map(async (image) => {
      const match = image.match(DATA_URL);
      if (!match) return image;
      const bytes = Buffer.from(match[2], 'base64');
      if (bytes.length > MAX_IMAGE_BYTES) throw new Error('One of the photos is too large.');
      const path = `${folder}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${EXT[match[1]]}`;
      const token = randomUUID();
      await b.file(path).save(bytes, {
        resumable: false,
        contentType: match[1],
        metadata: { cacheControl: 'public, max-age=31536000, immutable', metadata: { firebaseStorageDownloadTokens: token } },
      });
      return `https://firebasestorage.googleapis.com/v0/b/${b.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
    })
  );
}

const BACKUP_PREFIX = 'backups/';
const BACKUP_KEEP_DAYS = 30;

/** Writes a gzipped JSON snapshot of every table to Firebase Storage and prunes old ones. */
export async function backupToFirebase(): Promise<string> {
  const b = await bucket();
  const snapshot: Record<string, unknown[]> = {};
  // Sessions are short-lived and would only restore stale logins.
  for (const name of COLLECTIONS) if (name !== 'sessions') snapshot[name] = Array.from(memoryStore.collection(name).values());
  const body = gzipSync(JSON.stringify({ format: 'sharehub-backup/1', createdAt: new Date().toISOString(), collections: snapshot }));
  const path = `${BACKUP_PREFIX}sharehub-${new Date().toISOString().replace(/[:.]/g, '-')}.json.gz`;
  await b.file(path).save(body, { resumable: false, contentType: 'application/gzip' });

  const cutoff = Date.now() - BACKUP_KEEP_DAYS * 24 * 60 * 60 * 1000;
  const [files] = await b.getFiles({ prefix: BACKUP_PREFIX });
  await Promise.all(
    files
      .filter((f: any) => new Date(f.metadata.timeCreated).getTime() < cutoff)
      .map((f: any) => f.delete().catch(() => undefined))
  );
  return path;
}

/** Runs the backup once a day at 02:00 UTC (and logs, never throws). */
export function scheduleNightlyBackups() {
  if (!firebaseEnabled()) {
    console.info('[backup] Firebase Storage not configured; relying on RDS snapshots only');
    return;
  }
  const scheduleNext = () => {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 2, 0, 0));
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    setTimeout(async () => {
      try {
        console.info(`[backup] saved ${await backupToFirebase()}`);
      } catch (err) {
        console.error('[backup] failed', err);
      }
      scheduleNext();
    }, next.getTime() - now.getTime()).unref();
  };
  scheduleNext();
  console.info('[backup] nightly Firebase Storage backups scheduled for 02:00 UTC');
}
