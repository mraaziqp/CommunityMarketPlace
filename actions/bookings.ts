import { db, memoryStore } from '../db';
import type { Booking, SystemLog } from '../db/schema';
import { validateInput, ConfirmHandoverSchema, CreateBookingSchema } from '../lib/validations';

export interface BookingSummary {
  id: string;
  listingId: string;
  renterId: string;
  status: string;
  verificationCode: string;
  totalAmountInCents: number;
  depositAmountInCents: number;
  startDate: string;
  endDate: string;
  handoverCompletedAt: string | null;
}

const HOUR_MS = 60 * 60 * 1000;
const UNIT_MS: Record<string, number> = {
  hourly: HOUR_MS,
  daily: 24 * HOUR_MS,
  nightly: 24 * HOUR_MS,
};

/** Statuses that hold a listing's calendar. Unpaid bookings only hold it briefly. */
const BLOCKING_STATUSES = ['PENDING_PAYMENT', 'PENDING_HANDOVER', 'ACTIVE'];
const UNPAID_HOLD_MS = 30 * 60 * 1000;

function blocksCalendar(b: Booking) {
  if (!BLOCKING_STATUSES.includes(b.status)) return false;
  return b.status !== 'PENDING_PAYMENT' || Date.now() - b.createdAt.getTime() < UNPAID_HOLD_MS;
}

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

function toSummary(b: Booking): BookingSummary {
  return {
    id: b.id,
    listingId: b.listingId,
    renterId: b.renterId,
    status: b.status,
    verificationCode: b.verificationCode,
    totalAmountInCents: b.totalAmountInCents,
    depositAmountInCents: b.depositAmountInCents,
    startDate: b.startDate.toISOString(),
    endDate: b.endDate.toISOString(),
    handoverCompletedAt: b.handoverCompletedAt ? b.handoverCompletedAt.toISOString() : null,
  };
}

/** Number of billable units (hours, days or nights) between two dates for a rate type. */
export function billableUnits(tierType: string, start: Date, end: Date): number {
  const unit = UNIT_MS[tierType];
  if (!unit) return 0;
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / unit));
}

/**
 * Reserve a listing for a date range. The booking waits for payment (see
 * payments.ts) and holds the dates for 30 minutes meanwhile. The price is
 * always worked out here from the listing's own rate, never taken from the
 * caller.
 */
export async function createBooking(input: {
  listingId: string;
  renterId: string;
  pricingTierId: string;
  startDate: string | Date;
  endDate: string | Date;
}): Promise<{ success: true; booking: BookingSummary }> {
  const validated = validateInput(CreateBookingSchema, input);
  const start = new Date(validated.startDate);
  const end = new Date(validated.endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Please choose valid dates.');
  }
  if (end <= start) throw new Error('The end of your booking must be after the start.');
  if (start.getTime() < Date.now() - HOUR_MS) throw new Error('Please choose a start time in the future.');

  return await db.transaction(async () => {
    const renter = memoryStore.users.get(validated.renterId);
    if (!renter) throw new Error('Please sign in to book.');

    const listing = memoryStore.listings.get(validated.listingId);
    if (!listing || !listing.isAvailable) throw new Error('This listing is no longer available.');
    if (listing.ownerId === renter.id) throw new Error("You can't book your own listing.");

    if (listing.visibilityGroupId) {
      const isMember = Array.from(memoryStore.groupMemberships.values()).some(
        (m) => m.groupId === listing.visibilityGroupId && m.userId === renter.id && m.status === 'ACTIVE'
      );
      if (!isMember) throw new Error('This listing is only available to members of its circle.');
    }

    const tier = memoryStore.pricingTiers.get(validated.pricingTierId);
    if (!tier || tier.listingId !== listing.id || !tier.isActive || !UNIT_MS[tier.type]) {
      throw new Error('That rate is no longer offered. Please pick another.');
    }

    for (const existing of memoryStore.bookings.values()) {
      if (existing.listingId !== listing.id || !blocksCalendar(existing)) continue;
      if (start < existing.endDate && end > existing.startDate) {
        throw new Error(
          `Those dates overlap another booking (${existing.startDate.toLocaleDateString()} – ${existing.endDate.toLocaleDateString()}). Please choose different dates.`
        );
      }
    }

    const now = new Date();
    const booking: Booking = {
      id: newId('book'),
      listingId: listing.id,
      renterId: renter.id,
      pricingTierId: tier.id,
      status: 'PENDING_PAYMENT',
      disputeStatus: 'NONE',
      verificationCode: `PICKUP-${Math.floor(1000 + Math.random() * 9000)}`,
      totalAmountInCents: billableUnits(tier.type, start, end) * tier.priceInCents,
      depositAmountInCents: listing.depositRequiredInCents,
      startDate: start,
      endDate: end,
      handoverCompletedAt: null,
      handoverNotes: null,
      returnConditionLogId: null,
      createdAt: now,
      updatedAt: now,
    };
    memoryStore.bookings.set(booking.id, booking);

    const logId = newId('sys_log');
    memoryStore.systemLogs.set(logId, {
      id: logId,
      eventType: 'BOOKING_CREATED',
      userId: renter.id,
      targetId: booking.id,
      metadata: {
        listingId: listing.id,
        listingTitle: listing.title,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        totalAmountInCents: booking.totalAmountInCents,
      },
      createdAt: now,
    });

    return { success: true as const, booking: toSummary(booking) };
  });
}

/**
 * Pickup: the renter enters the code the host gives them when they collect
 * the item. That moves the booking from PENDING_HANDOVER to ACTIVE. The
 * payment stays held until the host checks the item back in.
 */
export async function confirmHandover(
  bookingId: string,
  enteredCode: string,
  userId: string
): Promise<{ success: true; booking: BookingSummary }> {
  const validated = validateInput(ConfirmHandoverSchema, {
    bookingId,
    scannedCode: enteredCode,
    userId,
  });

  return await db.transaction(async () => {
    const booking = memoryStore.bookings.get(validated.bookingId);
    if (!booking || booking.renterId !== validated.userId) {
      throw new Error("We couldn't find that booking on your account.");
    }
    if (booking.status === 'ACTIVE') throw new Error('Pickup has already been confirmed for this booking.');
    if (booking.status !== 'PENDING_HANDOVER') throw new Error('This booking is not waiting for pickup.');

    const payment = Array.from(memoryStore.payments.values()).find((p) => p.bookingId === booking.id);
    if (!payment || payment.status !== 'HELD_IN_ESCROW') {
      throw new Error('Please complete payment before collecting the item.');
    }

    if (validated.scannedCode.trim().toUpperCase() !== booking.verificationCode.trim().toUpperCase()) {
      throw new Error("That code doesn't match. Please check it with your host.");
    }

    const now = new Date();
    const updated: Booking = {
      ...booking,
      status: 'ACTIVE',
      handoverCompletedAt: now,
      handoverNotes: 'Pickup confirmed with host code.',
      updatedAt: now,
    };
    memoryStore.bookings.set(booking.id, updated);

    const listing = memoryStore.listings.get(booking.listingId);
    const log: SystemLog = {
      id: newId('sys_log'),
      eventType: 'HANDOVER_COMPLETED',
      userId: booking.renterId,
      targetId: booking.id,
      metadata: { stage: 'pickup', listingId: booking.listingId, listingTitle: listing?.title },
      createdAt: now,
    };
    memoryStore.systemLogs.set(log.id, log);


    return { success: true as const, booking: toSummary(updated) };
  });
}
