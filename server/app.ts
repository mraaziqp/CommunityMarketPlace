import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { serveStatic } from '@hono/node-server/serve-static';
import { securityHeaders } from './http';
import { appRoutes } from './routes/app';
import { botRoutes } from './routes/bot';
import { payfastRoutes } from './routes/payfast';

export interface AppDeps {
  /** Checks the database is reachable (health endpoint). */
  ping?: () => Promise<void>;
  /** Injected in tests to stand in for PayFast's validation call. */
  fetchImpl?: typeof fetch;
  /** Directory of the built frontend; omitted in tests. */
  staticRoot?: string;
}

export function createApp(deps: AppDeps = {}) {
  const app = new Hono({ strict: false });

  app.use('*', securityHeaders);
  // Listings and return photos carry downscaled images inline.
  app.use('/api/*', bodyLimit({ maxSize: 12 * 1024 * 1024, onError: (c) => c.json({ error: 'That upload is too large.' }, 413) }));

  app.get('/api/health', async (c) => {
    try {
      await deps.ping?.();
      return c.json({ ok: true });
    } catch {
      return c.json({ ok: false }, 503);
    }
  });

  app.route('/', payfastRoutes({ fetchImpl: deps.fetchImpl }));
  app.route('/api/v1', botRoutes());
  app.route('/api', appRoutes());
  app.all('/api/*', (c) => c.json({ error: 'Not found.' }, 404));

  if (deps.staticRoot) {
    const root = deps.staticRoot;
    app.use(
      '/assets/*',
      async (c, next) => {
        await next();
        c.header('Cache-Control', 'public, max-age=31536000, immutable');
      },
      serveStatic({ root })
    );
    app.use('*', serveStatic({ root }));
    // Single-page app: every other path renders index.html.
    app.get('*', serveStatic({ root, path: 'index.html' }));
  }

  return app;
}
