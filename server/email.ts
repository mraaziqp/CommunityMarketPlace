import { config } from './config';

/**
 * Transactional email via Resend (https://resend.com). Enabled when
 * RESEND_API_KEY is set; otherwise emails are skipped (logged in development).
 * Sending never blocks or fails a request: it happens after the change has
 * been committed, with a couple of retries.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type EmailTransport = (message: EmailMessage) => Promise<void>;

async function sendWithResend(message: EmailMessage): Promise<void> {
  const { resendApiKey, from, replyTo } = config().email;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html, text: message.text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

let transport: EmailTransport | null = null;

/** Replaces the sender (tests). */
export function setEmailTransport(t: EmailTransport | null) {
  transport = t;
}

export function emailEnabled() {
  return !!transport || !!config().email.resendApiKey;
}

export async function sendEmail(message: EmailMessage, attempt = 0): Promise<void> {
  const send = transport ?? (config().email.resendApiKey ? sendWithResend : null);
  if (!send) return;
  try {
    await send(message);
  } catch (err) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      return sendEmail(message, attempt + 1);
    }
    console.error(`[email] could not send "${message.subject}" to ${message.to}:`, (err as Error).message);
  }
}

// --- Template ---------------------------------------------------------------

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export interface EmailContent {
  subject: string;
  heading: string;
  /** Paragraphs of plain text (escaped). */
  paragraphs: string[];
  /** Label/value rows shown as a summary box. */
  details?: [string, string][];
  /** A code to show large (pickup or access code). */
  code?: { label: string; value: string };
  cta?: { label: string; path: string };
}

export function renderEmail(content: EmailContent): Omit<EmailMessage, 'to'> {
  const app = config().publicAppUrl;
  const cta = content.cta ? `${app}${content.cta.path}` : null;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="background:#0f172a;padding:18px 24px;color:#ffffff;font-size:18px;font-weight:700">Share<span style="color:#818cf8">Hub</span></td></tr>
<tr><td style="padding:28px 24px">
<h1 style="margin:0 0 14px;font-size:20px;line-height:1.3">${escapeHtml(content.heading)}</h1>
${content.paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#334155">${escapeHtml(p)}</p>`).join('')}
${content.code ? `<div style="margin:18px 0;padding:16px;border-radius:12px;background:#fffbeb;border:1px solid #fcd34d;text-align:center"><div style="font-size:12px;color:#92400e;text-transform:uppercase;letter-spacing:.06em">${escapeHtml(content.code.label)}</div><div style="font-family:Consolas,Menlo,monospace;font-size:26px;font-weight:700;letter-spacing:.08em;color:#78350f">${escapeHtml(content.code.value)}</div></div>` : ''}
${content.details?.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e2e8f0;border-radius:12px">${content.details.map(([k, v]) => `<tr><td style="padding:10px 14px;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9">${escapeHtml(k)}</td><td style="padding:10px 14px;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid #f1f5f9">${escapeHtml(v)}</td></tr>`).join('')}</table>` : ''}
${cta ? `<p style="margin:22px 0 4px"><a href="${escapeHtml(cta)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:14px">${escapeHtml(content.cta!.label)}</a></p>` : ''}
</td></tr>
<tr><td style="padding:16px 24px;background:#f8fafc;font-size:12px;color:#94a3b8">ShareHub · Borrow more, buy less · <a href="${escapeHtml(app)}" style="color:#94a3b8">${escapeHtml(app.replace(/^https?:\/\//, ''))}</a></td></tr>
</table></td></tr></table></body></html>`;

  const textLines = [
    content.heading,
    '',
    ...content.paragraphs,
    ...(content.code ? ['', `${content.code.label}: ${content.code.value}`] : []),
    ...(content.details?.length ? ['', ...content.details.map(([k, v]) => `${k}: ${v}`)] : []),
    ...(cta ? ['', `${content.cta!.label}: ${cta}`] : []),
    '',
    '— ShareHub',
  ];
  return { subject: content.subject, html, text: textLines.join('\n') };
}
