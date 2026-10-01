import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { config } from './config';

/**
 * ============================================================================
 * PAYFAST INTEGRATION (https://developers.payfast.co.za)
 *
 * Checkout: the server builds and signs the payment form; the browser posts
 * it to PayFast. Nothing secret reaches the browser — the signature is a hash
 * that includes the passphrase, not the passphrase itself.
 *
 * ITN (Instant Transaction Notification): PayFast POSTs the result to
 * notify_url. A notification is only trusted after all four checks PayFast
 * requires: valid signature, request from a PayFast server, amount matches
 * what we charged, and PayFast confirms it server-to-server.
 * ============================================================================
 */

/**
 * PayFast signs with PHP's urlencode(): spaces become '+', and every
 * character except letters, digits and -_. is percent-encoded with uppercase
 * hex. encodeURIComponent leaves !'()*~ alone, which breaks the signature for
 * any value containing them (verified against the live gateway), so those are
 * encoded explicitly.
 */
export function pfEncode(value: string): string {
  return encodeURIComponent(value.trim())
    .replace(/[!'()*~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, '+');
}

export function md5(value: string): string {
  return createHash('md5').update(value).digest('hex');
}

/** Signature for an outgoing checkout form: fields in order, empty values skipped. */
export function signCheckoutFields(fields: [string, string][], passphrase: string): string {
  const base = fields
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${pfEncode(v)}`)
    .join('&');
  return md5(passphrase ? `${base}&passphrase=${pfEncode(passphrase)}` : base);
}

/** The parameter string PayFast signed in a notification: every field in received order except `signature`. */
export function itnParamString(entries: [string, string][]): string {
  return entries
    .filter(([k]) => k !== 'signature')
    .map(([k, v]) => `${k}=${pfEncode(v)}`)
    .join('&');
}

export function isValidItnSignature(entries: [string, string][], passphrase: string): boolean {
  const received = entries.find(([k]) => k === 'signature')?.[1];
  if (!received) return false;
  const base = itnParamString(entries);
  const expected = md5(passphrase ? `${base}&passphrase=${pfEncode(passphrase)}` : base);
  return expected === received.toLowerCase();
}

const PAYFAST_HOSTS = ['www.payfast.co.za', 'sandbox.payfast.co.za', 'w1w.payfast.co.za', 'w2w.payfast.co.za'];
let cachedIps: { at: number; ips: Set<string> } | null = null;

/** True when the request came from one of PayFast's published servers. */
export async function isPayfastSourceIp(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const normalized = ip.replace(/^::ffff:/, '');
  if (!cachedIps || Date.now() - cachedIps.at > 10 * 60 * 1000) {
    const ips = new Set<string>();
    for (const host of PAYFAST_HOSTS) {
      try {
        for (const r of await lookup(host, { all: true })) ips.add(r.address);
      } catch {
        /* a host that fails to resolve simply contributes no addresses */
      }
    }
    cachedIps = { at: Date.now(), ips };
  }
  return cachedIps.ips.has(normalized);
}

/** Asks PayFast to confirm the notification is genuine. */
export async function confirmWithPayfast(entries: [string, string][], fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const res = await fetchImpl(`https://${config().payfast.host}/eng/query/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: itnParamString(entries),
  });
  return (await res.text()).trim() === 'VALID';
}

// --- Checkout ---

export interface CheckoutRequest {
  paymentId: string;
  amountInCents: number;
  itemName: string;
  itemDescription?: string;
  buyer: { name: string; email: string };
  /** 'booking' | 'subscription' — echoed back in custom_str2 for routing. */
  kind: string;
  targetId: string;
  /** Monthly recurring billing (PayFast subscriptions). */
  recurring?: { recurringAmountInCents: number };
}

export interface CheckoutForm {
  actionUrl: string;
  fields: Record<string, string>;
}

/** Plain text PayFast accepts in descriptive fields. */
function clean(value: string, max: number) {
  return value.replace(/[^\p{L}\p{N} .,\-&/()']/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

const rands = (cents: number) => (cents / 100).toFixed(2);

export function buildCheckout(req: CheckoutRequest): CheckoutForm {
  const pf = config().payfast;
  const app = config().publicAppUrl;
  const [first, ...rest] = clean(req.buyer.name, 100).split(' ');
  const today = new Date().toISOString().slice(0, 10);

  // Order matters: PayFast signs fields in this documented order.
  const fields: [string, string][] = [
    ['merchant_id', pf.merchantId],
    ['merchant_key', pf.merchantKey],
    ['return_url', `${app}/?payment=return&ref=${encodeURIComponent(req.paymentId)}`],
    ['cancel_url', `${app}/?payment=cancelled&ref=${encodeURIComponent(req.paymentId)}`],
    ['notify_url', pf.notifyUrl],
    ['name_first', first || 'ShareHub'],
    ['name_last', rest.join(' ')],
    ['email_address', req.buyer.email],
    ['m_payment_id', req.paymentId],
    ['amount', rands(req.amountInCents)],
    ['item_name', clean(req.itemName, 100) || 'ShareHub'],
    ['item_description', clean(req.itemDescription ?? '', 255)],
    ['custom_str1', pf.appTag],
    ['custom_str2', req.kind],
    ['custom_str3', req.targetId],
  ];
  if (req.recurring) {
    fields.push(
      ['subscription_type', '1'],
      ['billing_date', today],
      ['recurring_amount', rands(req.recurring.recurringAmountInCents)],
      ['frequency', '3'], // monthly
      ['cycles', '0'] // until cancelled
    );
  }

  const signature = signCheckoutFields(fields, pf.passphrase);
  const out: Record<string, string> = {};
  for (const [k, v] of fields) if (v !== '') out[k] = v;
  out.signature = signature;
  return { actionUrl: `https://${pf.host}/eng/process`, fields: out };
}
