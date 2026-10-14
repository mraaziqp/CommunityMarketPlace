import { serve } from '@hono/node-server';
import { memoryStore } from '../db';
import { assertProductionReady, config } from './config';
import { connectDatabase } from './persistence';
import { createApp } from './app';
import { publishCommittedEvents } from './events';
import { sendCommittedNotifications } from './notifications';
import { expireStaleHolds } from '../actions/payments';
import { ensureAdminUser, pruneExpiredSessions } from '../actions/auth';
import { scheduleNightlyBackups } from './firebase';

async function main() {
  const cfg = config();
  assertProductionReady(cfg);

  const database = await connectDatabase(cfg);
  await memoryStore.hydrate(database.adapter);
  memoryStore.onCommitted = (writes) => {
    publishCommittedEvents(writes);
    sendCommittedNotifications(writes);
  };

  // The first administrator, from the server's settings (never from the code: this
  // repository is public). Made when missing; its password is reset only when
  // ADMIN_BOOTSTRAP_RESET=1. The address must also be in ADMIN_EMAILS.
  const bootEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim();
  const bootPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? '';
  if (bootEmail && bootPassword.length >= 12) {
    await memoryStore.runExclusive(async () => {
      await ensureAdminUser(bootEmail, bootPassword, process.env.ADMIN_BOOTSTRAP_NAME || 'Admin', {
        resetPassword: process.env.ADMIN_BOOTSTRAP_RESET === '1',
      });
    });
  } else if (bootEmail) {
    console.warn('[server] ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters; no admin was made');
  }

  if (cfg.demoMode && memoryStore.isEmpty()) {
    await memoryStore.runExclusive(() => memoryStore.seedDemoData({ includeAdmin: true }));
    console.info('[server] seeded demo data (DEMO_MODE is on)');
  }

  // Housekeeping: release abandoned checkouts, drop expired sessions.
  const housekeeping = setInterval(() => {
    memoryStore
      .runExclusive(() => {
        expireStaleHolds();
        pruneExpiredSessions();
      })
      .catch((err) => console.error('[server] housekeeping failed', err));
  }, 60_000);

  scheduleNightlyBackups();

  const app = createApp({ ping: database.ping, staticRoot: process.env.STATIC_ROOT || './dist' });
  const server = serve({ fetch: app.fetch, port: cfg.port }, (info) => {
    console.info(
      `[server] ShareHub on :${info.port} · db=${database.kind} · payfast=${cfg.payfast.mode} · demo=${cfg.demoMode} · bot api=${cfg.bot.apiKeys.length ? 'on' : 'off'} · email=${cfg.email.resendApiKey ? 'on' : 'off'}`
    );
  });

  const shutdown = async (signal: string) => {
    console.info(`[server] ${signal}: shutting down`);
    clearInterval(housekeeping);
    server.close();
    await database.close().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[server] failed to start:', err instanceof Error ? err.message : err);
  if (err instanceof Error && err.cause) console.error('  cause:', (err.cause as Error).message ?? err.cause);
  process.exit(1);
});
