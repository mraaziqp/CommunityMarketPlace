import { memoryStore } from '../db';
import type { SystemLog } from '../db/schema';
import type {
  ActivityHistoryItem,
  BookingModel,
  MemberActivity,
  PaymentModel,
  UsageLogModel,
  UserSubscriptionModel,
} from '../src/types';
import { toListingModel } from './listings';
import { accessCodeFor, renewSubscriptionIfDue } from './usage';

const EMPTY: MemberActivity = { subscriptions: [], bookings: [], usageLogs: [], history: [] };
const HISTORY_LIMIT = 50;

function formatRand(cents: number) {
  return `R${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function listingTitleFor(log: SystemLog): string {
  const meta = (log.metadata ?? {}) as Record<string, any>;
  if (typeof meta.listingTitle === 'string') return meta.listingTitle;
  if (typeof meta.title === 'string') return meta.title;
  const listingId =
    meta.listingId ??
    memoryStore.bookings.get(log.targetId)?.listingId ??
    memoryStore.bookings.get(meta.bookingId)?.listingId ??
    memoryStore.userSubscriptions.get(log.targetId)?.listingId;
  return (listingId && memoryStore.listings.get(listingId)?.title) || 'a listing';
}

/** Turns a stored event into a sentence for the member it concerns, or null if it is not worth showing. */
function describe(log: SystemLog, userId: string): ActivityHistoryItem | null {
  const meta = (log.metadata ?? {}) as Record<string, any>;
  const isMine = log.userId === userId;
  const base = { id: log.id, createdAt: log.createdAt.toISOString() };

  switch (log.eventType) {
    case 'AUTH_SIGNUP':
      return isMine ? { ...base, kind: 'account', title: 'You joined ShareHub' } : null;
    case 'BOOKING_CREATED': {
      const title = listingTitleFor(log);
      if (meta.kind === 'subscription') {
        return isMine ? { ...base, kind: 'booking', title: `You joined ${title}`, detail: meta.tierName } : null;
      }
      return isMine
        ? { ...base, kind: 'booking', title: `You booked ${title}` }
        : { ...base, kind: 'booking', title: `New booking for ${title}` };
    }
    case 'PAYMENT_HELD':
      return isMine
        ? { ...base, kind: 'payment', title: 'Payment secured', detail: meta.amountInCents ? formatRand(meta.amountInCents) : undefined }
        : null;
    case 'PAYMENT_CAPTURED':
      return { ...base, kind: 'payment', title: 'Payment released to the host' };
    case 'HANDOVER_COMPLETED': {
      const title = listingTitleFor(log);
      if (meta.stage === 'pickup') {
        return isMine ? { ...base, kind: 'pickup', title: `You picked up ${title}` } : { ...base, kind: 'pickup', title: `${title} was picked up` };
      }
      return { ...base, kind: 'return', title: `${title} was returned` };
    }
    case 'FRACTIONAL_USE_LOGGED':
      return isMine ? { ...base, kind: 'usage', title: `You used ${listingTitleFor(log)}`, detail: meta.notes ?? meta.cycleNotes } : null;
    case 'REVIEW_SUBMITTED':
      return isMine
        ? { ...base, kind: 'review', title: 'You left a review', detail: meta.targetUserName ? `for ${meta.targetUserName}` : undefined }
        : { ...base, kind: 'review', title: 'You received a new review' };
    case 'LISTING_CREATED':
      return isMine ? { ...base, kind: 'listing', title: `You listed ${listingTitleFor(log)}` } : null;
    case 'GROUP_CREATED':
    case 'GROUP_JOINED': {
      if (!isMine) return null;
      const name = meta.groupName ?? memoryStore.trustGroups.get(log.targetId)?.name ?? 'a circle';
      return { ...base, kind: 'circle', title: log.eventType === 'GROUP_CREATED' ? `You started ${name}` : `You joined ${name}` };
    }
    case 'DISPUTE_RAISED':
      return { ...base, kind: 'dispute', title: `A problem was reported with ${listingTitleFor(log)}`, detail: 'The payout is paused while we look into it.' };
    default:
      return null;
  }
}

/** Is this event about something the member rents or hosts? */
function concernsUser(log: SystemLog, userId: string): boolean {
  if (log.userId === userId) return true;
  const meta = (log.metadata ?? {}) as Record<string, any>;
  const booking = memoryStore.bookings.get(log.targetId) ?? memoryStore.bookings.get(meta.bookingId);
  if (!booking) {
    return log.eventType === 'REVIEW_SUBMITTED' && meta.targetId === userId;
  }
  if (booking.renterId === userId) return true;
  return memoryStore.listings.get(booking.listingId)?.ownerId === userId;
}

/**
 * Everything the signed-in member needs for their Activity screen: co-op
 * memberships, rentals they made or are hosting, usage, and a readable history.
 */
export async function getActivityForUser(userId: string | null): Promise<MemberActivity> {
  if (!userId || !memoryStore.users.has(userId)) return EMPTY;

  const subscriptions: UserSubscriptionModel[] = [];
  for (const stored of Array.from(memoryStore.userSubscriptions.values())) {
    if (stored.userId !== userId || stored.status !== 'active') continue;
    const sub = renewSubscriptionIfDue(stored);
    const row = memoryStore.listings.get(sub.listingId);
    if (!row) continue;
    const listing = toListingModel(row);
    const tier = listing.pricingTiers.find((t) => t.id === sub.pricingTierId);
    if (!tier) continue;
    subscriptions.push({
      id: sub.id,
      userId: sub.userId,
      listingId: sub.listingId,
      listing,
      pricingTierId: sub.pricingTierId,
      pricingTier: tier,
      status: sub.status as UserSubscriptionModel['status'],
      remainingUsesThisPeriod: sub.remainingUsesThisPeriod,
      totalUsesUsed: sub.totalUsesUsed,
      currentPeriodStart: sub.currentPeriodStart.toISOString(),
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      accessKeyOrCode: accessCodeFor(sub.id, row.accessMethod),
    });
  }

  const bookings: BookingModel[] = [];
  for (const b of memoryStore.bookings.values()) {
    const listing = memoryStore.listings.get(b.listingId);
    if (!listing) continue;
    const viewerRole = b.renterId === userId ? 'renter' : listing.ownerId === userId ? 'host' : null;
    if (!viewerRole) continue;

    const renter = memoryStore.users.get(b.renterId);
    const host = memoryStore.users.get(listing.ownerId);
    const payment = Array.from(memoryStore.payments.values()).find((p) => p.bookingId === b.id);
    const paymentModel: PaymentModel | null = payment
      ? {
          id: payment.id,
          bookingId: payment.bookingId,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status as PaymentModel['status'],
          escrowReleasedAt: payment.escrowReleasedAt ? payment.escrowReleasedAt.toISOString() : null,
          createdAt: payment.createdAt.toISOString(),
        }
      : null;

    bookings.push({
      id: b.id,
      listingId: b.listingId,
      listingTitle: listing.title,
      listingImage: listing.images?.[0],
      renterId: b.renterId,
      renterName: renter?.name ?? 'A neighbour',
      status: b.status as BookingModel['status'],
      disputeStatus: b.disputeStatus as BookingModel['disputeStatus'],
      // The pickup code proves the renter met the host, so only the host sees it.
      verificationCode: viewerRole === 'host' ? b.verificationCode : '',
      totalAmountInCents: b.totalAmountInCents,
      depositAmountInCents: b.depositAmountInCents,
      startDate: b.startDate.toISOString(),
      endDate: b.endDate.toISOString(),
      handoverCompletedAt: b.handoverCompletedAt ? b.handoverCompletedAt.toISOString() : null,
      payment: paymentModel,
      hasReview: Array.from(memoryStore.reviews.values()).some(
        (r) => r.bookingId === b.id && r.reviewerId === b.renterId
      ),
      hostId: listing.ownerId,
      hostName: host?.name ?? 'your host',
      viewerRole,
    });
  }
  const statusOrder: Record<string, number> = { PENDING_PAYMENT: 0, PENDING_HANDOVER: 1, ACTIVE: 2, COMPLETED: 3, CANCELLED: 4 };
  bookings.sort(
    (a, b) =>
      (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9) ||
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  const userName = memoryStore.users.get(userId)?.name ?? 'You';
  const usageLogs: UsageLogModel[] = Array.from(memoryStore.usageLogs.values())
    .filter((l) => l.userId === userId)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .map((l) => ({
      id: l.id,
      subscriptionId: l.subscriptionId,
      listingId: l.listingId,
      listingTitle: memoryStore.listings.get(l.listingId)?.title ?? 'Shared appliance',
      userId: l.userId,
      userName,
      startedAt: l.startedAt.toISOString(),
      unitsUsed: l.unitsUsed,
      status: l.status as UsageLogModel['status'],
      notes: l.notes ?? undefined,
    }));

  const history: ActivityHistoryItem[] = [];
  const logs = Array.from(memoryStore.systemLogs.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
  for (const log of logs) {
    if (history.length >= HISTORY_LIMIT) break;
    if (!concernsUser(log, userId)) continue;
    const item = describe(log, userId);
    if (item) history.push(item);
  }

  return { subscriptions, bookings, usageLogs, history };
}
