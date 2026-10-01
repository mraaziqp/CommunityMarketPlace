import { memoryStore } from '../db';
import type { Booking, Listing } from '../db/schema';
import type {
  AdminAnalyticsReport,
  CategoryPerformanceData,
  ListingCategory,
  NeighbourhoodActivityData,
  RentalVelocityItem,
  SharedApplianceStatus,
  SystemLogModel,
} from '../src/types';
import { getUserById } from './auth';
import { getListingRating } from './listings';

/**
 * ============================================================================
 * ADMIN DASHBOARD REPORT
 *
 * Aggregates the store into the operator view. Every number is computed from
 * recorded bookings, co-op memberships, usage and payments — nothing is
 * seeded, padded or estimated.
 *
 * Because ShareHub runs entirely in the browser, this report covers the data
 * held in the current browser only. A marketplace-wide view needs a server.
 * ============================================================================
 */

export type ReportRange = '7d' | '30d' | '90d' | 'all';

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_DAYS: Record<ReportRange, number | null> = { '7d': 7, '30d': 30, '90d': 90, all: null };

const CATEGORY_NAMES: Record<ListingCategory, string> = {
  fractional_appliance: 'Shared appliances',
  physical_item: 'Tools & equipment',
  room: 'Spaces & rooms',
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const toRand = (cents: number) => Math.round(cents) / 100;

/** Month starts (billing dates) of a subscription that fall inside a window. */
function billingDatesInWindow(createdAt: Date, from: Date, to: Date): number {
  let count = 0;
  const cursor = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate());
  while (cursor <= to) {
    if (cursor >= from) count++;
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return count;
}

export async function getExecutiveAdminReport(
  requesterId: string | null,
  dateRange: ReportRange = '30d'
): Promise<{ success: boolean; data?: AdminAnalyticsReport; error?: string }> {
  const requester = requesterId ? getUserById(requesterId) : null;
  if (!requester || requester.role !== 'ADMIN') {
    return { success: false, error: 'You do not have access to this page.' };
  }

  const now = new Date();
  const days = RANGE_DAYS[dateRange];
  const earliest = new Date(0);
  const from = days === null ? earliest : new Date(now.getTime() - days * DAY_MS);
  const prevFrom = days === null ? null : new Date(from.getTime() - days * DAY_MS);
  const inWindow = (d: Date, start: Date, end: Date) => d >= start && d <= end;

  const listings = Array.from(memoryStore.listings.values());
  const listingById = new Map(listings.map((l) => [l.id, l]));
  const bookings = Array.from(memoryStore.bookings.values()).filter((b) => b.status !== 'CANCELLED');
  const subs = Array.from(memoryStore.userSubscriptions.values());
  const activeSubs = subs.filter((s) => s.status === 'active');
  const usage = Array.from(memoryStore.usageLogs.values());
  const users = Array.from(memoryStore.users.values());

  const bookingRevenue = (b: Booking) => b.totalAmountInCents;
  const tierPrice = (tierId: string) => memoryStore.pricingTiers.get(tierId)?.priceInCents ?? 0;

  /** Gross value (rental fees + co-op fees) booked in a window, optionally for one listing. */
  const grossInWindow = (start: Date, end: Date, filter: (l: Listing) => boolean = () => true) => {
    let cents = 0;
    let transactions = 0;
    for (const b of bookings) {
      const listing = listingById.get(b.listingId);
      if (!listing || !filter(listing) || !inWindow(b.createdAt, start, end)) continue;
      cents += bookingRevenue(b);
      transactions++;
    }
    for (const s of subs) {
      const listing = listingById.get(s.listingId);
      if (!listing || !filter(listing)) continue;
      const charges = billingDatesInWindow(s.createdAt, start, s.cancelledAt ?? end);
      cents += charges * tierPrice(s.pricingTierId);
      transactions += charges;
    }
    return { cents, transactions };
  };

  // --- KPIs ---
  const current = grossInWindow(from, now);
  const previous = prevFrom ? grossInWindow(prevFrom, from) : null;
  const gmvGrowthPct =
    previous && previous.cents > 0 ? round1(((current.cents - previous.cents) / previous.cents) * 100) : null;

  let allowance = 0;
  let used = 0;
  for (const s of activeSubs) {
    const limit = memoryStore.pricingTiers.get(s.pricingTierId)?.usageLimitPerPeriod ?? 0;
    allowance += limit;
    used += Math.min(limit, s.totalUsesUsed);
  }

  const bookingsInRange = bookings.filter((b) => inWindow(b.createdAt, from, now));
  const disputes = bookings.filter((b) => b.disputeStatus === 'PENDING_REVIEW');
  const verifiedHosts = users.filter((u) => u.role === 'VERIFIED_HOST').length;

  const kpis = {
    totalGMVZAR: toRand(current.cents),
    gmvGrowthPct,
    activeSubscriptionsCount: activeSubs.length,
    fractionalUtilizationRate: allowance > 0 ? round1((used / allowance) * 100) : 0,
    totalUsersCount: users.length,
    verifiedHostRatio: users.length > 0 ? Math.round((verifiedHosts / users.length) * 100) : 0,
    completedHandoversCount: bookings.filter((b) => b.handoverCompletedAt && inWindow(b.handoverCompletedAt, from, now)).length,
    activeDisputesCount: disputes.length,
    disputeRate: bookingsInRange.length > 0 ? round1((disputes.length / bookingsInRange.length) * 100) : 0,
    averageTrustScore: users.length > 0 ? round1(users.reduce((sum, u) => sum + u.trustScore, 0) / users.length) : 0,
  };

  // --- Categories ---
  const categoryPerformance: CategoryPerformanceData[] = (Object.keys(CATEGORY_NAMES) as ListingCategory[]).map((category) => {
    const matches = (l: Listing) => l.category === category;
    const gross = grossInWindow(from, now, matches);
    return {
      categoryId: category,
      categoryName: CATEGORY_NAMES[category],
      revenueZAR: toRand(gross.cents),
      bookingCount: bookingsInRange.filter((b) => matches(listingById.get(b.listingId)!)).length,
      activeListingsCount: listings.filter((l) => matches(l) && l.isAvailable).length,
      subscriberCount: activeSubs.filter((s) => {
        const l = listingById.get(s.listingId);
        return l ? matches(l) : false;
      }).length,
      avgTicketZAR: gross.transactions > 0 ? Math.round(toRand(gross.cents / gross.transactions)) : 0,
    };
  });

  // --- Listing performance ---
  const windowStart = days === null ? null : from;
  const rentalVelocity: RentalVelocityItem[] = listings
    .map((l) => {
      const listingBookings = bookingsInRange.filter((b) => b.listingId === l.id);
      const cycles = usage.filter((u) => u.listingId === l.id && inWindow(u.startedAt, from, now)).length;
      const gross = grossInWindow(from, now, (x) => x.id === l.id);

      let utilization: number;
      let avgRentalHours: number | null = null;
      if (l.category === 'fractional_appliance') {
        utilization = l.maxSubscribers > 0 ? (l.currentSubscribersCount / l.maxSubscribers) * 100 : 0;
      } else {
        const spanStart = windowStart ?? l.createdAt;
        const spanMs = Math.max(DAY_MS, now.getTime() - spanStart.getTime());
        const bookedMs = listingBookings.reduce((sum, b) => sum + (b.endDate.getTime() - b.startDate.getTime()), 0);
        utilization = Math.min(100, (bookedMs / spanMs) * 100);
        if (listingBookings.length > 0) avgRentalHours = round1(bookedMs / listingBookings.length / (60 * 60 * 1000));
      }

      const owner = memoryStore.users.get(l.ownerId);
      return {
        id: l.id,
        title: l.title,
        category: l.category as ListingCategory,
        categoryName: CATEGORY_NAMES[l.category as ListingCategory],
        neighborhood: l.neighborhood,
        ownerName: owner?.name ?? 'Unknown host',
        totalBookings: listingBookings.length + cycles,
        utilizationRatePct: round1(utilization),
        totalRevenueZAR: toRand(gross.cents),
        avgRentalHours,
        rating: getListingRating(l.id).rating ?? null,
        status: (utilization >= 70 ? 'high_velocity' : utilization >= 30 ? 'steady' : 'underutilized') as RentalVelocityItem['status'],
      };
    })
    .sort((a, b) => b.totalRevenueZAR - a.totalRevenueZAR || b.totalBookings - a.totalBookings)
    .slice(0, 10);

  // --- Neighbourhoods ---
  const hoods = new Map<string, NeighbourhoodActivityData>();
  for (const l of listings) {
    const entry = hoods.get(l.neighborhood) ?? {
      neighborhood: l.neighborhood,
      activeListings: 0,
      totalBookings: 0,
      activeSubscribers: 0,
      revenueZAR: 0,
    };
    if (l.isAvailable) entry.activeListings++;
    entry.totalBookings += bookingsInRange.filter((b) => b.listingId === l.id).length;
    entry.activeSubscribers += activeSubs.filter((s) => s.listingId === l.id).length;
    entry.revenueZAR += toRand(grossInWindow(from, now, (x) => x.id === l.id).cents);
    hoods.set(l.neighborhood, entry);
  }
  const neighbourhoodActivity = Array.from(hoods.values()).sort(
    (a, b) => b.revenueZAR - a.revenueZAR || b.activeListings - a.activeListings
  );

  // --- Shared appliances ---
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sharedAppliances: SharedApplianceStatus[] = listings
    .filter((l) => l.category === 'fractional_appliance')
    .map((l) => {
      const listingUsage = usage.filter((u) => u.listingId === l.id);
      const last = listingUsage.reduce<Date | null>((max, u) => (!max || u.startedAt > max ? u.startedAt : max), null);
      return {
        listingId: l.id,
        title: l.title,
        hostName: memoryStore.users.get(l.ownerId)?.name ?? 'Unknown host',
        neighborhood: l.neighborhood,
        activeSubscribers: l.currentSubscribersCount,
        maxCapacity: l.maxSubscribers,
        cyclesLoggedThisMonth: listingUsage.filter((u) => u.startedAt >= monthStart).length,
        remainingQuotaThisMonth: activeSubs
          .filter((s) => s.listingId === l.id)
          .reduce((sum, s) => sum + s.remainingUsesThisPeriod, 0),
        lastCycleAt: last ? last.toISOString() : null,
      };
    });

  // --- Event log ---
  const recentSystemLogs: SystemLogModel[] = Array.from(memoryStore.systemLogs.values())
    .filter((l) => inWindow(l.createdAt, from, now))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 200)
    .map((l) => ({
      id: l.id,
      eventType: l.eventType as SystemLogModel['eventType'],
      userId: l.userId,
      targetId: l.targetId,
      metadata: (l.metadata as Record<string, any>) || {},
      createdAt: l.createdAt.toISOString(),
    }));

  return {
    success: true,
    data: {
      kpis,
      categoryPerformance,
      rentalVelocity,
      neighbourhoodActivity,
      sharedAppliances,
      recentSystemLogs,
      generatedAt: now.toISOString(),
    },
  };
}
