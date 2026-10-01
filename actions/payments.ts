import { memoryStore } from '../db';
import type { Payment, SystemLog } from '../db/schema';
import { buildCheckout, type CheckoutForm } from '../server/payfast';
import { renewSubscriptionIfDue } from './usage';

/**
 * ============================================================================
 * PAYMENTS
 *
 * Lifecycle of a rental payment:
 *   PENDING         checkout started, waiting for PayFast
 *   HELD_IN_ESCROW  PayFast confirmed; booking can be collected
 *   CAPTURED        item returned; host payout and deposit refund become "due"
 *   FROZEN_ESCROW   host reported a problem; payouts paused
 *
 * Co-op memberships use PayFast monthly subscriptions: the first payment
 * activates the membership, each renewal notification extends it, and a
 * cancellation notification ends it.
 *
 * Host payouts and deposit refunds are tracked as "due" and settled outside
 * the gateway (by the operations team or the bot via /api/v1), because
 * PayFast collects into ShareHub's merchant account and does not pay out to
 * third parties.
 * ============================================================================
 */

export const PLATFORM_FEE = 0.1;
/** Unpaid bookings and memberships stop holding a slot after this long. */
export const HOLD_MINUTES = 30;

const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

function log(eventType: SystemLog['eventType'], userId: string, targetId: string, metadata: Record<string, unknown>) {
  // Every event belongs to a real member (foreign key); skip orphaned ones.
  if (!memoryStore.users.has(userId)) return;
  const id = newId('sys_log');
  memoryStore.systemLogs.set(id, { id, eventType, userId, targetId, metadata, createdAt: new Date() });
}

