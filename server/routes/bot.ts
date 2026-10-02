import { timingSafeEqual } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { memoryStore } from '../../db';
import { config } from '../config';
import { ClientError, toErrorResponse } from '../http';
import {
  BOT_COLLECTIONS,
  asBotCollection,
  buildRecord,
  describeColumns,
  listRecords,
  writeRecords,
  type BotCollection,
} from '../records';
import { getUserById } from '../../actions/auth';
import { searchListings } from '../../actions/search';
import { createListing } from '../../actions/listings';
import { getActivityForUser } from '../../actions/activity';
import { createTrustGroup, joinTrustGroup, getUserMemberGroupIds } from '../../actions/groups';
import { logFractionalUse, subscribeToListing } from '../../actions/usage';
import { confirmHandover, createBooking } from '../../actions/bookings';
import { confirmReturn, initiateDispute } from '../../actions/returns';
import { createReview } from '../../actions/reviews';
import { getExecutiveAdminReport, type ReportRange } from '../../actions/admin';
import {
  listPayments,
  markSettlement,
  startBookingCheckout,
  startSubscriptionCheckout,
  startTestPayment,
} from '../../actions/payments';

/**
 * /api/v1 — ecosystem bot API. Authenticate with
 *   Authorization: Bearer <one of BOT_API_KEYS>
 * Full read/write on every business table, bulk export/import, domain
 * actions on behalf of a member, reports and payout settlement.
 * Account credentials and sessions are never exposed.
 */

