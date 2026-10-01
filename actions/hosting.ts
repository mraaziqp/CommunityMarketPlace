import { memoryStore } from '../db';
import type { Listing, PricingTier } from '../db/schema';
import type { ListingCategory, ListingModel, PricingType, UserModel } from '../src/types';
import { getListingRating, toListingModel } from './listings';
import { toUserModel } from './auth';

/**
 * ============================================================================
 * HOSTING & DASHBOARDS
 * A member's own listings (with stats), editing / pausing / deleting them,
 * the figures behind the personal dashboard, and the admin member/listing
 * directories.
 * ============================================================================
 */

type Actor = Pick<UserModel, 'id' | 'role'>;

const HOLD_MS = 30 * 60 * 1000;
const MIN_PRICE_CENTS = 500; // PayFast's minimum transaction is R5.00
const RATE_TYPES: Record<ListingCategory, PricingType[]> = {
  fractional_appliance: ['monthly_subscription', 'usage_pack'],
  physical_item: ['hourly', 'daily'],
  room: ['hourly', 'daily', 'nightly'],
};

const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

function ownedListing(actor: Actor, listingId: string): Listing {
  const listing = memoryStore.listings.get(listingId);
  if (!listing || (listing.ownerId !== actor.id && actor.role !== 'ADMIN')) {
    throw new Error("We couldn't find that listing on your account.");
  }
  return listing;
}

function isLiveBooking(status: string, createdAt: Date) {
  if (status === 'PENDING_HANDOVER' || status === 'ACTIVE') return true;
  return status === 'PENDING_PAYMENT' && Date.now() - createdAt.getTime() < HOLD_MS;
}

// --- My listings -------------------------------------------------------------

export interface HostListingStats {
  totalBookings: number;
  upcomingBookings: number;
  activeMembers: number;
  earningsCents: number;
  rating: number | null;
  reviewCount: number;
}

export interface HostListing {
  listing: ListingModel;
  stats: HostListingStats;
}

function statsFor(listingId: string): HostListingStats {
  const bookings = Array.from(memoryStore.bookings.values()).filter((b) => b.listingId === listingId);
  const subIds = new Set(
    Array.from(memoryStore.userSubscriptions.values())
      .filter((s) => s.listingId === listingId)
      .map((s) => s.id)
  );
  const bookingIds = new Set(bookings.map((b) => b.id));
  let earningsCents = 0;
  for (const p of memoryStore.payments.values()) {
    if ((p.bookingId && bookingIds.has(p.bookingId)) || (p.subscriptionId && subIds.has(p.subscriptionId))) {
      if (p.hostPayoutStatus !== 'none') earningsCents += p.hostPayoutInCents;
    }
  }
  const { rating, reviewCount } = getListingRating(listingId);
  return {
    totalBookings: bookings.filter((b) => b.status !== 'CANCELLED').length,
    upcomingBookings: bookings.filter((b) => isLiveBooking(b.status, b.createdAt)).length,
    activeMembers: Array.from(memoryStore.userSubscriptions.values()).filter((s) => s.listingId === listingId && s.status === 'active').length,
    earningsCents,
    rating: rating ?? null,
    reviewCount,
  };
}

