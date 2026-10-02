/**
 * End-to-end tests for the ShareHub server against an embedded Postgres
 * (PGlite) — the same migrations and SQL as production.
 *
 *   npm test
 */
process.env.NODE_ENV = 'test';
// Never let tests reach a real database, even if DATABASE_URL is set in the shell.
process.env.DATABASE_URL = '';
process.env.BOT_WEBHOOK_URL = '';
process.env.RESEND_API_KEY = '';
process.env.LOCAL_DATA_DIR = 'memory://';
process.env.DEMO_MODE = 'true';
process.env.ADMIN_EMAILS = 'boss@example.com';
process.env.BOT_API_KEYS = 'test-bot-key-0123456789abcdefghijklmnop';
process.env.PAYFAST_MODE = 'sandbox';
process.env.PAYFAST_VERIFY_SOURCE_IP = 'false';
process.env.PUBLIC_APP_URL = 'https://sharehub.example.test';
process.env.AUTH_RATE_LIMIT_PER_MINUTE = '1000';

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from '../../db';
import { config } from '../config';
import { connectDatabase, type Database } from '../persistence';
import { createApp } from '../app';
import { md5, pfEncode, signCheckoutFields } from '../payfast';
import { emailsForEvent } from '../notifications';
import { renderEmail } from '../email';

const BOT_KEY = process.env.BOT_API_KEYS!;
let db: Database;
let app: ReturnType<typeof createApp>;
let validateCalls = 0;

before(async () => {
  db = await connectDatabase(config());
  await memoryStore.hydrate(db.adapter);
  await memoryStore.runExclusive(() => memoryStore.seedDemoData({ includeAdmin: true }));
  app = createApp({
    ping: db.ping,
    fetchImpl: (async () => {
      validateCalls++;
      return new Response('VALID');
    }) as typeof fetch,
  });
});

/** A tiny client that keeps its own session cookie, like a browser tab. */
function client() {
  let cookie = '';
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await app.request(path, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-sharehub-client': 'web',
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0].endsWith('=') ? '' : setCookie.split(';')[0];
    const text = await res.text();
    let data: any = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* plain text */
    }
    return { status: res.status, data };
  };
  return {
    get: (p: string) => call('GET', p),
    post: (p: string, b?: unknown, h?: Record<string, string>) => call('POST', p, b ?? {}, h),
  };
}

