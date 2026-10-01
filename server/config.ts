/**
 * Server configuration, read once from the environment. This is the only
 * place secrets are read; none of it is ever sent to the browser.
 */

export type PayfastMode = 'sandbox' | 'live';

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

// PayFast's public sandbox test merchant. Used only in sandbox mode when no
// sandbox credentials are configured.
const PAYFAST_SANDBOX_DEFAULTS = { merchantId: '10000100', merchantKey: '46f0cd694581a', passphrase: 'jt7NOE43FZPn' };

function load() {
  const env = process.env;
  const isProduction = env.NODE_ENV === 'production';
  const payfastMode: PayfastMode = env.PAYFAST_MODE === 'live' ? 'live' : 'sandbox';
  const publicAppUrl = (env.PUBLIC_APP_URL || `http://localhost:${env.PORT || 8787}`).replace(/\/$/, '');
  const useSandboxDefaults = payfastMode === 'sandbox' && !env.PAYFAST_MERCHANT_ID;

  return {
    isProduction,
    port: Number(env.PORT || 8787),
    databaseUrl: env.DATABASE_URL || '',
    /** Local-only fallback database (embedded Postgres) when DATABASE_URL is not set. */
    localDataDir: env.LOCAL_DATA_DIR || '.data/pglite',
    publicAppUrl,
    /** Seed the demo neighbourhood into an empty database, and allow one-tap demo sign-in. */
    demoMode: bool(env.DEMO_MODE, !isProduction),
    adminEmails: new Set(list(env.ADMIN_EMAILS).map((e) => e.toLowerCase())),
    /** Behind a load balancer / reverse proxy, trust X-Forwarded-For for client IPs. */
    trustProxy: bool(env.TRUST_PROXY, isProduction),
    sessionTtlDays: Number(env.SESSION_TTL_DAYS || 30),
    /** Sign-in / sign-up attempts allowed per client IP per minute. */
    authRateLimitPerMinute: Number(env.AUTH_RATE_LIMIT_PER_MINUTE || 10),

    payfast: {
      mode: payfastMode,
      merchantId: useSandboxDefaults ? PAYFAST_SANDBOX_DEFAULTS.merchantId : env.PAYFAST_MERCHANT_ID || '',
      merchantKey: useSandboxDefaults ? PAYFAST_SANDBOX_DEFAULTS.merchantKey : env.PAYFAST_MERCHANT_KEY || '',
      passphrase: useSandboxDefaults ? PAYFAST_SANDBOX_DEFAULTS.passphrase : env.PAYFAST_PASSPHRASE || '',
      host: payfastMode === 'live' ? 'www.payfast.co.za' : 'sandbox.payfast.co.za',
      notifyUrl: env.PAYFAST_NOTIFY_URL || `${publicAppUrl}/api/webhooks/payfast`,
      /** Tag sent with every payment so a shared ecosystem ITN handler can route it. */
      appTag: env.PAYFAST_APP_TAG || 'sharehub',
      /** Check that notifications come from PayFast's servers (disable only for local testing). */
      verifySourceIp: bool(env.PAYFAST_VERIFY_SOURCE_IP, payfastMode === 'live'),
      /** Ask PayFast to confirm each notification server-to-server. */
      verifyWithPayfast: bool(env.PAYFAST_VERIFY_WITH_PAYFAST, true),
    },

    /** Transactional email via Resend (optional). */
    email: {
      resendApiKey: env.RESEND_API_KEY || '',
      from: env.EMAIL_FROM || 'ShareHub <market@arpcloudsolutions.co.za>',
      replyTo: env.EMAIL_REPLY_TO || '',
    },

    /** Firebase Storage for photos and nightly backups (optional). */
    firebase: {
      bucket: env.FIREBASE_STORAGE_BUCKET || '',
      /** Service-account JSON key, base64-encoded (never commit it). */
      serviceAccountBase64: env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '',
    },

    bot: {
      /** Bearer keys accepted on /api/v1 (comma-separated, so keys can be rotated without downtime). */
      apiKeys: list(env.BOT_API_KEYS),
      /** Where to POST signed event notifications. Optional. */
      webhookUrl: env.BOT_WEBHOOK_URL || '',
      webhookSecret: env.BOT_WEBHOOK_SECRET || '',
    },
  };
}

export type ServerConfig = ReturnType<typeof load>;

let current: ServerConfig | null = null;

export function config(): ServerConfig {
  return (current ??= load());
}

/** Re-reads the environment (tests). */
export function reloadConfig() {
  current = load();
  return current;
}

/** Fails fast at boot when production is missing something it cannot run without. */
export function assertProductionReady(c = config()) {
  if (!c.isProduction) return;
  const missing: string[] = [];
  if (!c.databaseUrl) missing.push('DATABASE_URL');
  if (!process.env.PUBLIC_APP_URL) missing.push('PUBLIC_APP_URL');
  if (c.payfast.mode === 'live') {
    if (!c.payfast.merchantId) missing.push('PAYFAST_MERCHANT_ID');
    if (!c.payfast.merchantKey) missing.push('PAYFAST_MERCHANT_KEY');
    if (!c.payfast.passphrase) missing.push('PAYFAST_PASSPHRASE');
  }
  if (c.bot.webhookUrl && !c.bot.webhookSecret) missing.push('BOT_WEBHOOK_SECRET');
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  if (!c.publicAppUrl.startsWith('https://')) throw new Error('PUBLIC_APP_URL must be https:// in production.');
  if (c.bot.apiKeys.some((k) => k.length < 32)) throw new Error('Each BOT_API_KEYS entry must be at least 32 characters.');
}