/** Every listing the member hosts, including paused ones, newest first. */
export function getHostListings(userId: string): HostListing[] {
  return Array.from(memoryStore.listings.values())
    .filter((l) => l.ownerId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((row) => ({ listing: toListingModel(row), stats: statsFor(row.id) }));
}

// --- Editing -----------------------------------------------------------------

export interface ListingPatch {
  title?: string;
  description?: string;
  images?: string[];
  rules?: string | null;
  address?: string;
  neighborhood?: string;
  city?: string;
  depositRequiredInCents?: number;
  maxSubscribers?: number;
  isAvailable?: boolean;
  visibilityGroupId?: string | null;
  tiers?: Array<{
    id?: string;
    name: string;
    type?: PricingType;
    priceInCents: number;
    usageLimitPerPeriod?: number | null;
    isActive?: boolean;
  }>;
}

function text(value: string | undefined, label: string, min: number, max: number) {
  const v = (value ?? '').trim();
  if (v.length < min || v.length > max) throw new Error(`${label} must be ${min}–${max} characters.`);
  return v;
}

/** Updates a listing. Owners edit their own; admins can edit any (e.g. to pause it). */
export function updateListing(actor: Actor, listingId: string, patch: ListingPatch): ListingModel {
  const listing = ownedListing(actor, listingId);
  const category = listing.category as ListingCategory;
  const next: Listing = { ...listing, updatedAt: new Date() };

  if (patch.title !== undefined) next.title = text(patch.title, 'Title', 3, 120);
  if (patch.description !== undefined) next.description = text(patch.description, 'Description', 10, 5000);
  if (patch.address !== undefined) next.address = text(patch.address, 'Address', 1, 300);
  if (patch.neighborhood !== undefined) next.neighborhood = text(patch.neighborhood, 'Neighbourhood', 1, 150);
  if (patch.city !== undefined) next.city = text(patch.city, 'City', 1, 100);
  if (patch.rules !== undefined) next.rules = patch.rules?.trim().slice(0, 2000) || null;
  if (patch.images !== undefined) {
    const images = patch.images.filter((i) => typeof i === 'string' && /^(https:\/\/|data:image\/)/.test(i)).slice(0, 12);
    if (images.length === 0) throw new Error('Please keep at least one photo.');
    next.images = images;
  }
  if (patch.depositRequiredInCents !== undefined) {
    const d = Math.round(patch.depositRequiredInCents);
    if (!Number.isFinite(d) || d < 0 || d > 5_000_000) throw new Error('The deposit must be between R0 and R50,000.');
    next.depositRequiredInCents = d;
  }
  if (patch.maxSubscribers !== undefined && category === 'fractional_appliance') {
    const m = Math.round(patch.maxSubscribers);
    if (m < Math.max(1, listing.currentSubscribersCount) || m > 20) {
      throw new Error(`Households must be between ${Math.max(1, listing.currentSubscribersCount)} (current members) and 20.`);
    }
    next.maxSubscribers = m;
  }
  if (patch.isAvailable !== undefined) next.isAvailable = !!patch.isAvailable;
  if (patch.visibilityGroupId !== undefined) {
    const groupId = patch.visibilityGroupId || null;
    if (groupId && actor.role !== 'ADMIN') {
      const member = Array.from(memoryStore.groupMemberships.values()).some(
        (m) => m.groupId === groupId && m.userId === actor.id && m.status === 'ACTIVE'
      );
      if (!member) throw new Error('You can only share privately with circles you belong to.');
    }
    next.visibilityGroupId = groupId;
  }

  if (patch.tiers) {
    const existing = Array.from(memoryStore.pricingTiers.values()).filter((t) => t.listingId === listingId);
    const writes: PricingTier[] = [];
    for (const input of patch.tiers) {
      const price = Math.round(input.priceInCents);
      if (!Number.isFinite(price) || price < MIN_PRICE_CENTS || price > 10_000_000) {
        throw new Error('Each price must be between R5 and R100,000.');
      }
      const name = text(input.name, 'Rate name', 1, 120);
      const current = input.id ? existing.find((t) => t.id === input.id) : undefined;
      if (input.id && !current) throw new Error('That rate no longer exists.');
      const type = (current?.type ?? input.type) as PricingType;
      if (!RATE_TYPES[category].includes(type)) throw new Error('That kind of rate does not fit this listing.');
      const limit = input.usageLimitPerPeriod ?? current?.usageLimitPerPeriod ?? null;
      if ((type === 'monthly_subscription' || type === 'usage_pack') && (!limit || limit < 1 || limit > 200)) {
        throw new Error('Co-op plans need between 1 and 200 turns.');
      }
      writes.push({
        id: current?.id ?? newId('tier'),
        listingId,
        name,
        description: current?.description ?? null,
        type: type as any,
        priceInCents: price,
        currency: 'ZAR',
        usageLimitPerPeriod: type === 'monthly_subscription' || type === 'usage_pack' ? limit : null,
        periodUnit: (type === 'monthly_subscription' ? 'month' : type === 'hourly' ? 'hour' : type === 'usage_pack' ? 'one_time' : 'day') as any,
        periodDuration: 1,
        maxActiveSubscribers: current?.maxActiveSubscribers ?? null,
        isPopular: current?.isPopular ?? false,
        isActive: input.isActive ?? true,
        createdAt: current?.createdAt ?? new Date(),
      });
    }
    if (!writes.some((t) => t.isActive)) throw new Error('Keep at least one active rate.');
    // Rates left out of the update are retired rather than deleted, because
    // past bookings and memberships still refer to them.
    for (const t of existing) {
      if (!writes.some((w) => w.id === t.id)) writes.push({ ...t, isActive: false });
    }
    for (const t of writes) memoryStore.pricingTiers.set(t.id, t);
  }

  memoryStore.listings.set(listingId, next);
  return toListingModel(next);
}

/**
 * Deletes a listing that has never been booked or joined. Anything with
 * history must be paused instead, so payment and booking records survive.
 */
export function deleteListing(actor: Actor, listingId: string) {
  ownedListing(actor, listingId);
  const hasBookings = Array.from(memoryStore.bookings.values()).some((b) => b.listingId === listingId);
  const hasMembers = Array.from(memoryStore.userSubscriptions.values()).some((s) => s.listingId === listingId);
  if (hasBookings || hasMembers) {
    throw new Error('This listing has bookings or members, so it can’t be deleted. Pause it instead to hide it.');
  }
  for (const [id, t] of memoryStore.pricingTiers) if (t.listingId === listingId) memoryStore.pricingTiers.delete(id);
  memoryStore.listings.delete(listingId);
}

// --- Personal dashboard ------------------------------------------------------

export interface EarningRow {
  paymentId: string;
  date: string;
  listingTitle: string;
  kind: string;
  grossCents: number;
  payoutCents: number;
  status: 'due' | 'done';
}

export interface MemberDashboard {
  stats: {
    upcomingRentals: number;
    activeMemberships: number;
    spentCents: number;
    listings: number;
    activeListings: number;
    upcomingHostBookings: number;
    earningsDueCents: number;
    earningsPaidCents: number;
    averageRating: number | null;
  };
  earnings: EarningRow[];
}

export function getMemberDashboard(userId: string): MemberDashboard {
  const myListings = Array.from(memoryStore.listings.values()).filter((l) => l.ownerId === userId);
  const myListingIds = new Set(myListings.map((l) => l.id));
  const bookings = Array.from(memoryStore.bookings.values());
  const subs = Array.from(memoryStore.userSubscriptions.values());

  const earnings: EarningRow[] = [];
  let spentCents = 0;
  for (const p of memoryStore.payments.values()) {
    if (p.payerId === userId && (p.status === 'HELD_IN_ESCROW' || p.status === 'CAPTURED' || p.status === 'FROZEN_ESCROW') && p.kind !== 'test') {
      spentCents += p.amount;
    }
    const booking = p.bookingId ? memoryStore.bookings.get(p.bookingId) : undefined;
    const sub = p.subscriptionId ? memoryStore.userSubscriptions.get(p.subscriptionId) : undefined;
    const listingId = booking?.listingId ?? sub?.listingId;
    if (!listingId || !myListingIds.has(listingId) || p.hostPayoutStatus === 'none') continue;
    earnings.push({
      paymentId: p.id,
      date: (p.escrowReleasedAt ?? p.updatedAt).toISOString(),
      listingTitle: memoryStore.listings.get(listingId)?.title ?? 'Listing',
      kind: p.kind,
      grossCents: p.kind === 'booking' ? booking?.totalAmountInCents ?? p.amount : p.amount,
      payoutCents: p.hostPayoutInCents,
      status: p.hostPayoutStatus as 'due' | 'done',
    });
  }
  earnings.sort((a, b) => b.date.localeCompare(a.date));

  const ratings = myListings.map((l) => getListingRating(l.id)).filter((r) => r.rating !== undefined && r.reviewCount > 0);
  const totalReviews = ratings.reduce((n, r) => n + r.reviewCount, 0);

  return {
    stats: {
      upcomingRentals: bookings.filter((b) => b.renterId === userId && isLiveBooking(b.status, b.createdAt)).length,
      activeMemberships: subs.filter((s) => s.userId === userId && s.status === 'active').length,
      spentCents,
      listings: myListings.length,
      activeListings: myListings.filter((l) => l.isAvailable).length,
      upcomingHostBookings: bookings.filter((b) => myListingIds.has(b.listingId) && isLiveBooking(b.status, b.createdAt)).length,
      earningsDueCents: earnings.filter((e) => e.status === 'due').reduce((n, e) => n + e.payoutCents, 0),
      earningsPaidCents: earnings.filter((e) => e.status === 'done').reduce((n, e) => n + e.payoutCents, 0),
      averageRating: totalReviews
        ? Math.round((ratings.reduce((n, r) => n + (r.rating ?? 0) * r.reviewCount, 0) / totalReviews) * 100) / 100
        : null,
    },
    earnings,
  };
}

// --- Admin directories ---------------------------------------------------------

export interface AdminMemberRow {
  user: UserModel;
  listings: number;
  bookings: number;
  memberships: number;
  lastActiveAt: string | null;
}

export function listMembers(search = '', limit = 200): AdminMemberRow[] {
  const q = search.trim().toLowerCase();
  const lastActive = new Map<string, Date>();
  for (const s of memoryStore.sessions.values()) {
    const prev = lastActive.get(s.userId);
    if (!prev || s.createdAt > prev) lastActive.set(s.userId, s.createdAt);
  }
  return Array.from(memoryStore.users.values())
    .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.neighborhood ?? '').toLowerCase().includes(q))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
    .map((u) => ({
      user: toUserModel(u),
      listings: Array.from(memoryStore.listings.values()).filter((l) => l.ownerId === u.id).length,
      bookings: Array.from(memoryStore.bookings.values()).filter((b) => b.renterId === u.id).length,
      memberships: Array.from(memoryStore.userSubscriptions.values()).filter((s) => s.userId === u.id && s.status === 'active').length,
      lastActiveAt: lastActive.get(u.id)?.toISOString() ?? null,
    }));
}

export interface AdminListingRow {
  listing: ListingModel;
  ownerEmail: string;
  ownerSuspended: boolean;
  stats: HostListingStats;
}

export function listAllListings(search = '', limit = 300): AdminListingRow[] {
  const q = search.trim().toLowerCase();
  return Array.from(memoryStore.listings.values())
    .filter((l) => !q || l.title.toLowerCase().includes(q) || l.neighborhood.toLowerCase().includes(q) || l.city.toLowerCase().includes(q))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
    .map((row) => {
      const owner = memoryStore.users.get(row.ownerId);
      return {
        listing: toListingModel(row),
        ownerEmail: owner?.email ?? '',
        ownerSuspended: !!owner?.suspendedAt,
        stats: statsFor(row.id),
      };
    });
}
