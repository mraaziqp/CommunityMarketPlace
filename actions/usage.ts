import { db, memoryStore } from '../db';
import type { UsageLog, SystemLog, UserSubscription } from '../db/schema';
import { validateInput, LogFractionalUsageSchema } from '../lib/validations';

/** How long an unpaid booking or membership holds its slot. Keep in step with payments.ts. */
const HOLD_MINUTES = 30;

export interface LogFractionalUseResult {
  success: boolean;
  subscription: {
    id: string;
    remainingUses: number;
    totalUsesUsed: number;
  };
  usageLog: {
    id: string;
    subscriptionId: string;
    listingId: string;
    userId: string;
    startedAt: string;
    unitsUsed: number;
    status: string;
    notes?: string | null;
    verificationCode?: string | null;
  };
}

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * The member's access code for a shared appliance. Derived from the
 * subscription id so it is stable without a dedicated column.
 */
export function accessCodeFor(subscriptionId: string, accessMethod: string): string {
  let h = 0;
  for (const ch of subscriptionId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const digits = String(1000 + (h % 9000));
  return `${accessMethod === 'smart_plug' ? 'PLUG' : 'PIN'}-${digits}`;
}

/**
 * Rolls a monthly co-op subscription into its current billing period and
 * restores the allowance. Called whenever subscriptions are read, so an
 * allowance refreshes on its own when the month turns over.
 */
export function renewSubscriptionIfDue(sub: UserSubscription, now = new Date()): UserSubscription {
  if (sub.status !== 'active' || sub.currentPeriodEnd > now) return sub;
  const tier = memoryStore.pricingTiers.get(sub.pricingTierId);
  // One-off usage packs do not renew.
  if (!tier || tier.type !== 'monthly_subscription') return sub;

  let start = sub.currentPeriodStart;
  let end = sub.currentPeriodEnd;
  while (end <= now) {
    start = end;
    end = addMonths(end, 1);
  }
  const renewed: UserSubscription = {
    ...sub,
    currentPeriodStart: start,
    currentPeriodEnd: end,
    renewsAt: end,
    remainingUsesThisPeriod: tier.usageLimitPerPeriod ?? sub.remainingUsesThisPeriod,
    totalUsesUsed: 0,
    updatedAt: now,
  };
  memoryStore.userSubscriptions.set(sub.id, renewed);
  return renewed;
}

/**
 * Start joining a shared-appliance co-op. Creates a membership awaiting its
 * first payment; PayFast's confirmation activates it (see payments.ts).
 * Enforces the household cap (counting recent unpaid holds) and one
 * membership per member per listing.
 */
export async function subscribeToListing(
  userId: string,
  listingId: string,
  pricingTierId: string
): Promise<{ subscriptionId: string }> {
  return await db.transaction(async () => {
    const user = memoryStore.users.get(userId);
    if (!user) throw new Error('Please sign in to join a co-op.');

    const listing = memoryStore.listings.get(listingId);
    if (!listing || !listing.isAvailable) throw new Error('This listing is no longer available.');
    if (listing.ownerId === userId) throw new Error('This is your own listing.');

    const tier = memoryStore.pricingTiers.get(pricingTierId);
    if (!tier || tier.listingId !== listingId || !tier.isActive) {
      throw new Error('That plan is no longer offered. Please pick another.');
    }
    if (tier.type !== 'monthly_subscription' && tier.type !== 'usage_pack') {
      throw new Error('That plan is booked by date, not joined.');
    }

    const mine = Array.from(memoryStore.userSubscriptions.values()).filter(
      (s) => s.userId === userId && s.listingId === listingId
    );
    if (mine.some((s) => s.status === 'active')) throw new Error("You're already part of this co-op.");
    const holdMs = HOLD_MINUTES * 60 * 1000;
    const isFreshHold = (s: UserSubscription) => s.status === 'pending_payment' && Date.now() - s.createdAt.getTime() < holdMs;
    // Re-use an unpaid attempt on the same plan rather than stacking holds.
    const existing = mine.find((s) => isFreshHold(s) && s.pricingTierId === pricingTierId);
    if (existing) return { subscriptionId: existing.id };

    const heldSpots = Array.from(memoryStore.userSubscriptions.values()).filter(
      (s) => s.listingId === listingId && isFreshHold(s)
    ).length;
    if (listing.currentSubscribersCount + heldSpots >= listing.maxSubscribers) {
      throw new Error('This co-op is full right now. Check back when a spot opens up.');
    }

    const now = new Date();
    const periodEnd = tier.type === 'monthly_subscription' ? addMonths(now, 1) : addMonths(now, 12);

    const subscription: UserSubscription = {
      id: newId('sub'),
      userId,
      listingId,
      pricingTierId,
      status: 'pending_payment',
      remainingUsesThisPeriod: tier.usageLimitPerPeriod ?? 10,
      totalUsesUsed: 0,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      renewsAt: tier.type === 'monthly_subscription' ? periodEnd : null,
      cancelledAt: null,
      stripeSubscriptionId: null,
      gatewayToken: null,
      createdAt: now,
      updatedAt: now,
    };
    memoryStore.userSubscriptions.set(subscription.id, subscription);

    const logId = newId('sys_log');
    memoryStore.systemLogs.set(logId, {
      id: logId,
      eventType: 'BOOKING_CREATED',
      userId,
      targetId: subscription.id,
      metadata: {
        kind: 'subscription',
        listingId,
        listingTitle: listing.title,
        tierName: tier.name,
        priceInCents: tier.priceInCents,
        allowance: subscription.remainingUsesThisPeriod,
      },
      createdAt: now,
    });

    return { subscriptionId: subscription.id };
  });
}

/**
 * Record one use of a shared appliance (a wash, a print job, a charge) and
 * deduct it from the member's allowance for this period.
 */
export async function logFractionalUse(
  subscriptionId: string,
  userId: string,
  notes?: string,
  verificationCode?: string
): Promise<LogFractionalUseResult> {
  const validated = validateInput(LogFractionalUsageSchema, {
    subscriptionId,
    userId,
    notes,
    verificationCode,
  });

  const cycleNotes = validated.notes?.trim() || 'Standard cycle';

  return await db.transaction(async () => {
    const stored = memoryStore.userSubscriptions.get(validated.subscriptionId);
    if (!stored || stored.userId !== validated.userId) {
      throw new Error("We couldn't find that co-op membership on your account.");
    }
    const subscription = renewSubscriptionIfDue(stored);

    if (subscription.status !== 'active') {
      throw new Error('This membership is not active.');
    }
    if (subscription.remainingUsesThisPeriod <= 0) {
      throw new Error(
        `You've used all your turns for this period. They refresh on ${subscription.currentPeriodEnd.toLocaleDateString()}.`
      );
    }

    const newRemaining = subscription.remainingUsesThisPeriod - 1;
    const newTotalUsed = (subscription.totalUsesUsed || 0) + 1;
    const eventTimestamp = new Date();

    memoryStore.userSubscriptions.set(subscription.id, {
      ...subscription,
      remainingUsesThisPeriod: newRemaining,
      totalUsesUsed: newTotalUsed,
      updatedAt: eventTimestamp,
    });

    const usageLogRecord: UsageLog = {
      id: newId('usage'),
      subscriptionId: subscription.id,
      listingId: subscription.listingId,
      userId: validated.userId,
      startedAt: eventTimestamp,
      endedAt: null,
      unitsUsed: 1,
      status: 'completed',
      notes: cycleNotes,
      verificationCode: validated.verificationCode || null,
      createdAt: eventTimestamp,
    };
    memoryStore.usageLogs.set(usageLogRecord.id, usageLogRecord);

    const listing = memoryStore.listings.get(subscription.listingId);
    const systemLogRecord: SystemLog = {
      id: newId('sys_log'),
      eventType: 'FRACTIONAL_USE_LOGGED',
      userId: validated.userId,
      targetId: subscription.id,
      metadata: {
        listingId: subscription.listingId,
        listingTitle: listing?.title,
        notes: cycleNotes,
        remainingUses: newRemaining,
      },
      createdAt: eventTimestamp,
    };
    memoryStore.systemLogs.set(systemLogRecord.id, systemLogRecord);

    return {
      success: true,
      subscription: {
        id: subscription.id,
        remainingUses: newRemaining,
        totalUsesUsed: newTotalUsed,
      },
      usageLog: {
        id: usageLogRecord.id,
        subscriptionId: usageLogRecord.subscriptionId,
        listingId: usageLogRecord.listingId,
        userId: usageLogRecord.userId,
        startedAt: usageLogRecord.startedAt.toISOString(),
        unitsUsed: usageLogRecord.unitsUsed,
        status: usageLogRecord.status,
        notes: usageLogRecord.notes,
        verificationCode: usageLogRecord.verificationCode,
      },
    };
  });
}