function bot(method: string, path: string, body?: unknown, key = BOT_KEY) {
  return Promise.resolve(app.request(`/api/v1${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    }))
    .then(async (r) => ({ status: r.status, data: r.headers.get('content-type')?.startsWith('application/json') ? await r.json() : await r.text() }));
}

/** Simulates a PayFast ITN for a payment, signed with the configured passphrase. */
async function sendItn(fields: Record<string, string>, opts: { tamper?: boolean } = {}) {
  const pf = config().payfast;
  const entries = Object.entries({ merchant_id: pf.merchantId, ...fields });
  const base = entries.map(([k, v]) => `${k}=${pfEncode(v)}`).join('&');
  let signature = md5(`${base}&passphrase=${pfEncode(pf.passphrase)}`);
  if (opts.tamper) signature = signature.replace(/.$/, (ch) => (ch === 'a' ? 'b' : 'a'));
  const form = new URLSearchParams([...entries, ['signature', signature]]).toString();
  const res = await app.request('/api/webhooks/payfast', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  return { status: res.status, text: await res.text() };
}

const itnFor = (checkout: any, extra: Record<string, string> = {}) => ({
  m_payment_id: checkout.fields.m_payment_id,
  pf_payment_id: String(Math.floor(Math.random() * 1e9)),
  payment_status: 'COMPLETE',
  item_name: checkout.fields.item_name,
  amount_gross: checkout.fields.amount,
  amount_fee: '-2.30',
  amount_net: (Number(checkout.fields.amount) - 2.3).toFixed(2),
  custom_str1: checkout.fields.custom_str1,
  custom_str2: checkout.fields.custom_str2,
  custom_str3: checkout.fields.custom_str3,
  name_first: checkout.fields.name_first,
  email_address: checkout.fields.email_address,
  ...extra,
});

const future = (days: number) => new Date(Date.now() + days * 86400000).toISOString();

test('PayFast encoding matches PHP urlencode (the gateway rejects anything else)', () => {
  assert.equal(pfEncode("O'Brien (Co-Op) 10% off! *~"), 'O%27Brien+%28Co-Op%29+10%25+off%21+%2A%7E');
  assert.equal(pfEncode(' https://a.b/c?d=e&f=g '), 'https%3A%2F%2Fa.b%2Fc%3Fd%3De%26f%3Dg');
  assert.equal(pfEncode('snake_case-dash.dot'), 'snake_case-dash.dot');
});

test('health and config', async () => {
  const c = client();
  assert.equal((await c.get('/api/health')).status, 200);
  const cfg = await c.get('/api/config');
  assert.equal(cfg.data.payments.mode, 'sandbox');
  assert.ok(!JSON.stringify(cfg.data).includes(config().payfast.passphrase), 'config never leaks the passphrase');
});

test('accounts: sign-up is always a member, admin only via ADMIN_EMAILS, passwords checked', async () => {
  const a = client();
  const up = await a.post('/api/auth/signup', { name: 'Admin Fan', email: 'admin.fan@example.com', password: 'longpassword' });
  assert.equal(up.status, 200);
  assert.equal(up.data.user.role, 'USER');
  assert.equal((await a.get('/api/auth/session')).data.user.email, 'admin.fan@example.com');

  const boss = client();
  assert.equal((await boss.post('/api/auth/signup', { name: 'Boss', email: 'Boss@Example.com', password: 'longpassword' })).data.user.role, 'ADMIN');

  const wrong = await client().post('/api/auth/signin', { email: 'admin.fan@example.com', password: 'nope-nope' });
  assert.equal(wrong.status, 401);
  assert.equal((await client().post('/api/auth/signin', { email: 'admin.fan@example.com', password: 'longpassword' })).status, 200);

  const stored = Array.from(memoryStore.accounts.values()).find((acct) => acct.password);
  assert.ok(stored?.password?.startsWith('scrypt$'), 'passwords are hashed');
  assert.ok(Array.from(memoryStore.sessions.values()).every((s) => s.token.length === 64), 'only token hashes are stored');

  await a.post('/api/auth/signout');
  assert.equal((await a.get('/api/auth/session')).data.user, null);
});

test('requests without the app header are refused (CSRF guard)', async () => {
  const res = await app.request('/api/auth/signin', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
  assert.equal(res.status, 403);
});

test('private circle listings are hidden from non-members', async () => {
  const guest = client();
  const member = client();
  await member.post('/api/auth/demo', { role: 'USER' });
  assert.equal((await guest.get('/api/listings')).data.listings.length, 7);
  assert.equal((await member.get('/api/listings')).data.listings.length, 9);
  assert.equal((await guest.get('/api/listings/list_wm_001')).status, 404);
  assert.equal((await member.get('/api/listings/list_wm_001')).status, 200);
  assert.equal((await member.get('/api/listings?searchTerm=thule')).data.listings[0].id, 'list_thule_001');
});

test('admin report: 404 for members, data for admins', async () => {
  const member = client();
  await member.post('/api/auth/demo', { role: 'USER' });
  assert.equal((await member.get('/api/admin/report')).status, 404);
  const admin = client();
  await admin.post('/api/auth/signin', { email: 'boss@example.com', password: 'longpassword' });
  const report = await admin.get('/api/admin/report?range=all');
  assert.equal(report.status, 200);
  assert.ok(report.data.kpis.totalUsersCount > 0);
});

test('rental: book → PayFast checkout → ITN → pickup → return → payout due → review', async () => {
  const renter = client();
  await renter.post('/api/auth/demo', { role: 'USER' });
  const listing = (await renter.get('/api/listings/list_item_dewalt')).data.listing;

  const booked = await renter.post('/api/bookings', {
    listingId: listing.id,
    tierId: listing.pricingTiers[0].id,
    startDate: future(4),
    endDate: future(6),
  });
  assert.equal(booked.status, 200, JSON.stringify(booked.data));
  const { checkout, booking } = booked.data;
  assert.equal(booking.status, 'PENDING_PAYMENT');
  assert.equal(checkout.actionUrl, 'https://sandbox.payfast.co.za/eng/process');
  assert.equal(checkout.fields.notify_url, 'https://sharehub.example.test/api/webhooks/payfast');
  assert.equal(checkout.fields.custom_str1, 'sharehub');
  const expectedCents = booking.totalAmountInCents + booking.depositAmountInCents;
  assert.equal(checkout.fields.amount, (expectedCents / 100).toFixed(2));
  const { signature, ...unsigned } = checkout.fields;
  assert.equal(signature, signCheckoutFields(Object.entries(unsigned), config().payfast.passphrase), 'form signature verifies');
  assert.ok(!Object.values(checkout.fields).includes(config().payfast.passphrase), 'passphrase never sent to the browser');

  // Pickup is refused until PayFast confirms payment.
  assert.equal((await renter.post(`/api/bookings/${booking.id}/pickup`, { code: 'PICKUP-0000' })).status, 400);

  assert.equal((await sendItn(itnFor(checkout), { tamper: true })).status, 400, 'bad signature rejected');
  assert.equal((await sendItn(itnFor(checkout, { amount_gross: '1.00' }))).status, 400, 'wrong amount rejected');
  const itn = itnFor(checkout);
  const calls = validateCalls;
  const applied = await sendItn(itn);
  assert.equal(applied.status, 200);
  assert.equal(applied.text, 'applied');
  assert.ok(validateCalls > calls, 'confirmed with PayFast server-to-server');
  assert.equal((await sendItn(itn)).text, 'ignored', 'replayed notification changes nothing');

  const paid = memoryStore.bookings.get(booking.id)!;
  assert.equal(paid.status, 'PENDING_HANDOVER');

  // The renter never sees the pickup code; the host does.
  const renterView = (await renter.get('/api/me/activity')).data.bookings.find((b: any) => b.id === booking.id);
  assert.equal(renterView.verificationCode, '');
  assert.equal(renterView.payment.status, 'HELD_IN_ESCROW');

  assert.equal((await renter.post(`/api/bookings/${booking.id}/pickup`, { code: 'MASTER_BYPASS' })).status, 400);
  assert.equal((await renter.post(`/api/bookings/${booking.id}/pickup`, { code: paid.verificationCode })).status, 200);

  // Renter cannot sign off their own return; the host (via the bot, acting as them) can.
  assert.equal((await renter.post(`/api/bookings/${booking.id}/return`, { condition: 'GOOD' })).status, 400);
  const ret = await bot('POST', '/actions/confirmReturn', { actingUserId: listing.owner.id, bookingId: booking.id, condition: 'GOOD' });
  assert.equal(ret.status, 200, JSON.stringify(ret.data));

  const payouts = (await bot('GET', '/payouts?status=due')).data.data;
  const due = payouts.find((p: any) => p.id === checkout.fields.m_payment_id);
  assert.equal(due.hostPayout.amountInCents, Math.round(booking.totalAmountInCents * 0.9));
  assert.equal(due.depositRefund.status, 'due');

  const review = await renter.post(`/api/bookings/${booking.id}/review`, { rating: 5, comment: 'Great drill, easy pickup.' });
  assert.equal(review.status, 200);
  assert.equal(review.data.review.targetId, listing.owner.id);
  assert.equal((await renter.post(`/api/bookings/${booking.id}/review`, { rating: 4, comment: 'again' })).status, 400);
});

test('co-op: join → recurring PayFast checkout → activate → renew → cancel', async () => {
  const member = client();
  await member.post('/api/auth/signup', { name: 'Coop Member', email: 'coop@example.com', password: 'longpassword' });
  const solar = (await member.get('/api/listings/list_solar_001')).data.listing;
  const before = memoryStore.listings.get(solar.id)!.currentSubscribersCount;

  const joined = await member.post('/api/coops/join', { listingId: solar.id, tierId: solar.pricingTiers[0].id });
  assert.equal(joined.status, 200, JSON.stringify(joined.data));
  const { checkout, subscriptionId } = joined.data;
  assert.equal(checkout.fields.subscription_type, '1');
  assert.equal(checkout.fields.frequency, '3');
  assert.equal(memoryStore.userSubscriptions.get(subscriptionId)!.status, 'pending_payment');

  assert.equal((await sendItn(itnFor(checkout, { token: 'tok-123' }))).text, 'applied');
  const sub = memoryStore.userSubscriptions.get(subscriptionId)!;
  assert.equal(sub.status, 'active');
  assert.equal(sub.gatewayToken, 'tok-123');
  assert.equal(memoryStore.listings.get(solar.id)!.currentSubscribersCount, before + 1);
  assert.equal((await member.post(`/api/subscriptions/${subscriptionId}/use`, { notes: 'Evening charge' })).status, 200);

  const renewal = await sendItn({
    m_payment_id: 'unknown-renewal',
    pf_payment_id: 'renew-1',
    payment_status: 'COMPLETE',
    amount_gross: checkout.fields.recurring_amount,
    token: 'tok-123',
    custom_str1: 'sharehub',
  });
  assert.equal(renewal.text, 'applied');
  assert.equal(memoryStore.userSubscriptions.get(subscriptionId)!.totalUsesUsed, 0, 'renewal refreshes the allowance');

  assert.equal((await sendItn({ m_payment_id: '', pf_payment_id: 'cancel-1', payment_status: 'CANCELLED', token: 'tok-123', custom_str1: 'sharehub' })).text, 'applied');
  assert.equal(memoryStore.userSubscriptions.get(subscriptionId)!.status, 'cancelled');
  assert.equal(memoryStore.listings.get(solar.id)!.currentSubscribersCount, before);
});

test('admin live test payment: any amount, once-off or monthly', async () => {
  const member = client();
  await member.post('/api/auth/demo', { role: 'USER' });
  assert.equal((await member.post('/api/admin/test-payment', { amountInCents: 500 })).status, 404, 'members cannot start test payments');

  const admin = client();
  await admin.post('/api/auth/signin', { email: 'boss@example.com', password: 'longpassword' });
  assert.equal((await admin.post('/api/admin/test-payment', { amountInCents: 100 })).status, 400, 'below PayFast minimum');

  const once = (await admin.post('/api/admin/test-payment', { amountInCents: 1234 })).data.checkout;
  assert.equal(once.fields.amount, '12.34');
  assert.equal(once.fields.custom_str2, 'test');
  assert.equal(once.fields.subscription_type, undefined);
  assert.equal((await sendItn(itnFor(once))).text, 'applied');
  assert.equal(memoryStore.payments.get(once.fields.m_payment_id)!.status, 'CAPTURED');

  const monthly = (await admin.post('/api/admin/test-payment', { amountInCents: 700, recurring: true })).data.checkout;
  assert.equal(monthly.fields.recurring_amount, '7.00');
  assert.equal((await sendItn(itnFor(monthly, { token: 'test-tok' }))).text, 'applied');
  const renew = await sendItn({ m_payment_id: '', pf_payment_id: 'test-renew-1', payment_status: 'COMPLETE', amount_gross: '7.00', token: 'test-tok', custom_str1: 'sharehub' });
  assert.equal(renew.text, 'applied');
  const listed = (await admin.get('/api/admin/payments?kind=test')).data.payments;
  assert.equal(listed.filter((p: any) => p.status === 'CAPTURED').length, 3);
});

test('notifications for other ecosystem apps are ignored', async () => {
  const res = await sendItn({ m_payment_id: 'x', pf_payment_id: 'y', payment_status: 'COMPLETE', amount_gross: '1.00', custom_str1: 'another-app' });
  assert.equal(res.status, 200);
  assert.equal(res.text, 'not for this app');
});

test('bot API: auth, read, write, export, import, actions', async () => {
  assert.equal((await bot('GET', '/', undefined, 'wrong-key')).status, 401);
  const index = await bot('GET', '/');
  assert.equal(index.status, 200);
  assert.ok(!index.data.collections.includes('accounts') && !index.data.collections.includes('sessions'));

  const listings = await bot('GET', '/collections/listings?limit=2');
  assert.equal(listings.data.data.length, 2);
  assert.ok(listings.data.nextCursor);
  const filtered = await bot('GET', '/collections/listings?category=fractional_appliance');
  assert.ok(filtered.data.data.every((l: any) => l.category === 'fractional_appliance'));

  const created = await bot('POST', '/collections/users', { name: 'Bot Made', email: 'botmade@example.com' });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.data.role, 'USER');
  const promoted = await bot('PATCH', `/collections/users/${created.data.data.id}`, { role: 'VERIFIED_HOST' });
  assert.equal(promoted.data.data.role, 'VERIFIED_HOST');
  assert.equal((await bot('PATCH', `/collections/users/${created.data.data.id}`, { role: 'KING' })).status, 400);

  const exported = await bot('GET', '/export?collections=users,listings');
  assert.ok(exported.data.collections.users.length > 0);
  assert.ok(!JSON.stringify(exported.data).includes('scrypt$'), 'no password hashes in exports');
  const ndjson = await bot('GET', '/export?collections=reviews&format=ndjson');
  assert.ok(String(ndjson.data).trim().split('\n').every((line) => JSON.parse(line).collection === 'reviews'));

  const dry = await bot('POST', '/import', { dryRun: true, collections: { users: [{ id: 'usr_dry', name: 'Dry', email: 'dry@example.com' }] } });
  assert.equal(dry.data.written.users, 1);
  assert.equal(memoryStore.users.has('usr_dry'), false, 'dry run changes nothing');

  const bad = await bot('POST', '/import', {
    collections: { reviews: [{ bookingId: 'book_missing', reviewerId: 'usr_me', targetId: 'usr_me', rating: 5, comment: 'x' }] },
  });
  assert.equal(bad.status, 400, 'foreign key violation is rejected');
  assert.match(bad.data.error, /database/);

  const imported = await bot('POST', '/import', {
    collections: {
      users: [{ id: 'usr_imported', name: 'Imported Host', email: 'imported@example.com', isHost: true }],
      trustGroups: [{ id: 'grp_imported', name: 'Imported Circle', inviteCode: 'IMPORT-01', adminId: 'usr_imported' }],
    },
  });
  assert.equal(imported.status, 200, JSON.stringify(imported.data));

  const act = await bot('POST', '/actions/searchListings', { searchTerm: 'washer' });
  assert.equal(act.status, 200);
  const report = await bot('GET', '/reports/admin?range=all');
  assert.equal(report.status, 200);
});

test('failed writes roll back, and everything survives a restart', async () => {
  const renter = client();
  await renter.post('/api/auth/demo', { role: 'USER' });
  const bookingsBefore = memoryStore.bookings.size;
  const res = await renter.post('/api/bookings', { listingId: 'list_item_dewalt', tierId: 'no-such-tier', startDate: future(20), endDate: future(21) });
  assert.equal(res.status, 400);
  assert.equal(memoryStore.bookings.size, bookingsBefore);

  const snapshot = {
    users: memoryStore.users.size,
    bookings: memoryStore.bookings.size,
    payments: memoryStore.payments.size,
    reviews: memoryStore.reviews.size,
    subs: memoryStore.userSubscriptions.size,
  };
  memoryStore.resetForTests();
  await memoryStore.hydrate(db.adapter);
  assert.deepEqual(
    {
      users: memoryStore.users.size,
      bookings: memoryStore.bookings.size,
      payments: memoryStore.payments.size,
      reviews: memoryStore.reviews.size,
      subs: memoryStore.userSubscriptions.size,
    },
    snapshot
  );
  assert.equal(memoryStore.users.get('usr_imported')?.name, 'Imported Host');
});

test('host dashboard: my listings with stats, edit, pause, delete rules', async () => {
  const host = client();
  await host.post('/api/auth/signup', { name: 'Hana Host', email: 'hana@example.com', password: 'longpassword' });
  const created = await host.post('/api/listings', {
    title: 'Makita circular saw',
    description: 'Sharp blade, two batteries, case included.',
    category: 'physical_item',
    address: '1 Test Road',
    neighborhood: 'Observatory',
    city: 'Cape Town',
    images: ['https://example.com/saw.jpg'],
    pricingTiers: [{ name: 'Day rate', type: 'daily', priceInCents: 12000, currency: 'ZAR', isActive: true }],
  });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const id = created.data.listing.id;

  const mine = (await host.get('/api/me/listings')).data.listings;
  assert.equal(mine.length, 1);
  assert.equal(mine[0].stats.totalBookings, 0);

  const edited = await host.post(`/api/listings/${id}/update`, {
    title: 'Makita circular saw (190mm)',
    depositRequiredInCents: 30000,
    tiers: [{ id: mine[0].listing.pricingTiers[0].id, name: 'Day rate', priceInCents: 15000 }],
  });
  assert.equal(edited.status, 200, JSON.stringify(edited.data));
  assert.equal(edited.data.listing.pricingTiers[0].priceInCents, 15000);
  assert.equal((await host.post(`/api/listings/${id}/update`, { tiers: [{ name: 'Too cheap', type: 'daily', priceInCents: 100 }] })).status, 400);

  // Someone else cannot edit it.
  const other = client();
  await other.post('/api/auth/signup', { name: 'Not Owner', email: 'notowner@example.com', password: 'longpassword' });
  assert.equal((await other.post(`/api/listings/${id}/update`, { title: 'Hijacked title' })).status, 400);

  // Paused listings disappear for others but stay visible to the host.
  await host.post(`/api/listings/${id}/update`, { isAvailable: false });
  assert.equal((await other.get(`/api/listings/${id}`)).status, 404);
  assert.equal((await host.get(`/api/listings/${id}`)).status, 200);
  await host.post(`/api/listings/${id}/update`, { isAvailable: true });

  // Never-booked listings can be deleted; booked ones must be paused instead.
  assert.equal((await host.post(`/api/listings/${id}/delete`)).status, 200);
  assert.equal((await host.get('/api/me/listings')).data.listings.length, 0);
  const tariq = client();
  await tariq.post('/api/auth/demo', { role: 'VERIFIED_HOST' });
  const booked = Array.from(memoryStore.bookings.values())
    .map((b) => memoryStore.listings.get(b.listingId)!)
    .find((l) => l.ownerId === 'usr_tariq')!;
  assert.equal((await tariq.post(`/api/listings/${booked.id}/delete`)).status, 400);

  const dash = (await tariq.get('/api/me/dashboard')).data;
  assert.ok(dash.stats.listings >= 1);
  assert.ok(Array.isArray(dash.earnings));
});

test('profile and password', async () => {
  const me = client();
  await me.post('/api/auth/signup', { name: 'Pat Profile', email: 'pat@example.com', password: 'longpassword' });
  const updated = await me.post('/api/me/profile', { name: 'Pat P', bio: 'Keen gardener', neighborhood: 'Woodstock', phoneNumber: '+27 82 123 4567' });
  assert.equal(updated.status, 200, JSON.stringify(updated.data));
  assert.equal(updated.data.user.neighborhood, 'Woodstock');
  assert.equal((await me.post('/api/me/profile', { phoneNumber: 'call me' })).status, 400);

  const otherDevice = client();
  await otherDevice.post('/api/auth/signin', { email: 'pat@example.com', password: 'longpassword' });
  assert.equal((await me.post('/api/me/password', { currentPassword: 'wrong-one', newPassword: 'newpassword1' })).status, 400);
  assert.equal((await me.post('/api/me/password', { currentPassword: 'longpassword', newPassword: 'newpassword1' })).status, 200);
  assert.equal((await me.get('/api/auth/session')).data.user?.email, 'pat@example.com', 'this device stays signed in');
  assert.equal((await otherDevice.get('/api/auth/session')).data.user, null, 'other devices are signed out');
  assert.equal((await client().post('/api/auth/signin', { email: 'pat@example.com', password: 'newpassword1' })).status, 200);
});

test('admin: members (role, suspension) and listing moderation', async () => {
  const admin = client();
  await admin.post('/api/auth/signin', { email: 'boss@example.com', password: 'longpassword' });
  const target = client();
  await target.post('/api/auth/signup', { name: 'Sam Suspend', email: 'sam@example.com', password: 'longpassword' });

  const members = (await admin.get('/api/admin/members?search=sam')).data.members;
  assert.equal(members.length, 1);
  const samId = members[0].user.id;

  assert.equal((await admin.post(`/api/admin/members/${samId}/role`, { role: 'VERIFIED_HOST' })).data.user.role, 'VERIFIED_HOST');
  assert.equal((await admin.post(`/api/admin/members/${samId}/role`, { role: 'ADMIN' })).status, 400, 'ADMIN only via ADMIN_EMAILS');

  await admin.post(`/api/admin/members/${samId}/suspend`, { suspended: true });
  assert.equal((await target.get('/api/auth/session')).data.user, null, 'suspension signs the member out');
  assert.equal((await client().post('/api/auth/signin', { email: 'sam@example.com', password: 'longpassword' })).status, 400);
  await admin.post(`/api/admin/members/${samId}/suspend`, { suspended: false });
  assert.equal((await client().post('/api/auth/signin', { email: 'sam@example.com', password: 'longpassword' })).status, 200);

  const listings = (await admin.get('/api/admin/listings?search=thule')).data.listings;
  assert.equal(listings.length, 1);
  const paused = await admin.post(`/api/listings/${listings[0].listing.id}/update`, { isAvailable: false });
  assert.equal(paused.data.listing.isAvailable, false, 'admins can pause any listing');
  await admin.post(`/api/listings/${listings[0].listing.id}/update`, { isAvailable: true });

  const member = client();
  await member.post('/api/auth/demo', { role: 'USER' });
  assert.equal((await member.get('/api/admin/members')).status, 404);
});

test('emails: a paid booking emails the renter and the host (with the pickup code)', () => {
  const held = Array.from(memoryStore.systemLogs.values()).find((l) => l.eventType === 'PAYMENT_HELD' && (l.metadata as any)?.bookingId);
  assert.ok(held, 'a paid booking exists from the rental test');
  const emails = emailsForEvent(held!);
  const booking = memoryStore.bookings.get((held!.metadata as any).bookingId)!;
  assert.equal(emails.length, 2);
  const hostEmail = emails.find((e) => e.content.code?.label === 'Pickup code');
  assert.equal(hostEmail?.content.code?.value, booking.verificationCode);
  const rendered = renderEmail({ ...emails[0].content, heading: '<script>alert(1)</script>' });
  assert.ok(!rendered.html.includes('<script>'), 'email content is escaped');
  assert.ok(rendered.text.length > 20);
});