function keyMatches(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function json(c: Context): Promise<any> {
  try {
    return await c.req.json();
  } catch {
    throw new ClientError('Expected a JSON body.');
  }
}

/** Database constraint errors are useful to a trusted bot, so they are passed through as 400s. */
async function botWrite<T>(fn: () => T | Promise<T>): Promise<T> {
  try {
    return await memoryStore.runExclusive(fn);
  } catch (err: any) {
    // Control-flow signals (e.g. the dry-run rollback) and friendly errors pass through untouched.
    if (!(err instanceof Error) || err instanceof ClientError || err.constructor === Error) throw err;
    const detail = (err as any)?.detail || err?.message || 'constraint violation';
    throw new ClientError(`Rejected by the database: ${detail}`);
  }
}

function actingUser(id: unknown) {
  if (typeof id !== 'string' || !getUserById(id)) throw new ClientError('"actingUserId" must be an existing user id.');
  return id;
}

/** Domain actions the bot can run as a member; the same business rules apply as in the app. */
const ACTIONS: Record<string, (args: any) => Promise<unknown>> = {
  searchListings: async (a) =>
    searchListings({ ...a, userMemberGroupIds: a.actingUserId ? await getUserMemberGroupIds(a.actingUserId) : [] }),
  getActivity: (a) => getActivityForUser(actingUser(a.actingUserId)),
  createListing: async (a) => {
    const res = await createListing({ ...a.listing, ownerId: actingUser(a.actingUserId) });
    if (!res.success) throw new ClientError(res.error || 'Listing rejected.');
    return res.listing;
  },
  createBooking: (a) =>
    createBooking({
      listingId: a.listingId,
      renterId: actingUser(a.actingUserId),
      pricingTierId: a.tierId,
      startDate: a.startDate,
      endDate: a.endDate,
    }),
  startBookingCheckout: (a) => startBookingCheckout(a.bookingId, actingUser(a.actingUserId)),
  joinCoop: async (a) => {
    const userId = actingUser(a.actingUserId);
    const { subscriptionId } = await subscribeToListing(userId, a.listingId, a.tierId);
    return { subscriptionId, checkout: await startSubscriptionCheckout(subscriptionId, userId) };
  },
  logUsage: (a) => logFractionalUse(a.subscriptionId, actingUser(a.actingUserId), a.notes),
  confirmPickup: (a) => confirmHandover(a.bookingId, a.code, actingUser(a.actingUserId)),
  confirmReturn: (a) => confirmReturn(a.bookingId, a.condition ?? 'GOOD', a.notes ?? 'Checked in.', a.photos ?? [], actingUser(a.actingUserId)),
  reportProblem: (a) => initiateDispute(a.bookingId, 'DAMAGED', a.notes, a.photos ?? [], actingUser(a.actingUserId)),
  createReview: (a) => createReview({ ...a, reviewerId: actingUser(a.actingUserId) }),
  createCircle: (a) => createTrustGroup({ name: a.name, description: a.description, icon: a.icon, adminId: actingUser(a.actingUserId) }),
  joinCircle: (a) => joinTrustGroup(a.inviteCode, actingUser(a.actingUserId)),
  startTestPayment: async (a) => startTestPayment(actingUser(a.actingUserId), a.amountInCents, !!a.recurring),
  settlePayment: async (a) => {
    markSettlement(a.paymentId, a.what, actingUser(a.actingUserId));
    return { ok: true };
  },
};

export function botRoutes() {
  const v1 = new Hono();

  v1.use('*', async (c, next) => {
    const keys = config().bot.apiKeys;
    const header = c.req.header('authorization') ?? '';
    const given = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (keys.length === 0) return c.json({ error: 'The bot API is not enabled (set BOT_API_KEYS).' }, 503);
    if (!given || !keys.some((k) => keyMatches(given, k))) return c.json({ error: 'Invalid API key.' }, 401);
    await next();
  });
  v1.onError((err, c) => toErrorResponse(c, err));

  v1.get('/', (c) =>
    c.json({
      name: 'ShareHub bot API',
      version: 1,
      collections: Object.keys(BOT_COLLECTIONS),
      actions: Object.keys(ACTIONS),
      endpoints: [
        'GET    /api/v1/schema',
        'GET    /api/v1/collections/:collection?limit=&cursor=&updatedSince=&<field>=<value>',
        'GET    /api/v1/collections/:collection/:id',
        'POST   /api/v1/collections/:collection            (create or upsert one record)',
        'PATCH  /api/v1/collections/:collection/:id        (update fields)',
        'DELETE /api/v1/collections/:collection/:id',
        'GET    /api/v1/export?collections=a,b&updatedSince=&format=json|ndjson',
        'POST   /api/v1/import                             ({ mode, dryRun, collections: { name: [records] } })',
        'POST   /api/v1/actions/:action                    ({ actingUserId, ...args })',
        'GET    /api/v1/reports/admin?range=7d|30d|90d|all',
        'GET    /api/v1/payouts                            (payments with host payouts or deposit refunds owed)',
        'GET    /api/v1/payments?kind=booking|subscription|test',
      ],
    })
  );

  v1.get('/schema', (c) =>
    c.json(Object.fromEntries(Object.keys(BOT_COLLECTIONS).map((name) => [name, describeColumns(name as BotCollection)])))
  );

  v1.get('/collections/:collection', (c) => {
    const collection = asBotCollection(c.req.param('collection'));
    const { limit, cursor, updatedSince, ...filters } = c.req.query();
    const since = updatedSince ? new Date(updatedSince) : undefined;
    if (since && Number.isNaN(since.getTime())) throw new ClientError('"updatedSince" must be an ISO date.');
    return c.json(
      listRecords(collection, {
        limit: Math.min(Math.max(Number(limit) || 100, 1), 1000),
        cursor,
        updatedSince: since,
        filters,
      })
    );
  });

  v1.get('/collections/:collection/:id', (c) => {
    const collection = asBotCollection(c.req.param('collection'));
    const record = memoryStore.collection(collection).get(c.req.param('id'));
    if (!record) throw new ClientError('Not found.', 404);
    return c.json({ data: record });
  });

  v1.post('/collections/:collection', async (c) => {
    const collection = asBotCollection(c.req.param('collection'));
    const input = await json(c);
    const [id] = await botWrite(() => writeRecords(collection, [input], 'upsert'));
    return c.json({ data: memoryStore.collection(collection).get(id) }, 201);
  });

  v1.patch('/collections/:collection/:id', async (c) => {
    const collection = asBotCollection(c.req.param('collection'));
    const id = c.req.param('id');
    const patch = await json(c);
    await botWrite(() => {
      const map = memoryStore.collection(collection);
      const existing = map.get(id);
      if (!existing) throw new ClientError('Not found.', 404);
      map.set(id, buildRecord(collection, patch, existing));
    });
    return c.json({ data: memoryStore.collection(collection).get(id) });
  });

  v1.delete('/collections/:collection/:id', async (c) => {
    const collection = asBotCollection(c.req.param('collection'));
    const id = c.req.param('id');
    await botWrite(() => {
      if (!memoryStore.collection(collection).delete(id)) throw new ClientError('Not found.', 404);
    });
    return c.json({ deleted: id });
  });

  v1.get('/export', (c) => {
    const names = (c.req.query('collections') || Object.keys(BOT_COLLECTIONS).join(','))
      .split(',')
      .map((n) => asBotCollection(n.trim()));
    const since = c.req.query('updatedSince') ? new Date(c.req.query('updatedSince')!) : undefined;
    const exportedAt = new Date().toISOString();
    const pick = (name: BotCollection) => listRecords(name, { limit: Number.MAX_SAFE_INTEGER, updatedSince: since, filters: {} }).data;

    if (c.req.query('format') === 'ndjson') {
      const lines = names.flatMap((name) => pick(name).map((record) => JSON.stringify({ collection: name, record })));
      c.header('Content-Type', 'application/x-ndjson');
      return c.body(lines.join('\n') + '\n');
    }
    return c.json({ exportedAt, collections: Object.fromEntries(names.map((n) => [n, pick(n)])) });
  });

  v1.post('/import', async (c) => {
    const input = z
      .object({
        mode: z.enum(['upsert', 'insert']).default('upsert'),
        dryRun: z.boolean().default(false),
        collections: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
      })
      .safeParse(await json(c));
    if (!input.success) throw new ClientError(input.error.issues[0]?.message ?? 'Invalid import.');
    const { mode, dryRun, collections } = input.data;

    // Import parents before children so foreign keys resolve within one commit.
    const order = Object.keys(BOT_COLLECTIONS) as BotCollection[];
    for (const name of Object.keys(collections)) asBotCollection(name);
    const DRY_RUN = Symbol('dry-run');
    const counts: Record<string, number> = {};
    try {
      await botWrite(() => {
        for (const name of order) {
          if (collections[name]) counts[name] = writeRecords(name, collections[name], mode).length;
        }
        if (dryRun) throw DRY_RUN; // validated everything; roll back without committing
      });
      console.info(`[bot] import (${mode}) committed:`, counts);
    } catch (err) {
      if (err !== DRY_RUN) throw err;
    }
    return c.json({ dryRun, mode, written: counts });
  });

  v1.post('/actions/:action', async (c) => {
    const name = c.req.param('action');
    const action = ACTIONS[name];
    if (!action) throw new ClientError(`Unknown action "${name}". Available: ${Object.keys(ACTIONS).join(', ')}`, 404);
    const args = await json(c);
    const result = name === 'searchListings' ? await action(args) : await botWrite(() => action(args));
    return c.json({ data: result });
  });

  v1.get('/reports/admin', async (c) => {
    const range = (['7d', '30d', '90d', 'all'].includes(c.req.query('range') ?? '') ? c.req.query('range') : '30d') as ReportRange;
    const admin = Array.from(memoryStore.users.values()).find((u) => getUserById(u.id)?.role === 'ADMIN');
    if (!admin) throw new ClientError('Reports need at least one admin account (set ADMIN_EMAILS).', 409);
    const res = await getExecutiveAdminReport(admin.id, range);
    return c.json(res.data);
  });

  v1.get('/payouts', (c) => c.json({ data: listPayments({ owed: c.req.query('status') !== 'done' }) }));

  v1.get('/payments', (c) =>
    c.json({ data: listPayments({ kind: c.req.query('kind') || undefined, limit: Math.min(Number(c.req.query('limit')) || 200, 1000) }) })
  );

  return v1;
}
