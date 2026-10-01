import { createHmac, randomUUID } from 'node:crypto';
import type { PendingWrite } from '../db';
import { config } from './config';

/**
 * Outbound event webhooks for the ecosystem bot.
 *
 * Every business event (booking, payment, pickup, return, review, sign-up…)
 * is written to system_logs. After each successful commit, new events are
 * POSTed to BOT_WEBHOOK_URL:
 *
 *   POST <BOT_WEBHOOK_URL>
 *   X-ShareHub-Event: BOOKING_CREATED
 *   X-ShareHub-Delivery: <uuid>
 *   X-ShareHub-Timestamp: <unix seconds>
 *   X-ShareHub-Signature: sha256=<hex HMAC of "<timestamp>.<body>" with BOT_WEBHOOK_SECRET>
 *   { id, type, occurredAt, userId, targetId, data }
 *
 * Delivery is at-least-once with retries (1s, 5s, 30s); receivers should
 * de-duplicate on `id`. Missed events can always be recovered from
 * GET /api/v1/collections/systemLogs?updatedSince=…
 */

const RETRY_DELAYS_MS = [1_000, 5_000, 30_000];

export function signWebhook(secret: string, timestamp: string, body: string) {
  return 'sha256=' + createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

async function deliver(event: Record<string, unknown>, attempt = 0): Promise<void> {
  const { webhookUrl, webhookSecret } = config().bot;
  if (!webhookUrl) return;
  const body = JSON.stringify(event);
  const timestamp = String(Math.floor(Date.now() / 1000));
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ShareHub-Event': String(event.type),
        'X-ShareHub-Delivery': randomUUID(),
        'X-ShareHub-Timestamp': timestamp,
        'X-ShareHub-Signature': signWebhook(webhookSecret, timestamp, body),
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay === undefined) {
      console.warn(`[webhooks] giving up on ${event.id}:`, (err as Error).message);
      return;
    }
    setTimeout(() => void deliver(event, attempt + 1), delay).unref();
  }
}

/** Hooked to memoryStore.onCommitted: forwards newly written events. */
export function publishCommittedEvents(writes: PendingWrite[]) {
  if (!config().bot.webhookUrl) return;
  for (const w of writes) {
    if (w.collection !== 'systemLogs' || !w.record) continue;
    const r = w.record;
    void deliver({
      id: r.id,
      type: r.eventType,
      occurredAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      userId: r.userId,
      targetId: r.targetId,
      data: r.metadata ?? {},
    });
  }
}
