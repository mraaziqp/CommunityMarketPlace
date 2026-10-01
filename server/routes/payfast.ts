import { Hono } from 'hono';
import { memoryStore } from '../../db';
import { config } from '../config';
import { clientIp } from '../http';
import { confirmWithPayfast, isPayfastSourceIp, isValidItnSignature } from '../payfast';
import { applyPayfastNotification } from '../../actions/payments';

/**
 * POST /api/webhooks/payfast — PayFast ITN.
 *
 * Only notifications that pass every check change anything:
 *   1. the signature matches (with our passphrase),
 *   2. the request came from a PayFast server (live mode, or when enabled),
 *   3. PayFast confirms it server-to-server,
 *   4. the amount matches what we charged (checked while applying).
 * Notifications tagged for another ecosystem app (custom_str1) are ignored,
 * so one merchant account can serve several apps.
 */
export function payfastRoutes(deps: { fetchImpl?: typeof fetch } = {}) {
  const r = new Hono();

  r.post('/api/webhooks/payfast', async (c) => {
    const pf = config().payfast;
    const raw = await c.req.text();
    const entries = Array.from(new URLSearchParams(raw).entries());
    const data = Object.fromEntries(entries);
    const ref = data.m_payment_id || data.token || 'unknown';

    if (!isValidItnSignature(entries, pf.passphrase)) {
      console.warn(`[payfast] rejected ${ref}: bad signature`);
      return c.text('invalid signature', 400);
    }
    if (pf.verifySourceIp && !(await isPayfastSourceIp(clientIp(c)))) {
      console.warn(`[payfast] rejected ${ref}: unexpected source ${clientIp(c)}`);
      return c.text('invalid source', 400);
    }
    if (data.merchant_id && data.merchant_id !== pf.merchantId) {
      console.warn(`[payfast] rejected ${ref}: merchant mismatch`);
      return c.text('invalid merchant', 400);
    }
    if (data.custom_str1 && data.custom_str1 !== pf.appTag) {
      return c.text('not for this app', 200);
    }
    if (pf.verifyWithPayfast) {
      try {
        if (!(await confirmWithPayfast(entries, deps.fetchImpl))) {
          console.warn(`[payfast] rejected ${ref}: PayFast did not confirm`);
          return c.text('not confirmed', 400);
        }
      } catch (err) {
        // Let PayFast retry later rather than dropping a real payment.
        console.error(`[payfast] could not reach PayFast to confirm ${ref}`, err);
        return c.text('confirmation unavailable', 503);
      }
    }

    try {
      const outcome = await memoryStore.runExclusive(() => applyPayfastNotification(data));
      console.info(`[payfast] ${ref} ${data.payment_status}: ${outcome.status} (${outcome.detail})`);
      return c.text(outcome.status, outcome.status === 'rejected' ? 400 : 200);
    } catch (err) {
      console.error(`[payfast] failed to apply ${ref}`, err);
      return c.text('error', 500);
    }
  });

  return r;
}
