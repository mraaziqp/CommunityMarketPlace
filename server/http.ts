import type { Context, MiddlewareHandler } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import { config } from './config';

/** A request the caller got wrong (validation, business rule). Its message is safe to show. */
export class ClientError extends Error {
  constructor(message: string, readonly status: 400 | 401 | 403 | 404 | 409 | 429 = 400) {
    super(message);
  }
}

/**
 * Business rules throw plain `Error`s with messages written for members, so
 * those are shown as 400s. Anything else (TypeError, database errors) is a
 * bug or outage: it is logged and the caller gets a generic 500.
 */
export function toErrorResponse(c: Context, err: unknown) {
  if (err instanceof ClientError) return c.json({ error: err.message }, err.status);
  if (err instanceof Error && err.constructor === Error) return c.json({ error: err.message }, 400);
  console.error('[server] unexpected error', err);
  return c.json({ error: 'Something went wrong on our side. Please try again.' }, 500);
}

export function clientIp(c: Context): string | null {
  if (config().trustProxy) {
    // The right-most entry is the one our own reverse proxy (Caddy) added;
    // anything to its left came from the client and could be forged.
    const forwarded = c.req.header('x-forwarded-for');
    if (forwarded) return forwarded.split(',').pop()!.trim();
  }
  try {
    return getConnInfo(c).remote.address ?? null;
  } catch {
    return null;
  }
}

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Fixed-window limiter per client IP and route group. */
export function rateLimit(group: string, max: number, windowMs: number): MiddlewareHandler {
  return async (c, next) => {
    const key = `${group}:${clientIp(c) ?? 'unknown'}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
    } else if (++bucket.count > max) {
      c.header('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return c.json({ error: 'Too many attempts. Please wait a moment and try again.' }, 429);
    }
    await next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}, 60_000).unref();

/** Security headers for every response. Checkout forms post to PayFast, so it is allowed as a form target. */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  const payfast = 'https://www.payfast.co.za https://sandbox.payfast.co.za';
  c.header('X-Frame-Options', 'SAMEORIGIN');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(self)');
  if (config().isProduction) c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebasestorage.app https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
      "manifest-src 'self'",
      "worker-src 'self'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      `form-action 'self' ${payfast}`,
      "object-src 'none'",
    ].join('; ')
  );
};

/**
 * Browser API calls must carry this header. Cross-site pages cannot set
 * custom headers without a CORS preflight (which this server never grants),
 * so it blocks cross-site request forgery alongside SameSite cookies.
 */
export const requireAppClient: MiddlewareHandler = async (c, next) => {
  if (c.req.method !== 'GET' && c.req.header('x-sharehub-client') !== 'web') {
    return c.json({ error: 'Missing client header.' }, 403);
  }
  await next();
};