function newPayment(fields: Partial<Payment> & Pick<Payment, 'kind' | 'amount' | 'payerId'>): Payment {
  const now = new Date();
  return {
    id: newId('pay'),
    bookingId: null,
    subscriptionId: null,
    currency: 'ZAR',
    status: 'PENDING',
    provider: 'payfast',
    paymentGatewayRef: null,
    gatewayToken: null,
    escrowReleasedAt: null,
    hostPayoutStatus: 'none',
    hostPayoutInCents: 0,
    depositRefundStatus: 'none',
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
}

const isStale = (createdAt: Date) => Date.now() - createdAt.getTime() > HOLD_MINUTES * 60 * 1000;

/** Starts (or restarts) PayFast checkout for an unpaid booking. */
export async function startBookingCheckout(bookingId: string, userId: string): Promise<CheckoutForm> {
  const booking = memoryStore.bookings.get(bookingId);
  if (!booking || booking.renterId !== userId) throw new Error("We couldn't find that booking on your account.");
  if (booking.status !== 'PENDING_PAYMENT') throw new Error('This booking no longer needs payment.');
  if (isStale(booking.createdAt)) {
    throw new Error('This booking hold has expired. Please book again.');
  }
  const listing = memoryStore.listings.get(booking.listingId);
  const user = memoryStore.users.get(userId)!;

  let payment = Array.from(memoryStore.payments.values()).find((p) => p.bookingId === bookingId && p.status === 'PENDING');
  if (!payment) {
    payment = newPayment({
      kind: 'booking',
      bookingId,
      payerId: userId,
      amount: booking.totalAmountInCents + booking.depositAmountInCents,
    });
    memoryStore.payments.set(payment.id, payment);
  }

  return buildCheckout({
    paymentId: payment.id,
    amountInCents: payment.amount,
    itemName: listing?.title ?? 'ShareHub rental',
    itemDescription: `${booking.startDate.toISOString().slice(0, 10)} to ${booking.endDate.toISOString().slice(0, 10)} (incl. refundable deposit)`,
    buyer: { name: user.name, email: user.email },
    kind: 'booking',
    targetId: bookingId,
  });
}

/** Starts PayFast checkout for a co-op membership awaiting its first payment. */
export async function startSubscriptionCheckout(subscriptionId: string, userId: string): Promise<CheckoutForm> {
  const sub = memoryStore.userSubscriptions.get(subscriptionId);
  if (!sub || sub.userId !== userId) throw new Error("We couldn't find that membership on your account.");
  if (sub.status !== 'pending_payment') throw new Error('This membership no longer needs payment.');
  const tier = memoryStore.pricingTiers.get(sub.pricingTierId)!;
  const listing = memoryStore.listings.get(sub.listingId);
  const user = memoryStore.users.get(userId)!;

  let payment = Array.from(memoryStore.payments.values()).find((p) => p.subscriptionId === subscriptionId && p.status === 'PENDING');
  if (!payment) {
    payment = newPayment({ kind: 'subscription', subscriptionId, payerId: userId, amount: tier.priceInCents });
    memoryStore.payments.set(payment.id, payment);
  }

  return buildCheckout({
    paymentId: payment.id,
    amountInCents: payment.amount,
    itemName: `${listing?.title ?? 'Co-op'} membership`,
    itemDescription: tier.name,
    buyer: { name: user.name, email: user.email },
    kind: 'subscription',
    targetId: subscriptionId,
    recurring: tier.type === 'monthly_subscription' ? { recurringAmountInCents: tier.priceInCents } : undefined,
  });
}

export type ItnOutcome =
  | { status: 'applied'; detail: string }
  | { status: 'ignored'; detail: string }
  | { status: 'rejected'; detail: string };

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function activateSubscription(subId: string, token: string | null) {
  const sub = memoryStore.userSubscriptions.get(subId)!;
  const tier = memoryStore.pricingTiers.get(sub.pricingTierId);
  const listing = memoryStore.listings.get(sub.listingId);
  const now = new Date();
  const end = tier?.type === 'monthly_subscription' ? addMonths(now, 1) : addMonths(now, 12);
  memoryStore.userSubscriptions.set(subId, {
    ...sub,
    status: 'active',
    gatewayToken: token,
    currentPeriodStart: now,
    currentPeriodEnd: end,
    renewsAt: tier?.type === 'monthly_subscription' ? end : null,
    remainingUsesThisPeriod: tier?.usageLimitPerPeriod ?? 10,
    totalUsesUsed: 0,
    updatedAt: now,
  });
  if (listing) {
    memoryStore.listings.set(listing.id, { ...listing, currentSubscribersCount: listing.currentSubscribersCount + 1, updatedAt: now });
  }
}

function cancelSubscription(subId: string, reason: string) {
  const sub = memoryStore.userSubscriptions.get(subId);
  if (!sub || sub.status === 'cancelled') return;
  const now = new Date();
  memoryStore.userSubscriptions.set(subId, { ...sub, status: 'cancelled', cancelledAt: now, renewsAt: null, updatedAt: now });
  const listing = memoryStore.listings.get(sub.listingId);
  if (listing && sub.status === 'active') {
    memoryStore.listings.set(listing.id, {
      ...listing,
      currentSubscribersCount: Math.max(0, listing.currentSubscribersCount - 1),
      updatedAt: now,
    });
  }
  log('SUBSCRIPTION_CANCELLED', sub.userId, subId, { listingId: sub.listingId, reason });
}

/**
 * Applies a PayFast notification that has already passed signature, source
 * and server-to-server checks. Idempotent: a repeated notification for the
 * same pf_payment_id changes nothing.
 */
export function applyPayfastNotification(data: Record<string, string>): ItnOutcome {
  const pfPaymentId = data.pf_payment_id;
  const status = (data.payment_status || '').toUpperCase();
  const token = data.token || null;
  const grossCents = Math.round(parseFloat(data.amount_gross || '0') * 100);

  const already = pfPaymentId
    ? Array.from(memoryStore.payments.values()).find((p) => p.paymentGatewayRef === pfPaymentId)
    : undefined;
  if (already && status === 'COMPLETE') return { status: 'ignored', detail: 'already processed' };

  const payment = data.m_payment_id ? memoryStore.payments.get(data.m_payment_id) : undefined;
  const now = new Date();

  // Recurring renewals and cancellations arrive with the subscription token.
  const tokenSub = token ? Array.from(memoryStore.userSubscriptions.values()).find((s) => s.gatewayToken === token) : undefined;
  // Monthly admin test payments renew with their own token.
  const tokenTest = token
    ? Array.from(memoryStore.payments.values()).find((p) => p.kind === 'test' && p.gatewayToken === token)
    : undefined;

  if (!payment && !tokenSub && !tokenTest) return { status: 'rejected', detail: 'unknown payment' };

  if (status === 'CANCELLED' && tokenTest && (!payment || payment.status !== 'PENDING')) {
    log('SUBSCRIPTION_CANCELLED', tokenTest.payerId ?? '', tokenTest.id, { kind: 'test' });
    return { status: 'applied', detail: 'test subscription cancelled' };
  }

  if (status === 'CANCELLED') {
    if (tokenSub && tokenSub.status === 'active') {
      cancelSubscription(tokenSub.id, 'Cancelled at PayFast');
      return { status: 'applied', detail: 'subscription cancelled' };
    }
    if (payment && payment.status === 'PENDING') {
      log('PAYMENT_FAILED', payment.payerId ?? '', payment.id, { reason: 'cancelled', kind: payment.kind });
      return { status: 'applied', detail: 'payment cancelled' };
    }
    return { status: 'ignored', detail: 'nothing to cancel' };
  }

  if (status !== 'COMPLETE') {
    if (payment) log('PAYMENT_FAILED', payment.payerId ?? '', payment.id, { reason: status || 'unknown', kind: payment.kind });
    return { status: 'ignored', detail: `status ${status}` };
  }

  // A renewal of an existing membership: new pf_payment_id, same token.
  if (tokenSub && tokenSub.status === 'active' && (!payment || payment.status !== 'PENDING')) {
    const tier = memoryStore.pricingTiers.get(tokenSub.pricingTierId);
    const listing = memoryStore.listings.get(tokenSub.listingId);
    // PayFast keeps charging the amount the member signed up at, even if the
    // host has since changed the price, so compare with their first payment.
    const firstPayment = Array.from(memoryStore.payments.values())
      .filter((p) => p.subscriptionId === tokenSub.id && p.status === 'CAPTURED')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    const expectedCents = firstPayment?.amount ?? tier?.priceInCents;
    if (expectedCents !== undefined && grossCents !== expectedCents) return { status: 'rejected', detail: 'renewal amount mismatch' };
    const renewal = newPayment({
      kind: 'subscription',
      subscriptionId: tokenSub.id,
      payerId: tokenSub.userId,
      amount: grossCents,
      status: 'CAPTURED',
      paymentGatewayRef: pfPaymentId,
      escrowReleasedAt: now,
      hostPayoutStatus: 'due',
      hostPayoutInCents: Math.round(grossCents * (1 - PLATFORM_FEE)),
    });
    memoryStore.payments.set(renewal.id, renewal);
    renewSubscriptionIfDue(tokenSub, new Date(tokenSub.currentPeriodEnd.getTime() + 1));
    log('PAYMENT_CAPTURED', tokenSub.userId, renewal.id, { kind: 'subscription_renewal', listingId: listing?.id, amountInCents: grossCents });
    return { status: 'applied', detail: 'subscription renewed' };
  }

  // A monthly test payment renewing.
  if (tokenTest && (!payment || payment.status !== 'PENDING')) {
    if (grossCents !== tokenTest.amount) return { status: 'rejected', detail: 'test renewal amount mismatch' };
    const renewal = newPayment({
      kind: 'test',
      payerId: tokenTest.payerId,
      amount: grossCents,
      status: 'CAPTURED',
      paymentGatewayRef: pfPaymentId,
      gatewayToken: token,
      escrowReleasedAt: now,
    });
    memoryStore.payments.set(renewal.id, renewal);
    log('PAYMENT_CAPTURED', tokenTest.payerId ?? '', renewal.id, { kind: 'test_renewal', amountInCents: grossCents });
    return { status: 'applied', detail: 'test subscription renewed' };
  }

  if (!payment) return { status: 'rejected', detail: 'unknown payment' };
  if (payment.status !== 'PENDING') return { status: 'ignored', detail: `payment already ${payment.status}` };
  if (grossCents !== payment.amount) return { status: 'rejected', detail: `amount mismatch (${grossCents} != ${payment.amount})` };

  if (payment.kind === 'test') {
    memoryStore.payments.set(payment.id, {
      ...payment,
      status: 'CAPTURED',
      paymentGatewayRef: pfPaymentId,
      gatewayToken: token,
      escrowReleasedAt: now,
      updatedAt: now,
    });
    log('PAYMENT_CAPTURED', payment.payerId ?? '', payment.id, { kind: 'test', amountInCents: payment.amount, recurring: !!token });
    return { status: 'applied', detail: 'test payment received' };
  }

  if (payment.kind === 'booking' && payment.bookingId) {
    const booking = memoryStore.bookings.get(payment.bookingId);
    if (!booking) return { status: 'rejected', detail: 'booking missing' };
    memoryStore.payments.set(payment.id, { ...payment, status: 'HELD_IN_ESCROW', paymentGatewayRef: pfPaymentId, updatedAt: now });
    if (booking.status === 'PENDING_PAYMENT' || booking.status === 'CANCELLED') {
      memoryStore.bookings.set(booking.id, { ...booking, status: 'PENDING_HANDOVER', updatedAt: now });
    }
    log('PAYMENT_HELD', payment.payerId ?? booking.renterId, payment.id, { bookingId: booking.id, amountInCents: payment.amount });
    return { status: 'applied', detail: 'booking paid' };
  }

  if (payment.kind === 'subscription' && payment.subscriptionId) {
    const sub = memoryStore.userSubscriptions.get(payment.subscriptionId);
    if (!sub) return { status: 'rejected', detail: 'subscription missing' };
    memoryStore.payments.set(payment.id, {
      ...payment,
      status: 'CAPTURED',
      paymentGatewayRef: pfPaymentId,
      escrowReleasedAt: now,
      hostPayoutStatus: 'due',
      hostPayoutInCents: Math.round(payment.amount * (1 - PLATFORM_FEE)),
      updatedAt: now,
    });
    if (sub.status === 'pending_payment' || sub.status === 'cancelled') activateSubscription(sub.id, token);
    log('PAYMENT_CAPTURED', sub.userId, payment.id, { kind: 'subscription', subscriptionId: sub.id, amountInCents: payment.amount });
    return { status: 'applied', detail: 'membership activated' };
  }

  return { status: 'rejected', detail: 'unhandled payment' };
}

/**
 * Releases unpaid holds so abandoned checkouts do not block a listing's
 * calendar or a co-op spot. Run periodically.
 */
export function expireStaleHolds() {
  const now = new Date();
  for (const booking of memoryStore.bookings.values()) {
    if (booking.status === 'PENDING_PAYMENT' && isStale(booking.createdAt)) {
      memoryStore.bookings.set(booking.id, { ...booking, status: 'CANCELLED', updatedAt: now });
    }
  }
  for (const sub of memoryStore.userSubscriptions.values()) {
    if (sub.status === 'pending_payment' && isStale(sub.createdAt)) {
      memoryStore.userSubscriptions.set(sub.id, { ...sub, status: 'cancelled', cancelledAt: now, updatedAt: now });
    }
  }
}

/** Marks a host payout or deposit refund as settled (admin / bot). */
export function markSettlement(paymentId: string, what: 'hostPayout' | 'depositRefund', actorId: string) {
  const payment = memoryStore.payments.get(paymentId);
  if (!payment) throw new Error('Payment not found.');
  const field = what === 'hostPayout' ? 'hostPayoutStatus' : 'depositRefundStatus';
  if (payment[field] !== 'due') throw new Error(`Nothing is due for ${what} on this payment.`);
  memoryStore.payments.set(paymentId, { ...payment, [field]: 'done', updatedAt: new Date() });
  log(what === 'hostPayout' ? 'PAYMENT_CAPTURED' : 'PAYMENT_REFUNDED', actorId, paymentId, { settled: what });
}

// --- Admin: live gateway test payments ---

/** PayFast's minimum transaction is R5.00; the cap keeps a typo from becoming an expensive test. */
export const TEST_PAYMENT_LIMITS = { minCents: 500, maxCents: 1_000_000 };

/**
 * Starts a real PayFast checkout for an amount the admin chooses, once-off or
 * monthly, so the live gateway (checkout, signature, ITN, confirmation) can be
 * verified end to end without creating a listing. Admin only.
 */
export function startTestPayment(adminId: string, amountInCents: number, recurring: boolean): CheckoutForm {
  const admin = memoryStore.users.get(adminId);
  if (!admin) throw new Error('Admin account not found.');
  if (!Number.isInteger(amountInCents) || amountInCents < TEST_PAYMENT_LIMITS.minCents || amountInCents > TEST_PAYMENT_LIMITS.maxCents) {
    throw new Error(`Choose an amount between R${TEST_PAYMENT_LIMITS.minCents / 100} and R${TEST_PAYMENT_LIMITS.maxCents / 100}.`);
  }
  const payment = newPayment({ kind: 'test', payerId: adminId, amount: amountInCents });
  memoryStore.payments.set(payment.id, payment);
  return buildCheckout({
    paymentId: payment.id,
    amountInCents,
    itemName: recurring ? 'ShareHub monthly payment test' : 'ShareHub payment test',
    itemDescription: 'Gateway test initiated by a ShareHub admin',
    buyer: { name: admin.name, email: admin.email },
    kind: 'test',
    targetId: payment.id,
    recurring: recurring ? { recurringAmountInCents: amountInCents } : undefined,
  });
}

export interface PaymentSummary {
  id: string;
  kind: string;
  status: string;
  amountInCents: number;
  gatewayRef: string | null;
  recurring: boolean;
  createdAt: string;
  updatedAt: string;
  listingTitle?: string;
  hostPayout: { status: string; amountInCents: number; hostId?: string; hostName?: string };
  depositRefund: { status: string; amountInCents: number; renterId?: string; renterName?: string };
}

/** Payments for the admin screen and bot: newest first, optionally only those with money owed. */
export function listPayments(filter: { kind?: string; owed?: boolean; limit?: number } = {}): PaymentSummary[] {
  return Array.from(memoryStore.payments.values())
    .filter((p) => !filter.kind || p.kind === filter.kind)
    .filter((p) => !filter.owed || p.hostPayoutStatus === 'due' || p.depositRefundStatus === 'due')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, filter.limit ?? 200)
    .map((p) => {
      const booking = p.bookingId ? memoryStore.bookings.get(p.bookingId) : undefined;
      const sub = p.subscriptionId ? memoryStore.userSubscriptions.get(p.subscriptionId) : undefined;
      const listing = memoryStore.listings.get(booking?.listingId ?? sub?.listingId ?? '');
      return {
        id: p.id,
        kind: p.kind,
        status: p.status,
        amountInCents: p.amount,
        gatewayRef: p.paymentGatewayRef,
        recurring: !!p.gatewayToken || !!sub,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        listingTitle: listing?.title,
        hostPayout: {
          status: p.hostPayoutStatus,
          amountInCents: p.hostPayoutInCents,
          hostId: listing?.ownerId,
          hostName: listing ? memoryStore.users.get(listing.ownerId)?.name : undefined,
        },
        depositRefund: {
          status: p.depositRefundStatus,
          amountInCents: booking?.depositAmountInCents ?? 0,
          renterId: booking?.renterId,
          renterName: booking ? memoryStore.users.get(booking.renterId)?.name : undefined,
        },
      };
    });
}
