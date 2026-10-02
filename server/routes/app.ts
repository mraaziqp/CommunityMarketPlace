import { Hono, type Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import { memoryStore } from '../../db';
import type { UserModel, UserRole } from '../../src/types';
import { config } from '../config';
import { storeImages } from '../firebase';
import { ClientError, clientIp, rateLimit, requireAppClient, toErrorResponse } from '../http';
import {
  getSessionUser,
  signInAsDemoUser,
  signInWithEmailPassword,
  signOut,
  signUpWithEmailPassword,
  type AuthResult,
} from '../../actions/auth';
import { searchListings } from '../../actions/search';
import { createListing, getListingById } from '../../actions/listings';
import { getActivityForUser } from '../../actions/activity';
import { createTrustGroup, getTrustGroups, getUserMemberGroupIds, joinTrustGroup } from '../../actions/groups';
import { logFractionalUse, subscribeToListing } from '../../actions/usage';
import { confirmHandover, createBooking } from '../../actions/bookings';
import { confirmReturn, initiateDispute } from '../../actions/returns';
import { createReview } from '../../actions/reviews';
import { changePassword, setUserRole, setUserSuspended, updateProfile } from '../../actions/auth';
import {
  deleteListing,
  getHostListings,
  getMemberDashboard,
  listAllListings,
  listMembers,
  updateListing,
} from '../../actions/hosting';
import { getExecutiveAdminReport, type ReportRange } from '../../actions/admin';
import {
  listPayments,
  markSettlement,
  startBookingCheckout,
  startSubscriptionCheckout,
  startTestPayment,
} from '../../actions/payments';

export const SESSION_COOKIE = 'sharehub_session';

type Env = { Variables: { user: UserModel | null } };

function requireUser(c: Context<Env>): UserModel {
  const user = c.get('user');
  if (!user) throw new ClientError('Please sign in to continue.', 401);
  return user;
}

function requireAdmin(c: Context<Env>): UserModel {
  const user = requireUser(c);
  if (user.role !== 'ADMIN') throw new ClientError('Not found.', 404);
  return user;
}

async function body<T extends z.ZodTypeAny>(c: Context, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ClientError('Expected a JSON body.');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ClientError(parsed.error.issues[0]?.message ?? 'Invalid request.');
  return parsed.data;
}

function startSessionCookie(c: Context, result: AuthResult) {
  if ('error' in result) throw new ClientError(result.error, result.error.startsWith('Incorrect') ? 401 : 400);
  setCookie(c, SESSION_COOKIE, result.session.token, {
    httpOnly: true,
    secure: config().isProduction,
    sameSite: 'Lax',
    path: '/',
    expires: new Date(result.session.expiresAt!),
  });
  return { user: result.session.user };
}

/** Private-circle listings are only visible to members, the host and admins. */
function canSeeListing(user: UserModel | null, listingId: string): boolean {
  const row = memoryStore.listings.get(listingId);
  if (!row) return false;
  const isOwnerOrAdmin = !!user && (user.role === 'ADMIN' || row.ownerId === user.id);
  // Paused listings and those of suspended hosts are only visible to the host and admins.
  if ((!row.isAvailable || memoryStore.users.get(row.ownerId)?.suspendedAt) && !isOwnerOrAdmin) return false;
  if (!row.visibilityGroupId || isOwnerOrAdmin) return true;
  if (!user) return false;
  return Array.from(memoryStore.groupMemberships.values()).some(
    (m) => m.groupId === row.visibilityGroupId && m.userId === user.id && m.status === 'ACTIVE'
  );
}

const write = <T>(fn: () => Promise<T> | T) => memoryStore.runExclusive(fn);

export function appRoutes() {
  const api = new Hono<Env>();

  api.use('*', async (c, next) => {
    c.set('user', getSessionUser(getCookie(c, SESSION_COOKIE)));
    await next();
  });
  api.use('*', requireAppClient);
  api.onError((err, c) => toErrorResponse(c, err));

  api.get('/config', (c) =>
    c.json({ demoMode: config().demoMode, payments: { provider: 'payfast', mode: config().payfast.mode } })
  );

  // --- Accounts ---
  const authLimit = rateLimit('auth', config().authRateLimitPerMinute, 60_000);
  const meta = (c: Context) => ({ ipAddress: clientIp(c), userAgent: c.req.header('user-agent') ?? null });

  api.get('/auth/session', (c) => c.json({ user: c.get('user') }));

  api.post('/auth/signup', authLimit, async (c) => {
    const input = await body(c, z.object({ name: z.string(), email: z.string(), password: z.string(), neighborhood: z.string().optional() }));
    return c.json(startSessionCookie(c, await write(() => signUpWithEmailPassword(input, meta(c)))));
  });

  api.post('/auth/signin', authLimit, async (c) => {
    const input = await body(c, z.object({ email: z.string(), password: z.string() }));
    return c.json(startSessionCookie(c, await write(() => signInWithEmailPassword(input, meta(c)))));
  });

  api.post('/auth/demo', authLimit, async (c) => {
    const { role } = await body(c, z.object({ role: z.enum(['USER', 'VERIFIED_HOST', 'ADMIN']) }));
    return c.json(startSessionCookie(c, await write(() => signInAsDemoUser(role as UserRole, meta(c)))));
  });

  api.post('/auth/signout', async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    await write(() => signOut(token));
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  // --- Discovery ---
  api.get('/listings', async (c) => {
    const q = c.req.query();
    const num = (v?: string) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : undefined);
    const user = c.get('user');
    const groupId = q.groupId || undefined;
    if (groupId && !(await getUserMemberGroupIds(user?.id ?? null)).includes(groupId) && user?.role !== 'ADMIN') {
      return c.json({ listings: [], totalCount: 0, appliedRadiusKm: 0 });
    }
    const result = await searchListings({
      searchTerm: q.searchTerm,
      categorySlug: q.categorySlug || undefined,
      latitude: num(q.lat) ?? null,
      longitude: num(q.lng) ?? null,
      radiusInKm: num(q.radiusKm),
      city: q.city || undefined,
      visibilityGroupId: groupId,
      userMemberGroupIds: await getUserMemberGroupIds(user?.id ?? null),
      limit: Math.min(num(q.limit) ?? 60, 100),
      offset: num(q.offset) ?? 0,
    });
    return c.json(result);
  });

  api.get('/listings/:id', async (c) => {
    const id = c.req.param('id');
    if (!canSeeListing(c.get('user'), id)) throw new ClientError('Listing not found.', 404);
    return c.json({ listing: await getListingById(id) });
  });

  api.post('/listings', rateLimit('listings', 20, 60 * 60_000), async (c) => {
    const user = requireUser(c);
    const input = (await body(c, z.object({}).passthrough())) as any;
    // Photos go to Firebase Storage when configured (uploaded before taking the write lock).
    const images = await storeImages(input.images, 'listings');
    const result = await write(() => createListing({ ...input, images, ownerId: user.id }));
    if (!result.success) throw new ClientError(result.error || 'We could not publish your listing.');
    return c.json({ listing: result.listing });
  });

  // --- Circles ---
  api.get('/circles', async (c) => c.json({ circles: await getTrustGroups(c.get('user')?.id ?? null) }));

  api.post('/circles', async (c) => {
    const user = requireUser(c);
    const input = await body(c, z.object({ name: z.string(), description: z.string().optional(), icon: z.string().optional() }));
    const res = await write(() => createTrustGroup({ ...input, adminId: user.id }));
    return c.json({ circle: res.group });
  });

  api.post('/circles/join', rateLimit('join-circle', 10, 60_000), async (c) => {
    const user = requireUser(c);
    const { inviteCode } = await body(c, z.object({ inviteCode: z.string() }));
    const res = await write(() => joinTrustGroup(inviteCode, user.id));
    return c.json({ circle: res.group });
  });

  // --- Member activity ---
  api.get('/me/activity', async (c) => c.json(await write(() => getActivityForUser(requireUser(c).id))));

  // --- Co-ops ---
  api.post('/coops/join', async (c) => {
    const user = requireUser(c);
    const { listingId, tierId } = await body(c, z.object({ listingId: z.string(), tierId: z.string() }));
    if (!canSeeListing(user, listingId)) throw new ClientError('Listing not found.', 404);
    return c.json(
      await write(async () => {
        const { subscriptionId } = await subscribeToListing(user.id, listingId, tierId);
        return { subscriptionId, checkout: await startSubscriptionCheckout(subscriptionId, user.id) };
      })
    );
  });

  api.post('/subscriptions/:id/checkout', async (c) => {
    const user = requireUser(c);
    return c.json({ checkout: await write(() => startSubscriptionCheckout(c.req.param('id'), user.id)) });
  });

  api.post('/subscriptions/:id/use', async (c) => {
    const user = requireUser(c);
    const { notes } = await body(c, z.object({ notes: z.string().max(500).optional() }));
    return c.json(await write(() => logFractionalUse(c.req.param('id'), user.id, notes)));
  });

  // --- Rentals ---
  api.post('/bookings', async (c) => {
    const user = requireUser(c);
    const input = await body(
      c,
      z.object({ listingId: z.string(), tierId: z.string(), startDate: z.string(), endDate: z.string() })
    );
    if (!canSeeListing(user, input.listingId)) throw new ClientError('Listing not found.', 404);
    return c.json(
      await write(async () => {
        const { booking } = await createBooking({
          listingId: input.listingId,
          renterId: user.id,
          pricingTierId: input.tierId,
          startDate: input.startDate,
          endDate: input.endDate,
        });
        return { booking, checkout: await startBookingCheckout(booking.id, user.id) };
      })
    );
  });

  api.post('/bookings/:id/checkout', async (c) => {
    const user = requireUser(c);
    return c.json({ checkout: await write(() => startBookingCheckout(c.req.param('id'), user.id)) });
  });

  api.post('/bookings/:id/pickup', rateLimit('pickup', 10, 60_000), async (c) => {
    const user = requireUser(c);
    const { code } = await body(c, z.object({ code: z.string() }));
    return c.json(await write(() => confirmHandover(c.req.param('id'), code, user.id)));
  });

  const photos = z.array(z.string().max(2_000_000)).max(6).default([]);

  api.post('/bookings/:id/return', async (c) => {
    const user = requireUser(c);
    const input = await body(c, z.object({ condition: z.enum(['GOOD', 'MINOR_WEAR']), notes: z.string().max(1000).default(''), photos }));
    const photoUrls = await storeImages(input.photos, 'returns');
    await write(() => confirmReturn(c.req.param('id'), input.condition, input.notes || 'Checked in by host.', photoUrls, user.id));
    return c.json({ ok: true });
  });

  api.post('/bookings/:id/dispute', async (c) => {
    const user = requireUser(c);
    const input = await body(c, z.object({ notes: z.string().max(1000), photos }));
    const photoUrls = await storeImages(input.photos, 'returns');
    await write(() => initiateDispute(c.req.param('id'), 'DAMAGED', input.notes, photoUrls, user.id));
    return c.json({ ok: true });
  });

  api.post('/bookings/:id/review', async (c) => {
    const user = requireUser(c);
    const rating = z.number().int().min(1).max(5);
    const input = await body(
      c,
      z.object({
        rating,
        comment: z.string().min(3).max(2000),
        cleanlinessRating: rating.optional(),
        communicationRating: rating.optional(),
        accuracyRating: rating.optional(),
      })
    );
    const res = await write(() => createReview({ ...input, bookingId: c.req.param('id'), reviewerId: user.id }));
    return c.json({ review: res.review, newTrustScore: res.newTrustScore });
  });

  // --- Personal dashboard ---
  api.get('/me/dashboard', (c) => c.json(getMemberDashboard(requireUser(c).id)));
  api.get('/me/listings', (c) => c.json({ listings: getHostListings(requireUser(c).id) }));

  const tierInput = z.object({
    id: z.string().optional(),
    name: z.string(),
    type: z.enum(['nightly', 'hourly', 'daily', 'monthly_subscription', 'usage_pack']).optional(),
    priceInCents: z.number(),
    usageLimitPerPeriod: z.number().int().nullable().optional(),
    isActive: z.boolean().optional(),
  });
  const listingPatch = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    images: z.array(z.string().max(4_000_000)).max(12).optional(),
    rules: z.string().nullable().optional(),
    address: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string().optional(),
    depositRequiredInCents: z.number().optional(),
    maxSubscribers: z.number().optional(),
    isAvailable: z.boolean().optional(),
    visibilityGroupId: z.string().nullable().optional(),
    tiers: z.array(tierInput).max(6).optional(),
  });

  api.post('/listings/:id/update', async (c) => {
    const user = requireUser(c);
    const patch = await body(c, listingPatch);
    if (patch.images) patch.images = await storeImages(patch.images, 'listings');
    return c.json({ listing: await write(() => updateListing(user, c.req.param('id'), patch)) });
  });

  api.post('/listings/:id/delete', async (c) => {
    const user = requireUser(c);
    await write(() => deleteListing(user, c.req.param('id')));
    return c.json({ ok: true });
  });

  api.post('/me/profile', async (c) => {
    const user = requireUser(c);
    const patch = await body(
      c,
      z.object({
        name: z.string().optional(),
        bio: z.string().nullable().optional(),
        neighborhood: z.string().nullable().optional(),
        phoneNumber: z.string().nullable().optional(),
        image: z.string().max(2_000_000).nullable().optional(),
      })
    );
    if (patch.image && patch.image.startsWith('data:')) patch.image = (await storeImages([patch.image], 'avatars'))[0];
    return c.json({ user: await write(() => updateProfile(user.id, patch)) });
  });

  api.post('/me/password', rateLimit('password', 5, 60_000), async (c) => {
    const user = requireUser(c);
    const { currentPassword, newPassword } = await body(c, z.object({ currentPassword: z.string(), newPassword: z.string() }));
    await write(() => changePassword(user.id, currentPassword, newPassword, getCookie(c, SESSION_COOKIE)));
    return c.json({ ok: true });
  });

  // --- Admin ---
  api.get('/admin/members', (c) => {
    requireAdmin(c);
    return c.json({ members: listMembers(c.req.query('search') ?? '') });
  });

  api.post('/admin/members/:id/role', async (c) => {
    requireAdmin(c);
    const { role } = await body(c, z.object({ role: z.enum(['USER', 'VERIFIED_HOST']) }));
    return c.json({ user: await write(() => setUserRole(c.req.param('id'), role)) });
  });

  api.post('/admin/members/:id/suspend', async (c) => {
    const admin = requireAdmin(c);
    const { suspended } = await body(c, z.object({ suspended: z.boolean() }));
    return c.json({ user: await write(() => setUserSuspended(c.req.param('id'), suspended, admin.id)) });
  });

  api.get('/admin/listings', (c) => {
    requireAdmin(c);
    return c.json({ listings: listAllListings(c.req.query('search') ?? '') });
  });
  api.get('/admin/report', async (c) => {
    const admin = requireAdmin(c);
    const range = (['7d', '30d', '90d', 'all'].includes(c.req.query('range') ?? '') ? c.req.query('range') : '30d') as ReportRange;
    const res = await getExecutiveAdminReport(admin.id, range);
    if (!res.success) throw new ClientError(res.error || 'Not found.', 404);
    return c.json(res.data);
  });

  api.get('/admin/payments', (c) => {
    requireAdmin(c);
    const kind = c.req.query('kind') || undefined;
    return c.json({ payments: listPayments({ kind, owed: c.req.query('owed') === 'true' }) });
  });

  // Real PayFast checkout for an amount the admin chooses, to verify the live gateway.
  api.post('/admin/test-payment', rateLimit('test-payment', 10, 60 * 60_000), async (c) => {
    const admin = requireAdmin(c);
    const { amountInCents, recurring } = await body(c, z.object({ amountInCents: z.number().int(), recurring: z.boolean().default(false) }));
    return c.json({ checkout: await write(() => startTestPayment(admin.id, amountInCents, recurring)) });
  });

  api.post('/admin/payments/:id/settle', async (c) => {
    const admin = requireAdmin(c);
    const { what } = await body(c, z.object({ what: z.enum(['hostPayout', 'depositRefund']) }));
    await write(() => markSettlement(c.req.param('id'), what, admin.id));
    return c.json({ ok: true });
  });

  return api;
}
