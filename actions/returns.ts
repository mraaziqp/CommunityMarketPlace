
import { db, memoryStore } from '../db';
import {
  conditionLogs,
  bookings,
  payments,
  systemLogs,
  type ConditionLog,
  type Booking,
  type Payment,
  type SystemLog,
} from '../db/schema';
import { eq } from 'drizzle-orm';
import { validateInput, LogConditionSchema } from '../lib/validations';

export interface LogConditionInput {
  bookingId: string;
  type: 'PICKUP' | 'RETURN';
  conditionStatus: 'GOOD' | 'MINOR_WEAR' | 'DAMAGED';
  notes?: string;
  imageUrls?: string[];
  reportedBy?: string;
}

export interface ConditionLogResult {
  success: boolean;
  conditionLog: {
    id: string;
    bookingId: string;
    type: 'PICKUP' | 'RETURN';
    conditionStatus: 'GOOD' | 'MINOR_WEAR' | 'DAMAGED';
    notes?: string | null;
    imageUrls: string[];
    reportedBy: string;
    createdAt: string;
  };
  systemLog: {
    id: string;
    eventType: string;
    userId: string;
    targetId: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  };
}

export interface ConfirmReturnResult {
  success: boolean;
  booking: {
    id: string;
    status: string;
    disputeStatus: string;
    handoverCompletedAt?: string | null;
  };
  escrowPayout: {
    paymentId: string;
    amountInCents: number;
    status: string;
    escrowReleasedAt: string;
    depositRefundedInCents: number;
    hostEarningsInCents: number;
  };
  conditionLog: {
    id: string;
    conditionStatus: string;
    notes?: string | null;
    imageUrls: string[];
  };
  systemLog: {
    id: string;
    eventType: string;
    userId: string;
    targetId: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  };
}

export interface DisputeResult {
  success: boolean;
  booking: {
    id: string;
    status: string;
    disputeStatus: string;
  };
  escrowStatus: {
    paymentId?: string;
    status: string;
    amountInCents: number;
    frozenAt: string;
  };
  disputeLog: {
    id: string;
    conditionStatus: string;
    notes?: string | null;
    imageUrls: string[];
  };
  systemLog: {
    id: string;
    eventType: string;
    userId: string;
    targetId: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  };
}

/**
 * Server Action: Log Item Condition during Pickup or Return
 *
 * Captures item inspection sign-off, photo evidence, and notes.
 * Used for pre-trip baseline and post-trip return reconciliation.
 */
export async function logCondition(
  input: LogConditionInput
): Promise<ConditionLogResult> {
  const validated = validateInput(LogConditionSchema, input);

  const {
    bookingId,
    type,
    conditionStatus,
    notes = '',
    imageUrls = [],
    reportedBy = 'usr_me',
  } = { ...input, ...validated };

  return await db.transaction(async (tx: any) => {
    const logId = `cond_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date();
    const systemLogId = `sys_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newLog: ConditionLog = {
      id: logId,
      bookingId,
      type,
      conditionStatus,
      notes: notes || null,
      imageUrls,
      reportedBy,
      createdAt: now,
    };

    // 1. Insert Condition Log record
    memoryStore.conditionLogs.set(logId, newLog);
    if (tx.insert && tx.insert(conditionLogs)) {
      try {
        await tx.insert(conditionLogs).values(newLog);
      } catch {
        // Handled by memoryStore fallback
      }
    }

    // 2. Update booking return condition pointer if return
    if (type === 'RETURN') {
      const existingBooking = memoryStore.bookings.get(bookingId);
      if (existingBooking) {
        existingBooking.returnConditionLogId = logId;
        existingBooking.updatedAt = now;
        memoryStore.bookings.set(bookingId, existingBooking);
      }
      if (tx.update && tx.update(bookings)) {
        try {
          await tx.update(bookings).set({ returnConditionLogId: logId, updatedAt: now }).where(eq(bookings.id, bookingId));
        } catch {
          // Handled
        }
      }
    }

    // 3. System Audit Log
    const newSysLog: SystemLog = {
      id: systemLogId,
      eventType: 'CONDITION_LOGGED',
      userId: reportedBy,
      targetId: logId,
      metadata: {
        bookingId,
        inspectionType: type,
        conditionStatus,
        notesPreview: notes ? notes.substring(0, 100) : '',
        photoCount: imageUrls.length,
        timestamp: now.toISOString(),
      },
      createdAt: now,
    };

    memoryStore.systemLogs.set(systemLogId, newSysLog);

    return {
      success: true,
      conditionLog: {
        id: newLog.id,
        bookingId: newLog.bookingId,
        type: newLog.type,
        conditionStatus: newLog.conditionStatus,
        notes: newLog.notes,
        imageUrls: newLog.imageUrls,
        reportedBy: newLog.reportedBy,
        createdAt: newLog.createdAt.toISOString(),
      },
      systemLog: {
        id: newSysLog.id,
        eventType: newSysLog.eventType,
        userId: newSysLog.userId,
        targetId: newSysLog.targetId,
        metadata: newSysLog.metadata as Record<string, unknown>,
        createdAt: newSysLog.createdAt.toISOString(),
      },
    };
  });
}

/**
 * Server Action: Confirm Return Handover & Release Escrow
 *
 * Triggered when both host and renter agree the item is returned in Good / Acceptable condition.
 * - Updates booking status to 'COMPLETED'
 * - Releases escrow funds (payout to host + automatic deposit release to renter)
 * - Records condition audit entry
 */
export async function confirmReturn(
  bookingId: string,
  conditionStatus: 'GOOD' | 'MINOR_WEAR' = 'GOOD',
  notes: string = 'Return inspection completed. Item received in expected condition.',
  imageUrls: string[] = [],
  userId: string
): Promise<ConfirmReturnResult> {
  if (!bookingId) {
    throw new Error('Invalid parameter: bookingId is required');
  }

  return await db.transaction(async (tx: any) => {
    const now = new Date();
    const conditionLogId = `cond_return_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const systemLogId = `sys_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // 1. Only the listing's host can check an item back in, once it is out.
    const stored = memoryStore.bookings.get(bookingId);
    const listing = stored ? memoryStore.listings.get(stored.listingId) : undefined;
    if (!stored || !listing || listing.ownerId !== userId) {
      throw new Error("We couldn't find that booking for your listing.");
    }
    if (stored.status !== 'ACTIVE') throw new Error('Only items that have been picked up can be checked back in.');
    if (stored.disputeStatus === 'PENDING_REVIEW') throw new Error('This return is already under review.');

    const booking = {
      ...stored,
      status: 'COMPLETED' as const,
      disputeStatus: 'NONE' as const,
      handoverNotes: notes,
      returnConditionLogId: conditionLogId,
      updatedAt: now,
    };
    memoryStore.bookings.set(bookingId, booking);

    // 2. Release the held payment to the host (the deposit goes back to the renter).
    const held = Array.from(memoryStore.payments.values()).find((p) => p.bookingId === bookingId);
    if (!held) throw new Error('There is no payment on this booking to release.');
    if (held.status !== 'HELD_IN_ESCROW') throw new Error('The payment for this booking is not being held.');
    // Settled outside the gateway: the host's share and the renter's deposit are now owed.
    const payment = {
      ...held,
      status: 'CAPTURED' as const,
      escrowReleasedAt: now,
      hostPayoutStatus: 'due' as const,
      hostPayoutInCents: Math.round(stored.totalAmountInCents * 0.9),
      depositRefundStatus: stored.depositAmountInCents > 0 ? ('due' as const) : ('none' as const),
      updatedAt: now,
    };
    memoryStore.payments.set(payment.id, payment);

    // 3. Log Condition Sign-Off
    const returnLog: ConditionLog = {
      id: conditionLogId,
      bookingId,
      type: 'RETURN',
      conditionStatus,
      notes,
      imageUrls,
      reportedBy: userId,
      createdAt: now,
    };
    memoryStore.conditionLogs.set(conditionLogId, returnLog);

    // Calculate payouts
    const depositAmount = booking.depositAmountInCents || 0;
    const rentalAmount = booking.totalAmountInCents;
    const hostEarnings = Math.round(rentalAmount * 0.9); // 90% payout, 10% platform fee

    // 4. System Audit Log
    const newSysLog: SystemLog = {
      id: systemLogId,
      eventType: 'HANDOVER_COMPLETED',
      userId,
      targetId: bookingId,
      metadata: {
        bookingId,
        paymentId: payment.id,
        action: 'RETURN_CONFIRMED_AND_ESCROW_RELEASED',
        conditionStatus,
        depositRefundedZAR: depositAmount / 100,
        hostPayoutZAR: hostEarnings / 100,
        completedAt: now.toISOString(),
      },
      createdAt: now,
    };
    memoryStore.systemLogs.set(systemLogId, newSysLog);

    return {
      success: true,
      booking: {
        id: booking.id,
        status: booking.status,
        disputeStatus: booking.disputeStatus,
        handoverCompletedAt: now.toISOString(),
      },
      escrowPayout: {
        paymentId: payment.id,
        amountInCents: payment.amount,
        status: payment.status,
        escrowReleasedAt: now.toISOString(),
        depositRefundedInCents: depositAmount,
        hostEarningsInCents: hostEarnings,
      },
      conditionLog: {
        id: returnLog.id,
        conditionStatus: returnLog.conditionStatus,
        notes: returnLog.notes,
        imageUrls: returnLog.imageUrls,
      },
      systemLog: {
        id: newSysLog.id,
        eventType: newSysLog.eventType,
        userId: newSysLog.userId,
        targetId: newSysLog.targetId,
        metadata: newSysLog.metadata as Record<string, unknown>,
        createdAt: newSysLog.createdAt.toISOString(),
      },
    };
  });
}

/**
 * Server Action: Initiate Dispute & Freeze Escrow
 *
 * Used when an item is returned damaged, missing parts, or unreturned.
 * - Freezes escrow payment (prevents automated release to host/renter)
 * - Sets booking disputeStatus to 'PENDING_REVIEW'
 * - Records photo evidence, damage notes, and inspection report
 * - Enters community arbitration workflow
 */
export async function initiateDispute(
  bookingId: string,
  conditionStatus: 'DAMAGED' | 'MINOR_WEAR' = 'DAMAGED',
  notes: string,
  imageUrls: string[] = [],
  reportedBy: string
): Promise<DisputeResult> {
  if (!bookingId) {
    throw new Error('Invalid parameter: bookingId is required');
  }

  if (!notes || notes.trim().length < 5) {
    throw new Error('Please provide specific details and notes about the damage or missing components.');
  }

  return await db.transaction(async (tx: any) => {
    const now = new Date();
    const conditionLogId = `cond_dispute_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const systemLogId = `sys_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // 1. Only the listing's host can report a problem, while the item is out.
    const stored = memoryStore.bookings.get(bookingId);
    const listing = stored ? memoryStore.listings.get(stored.listingId) : undefined;
    if (!stored || !listing || listing.ownerId !== reportedBy) {
      throw new Error("We couldn't find that booking for your listing.");
    }
    if (stored.status !== 'ACTIVE') throw new Error('Only items that have been picked up can be checked back in.');
    if (stored.disputeStatus === 'PENDING_REVIEW') throw new Error('This return is already under review.');

    const booking = { ...stored, disputeStatus: 'PENDING_REVIEW' as const, returnConditionLogId: conditionLogId, updatedAt: now };
    memoryStore.bookings.set(bookingId, booking);

    // 2. Pause the payout while the issue is reviewed.
    const held = Array.from(memoryStore.payments.values()).find((p) => p.bookingId === bookingId);
    if (!held) throw new Error('There is no payment on this booking to hold.');
    const payment = { ...held, status: 'FROZEN_ESCROW' as const, updatedAt: now };
    memoryStore.payments.set(payment.id, payment);

    // 3. Condition / Damage Log
    const disputeLog: ConditionLog = {
      id: conditionLogId,
      bookingId,
      type: 'RETURN',
      conditionStatus,
      notes,
      imageUrls,
      reportedBy,
      createdAt: now,
    };
    memoryStore.conditionLogs.set(conditionLogId, disputeLog);

    // 4. System Audit Log
    const newSysLog: SystemLog = {
      id: systemLogId,
      eventType: 'DISPUTE_RAISED',
      userId: reportedBy,
      targetId: bookingId,
      metadata: {
        bookingId,
        paymentId: payment.id,
        conditionStatus,
        frozenEscrowAmountZAR: payment.amount / 100,
        damageNotes: notes,
        photoCount: imageUrls.length,
        timestamp: now.toISOString(),
      },
      createdAt: now,
    };
    memoryStore.systemLogs.set(systemLogId, newSysLog);

    return {
      success: true,
      booking: {
        id: booking.id,
        status: booking.status,
        disputeStatus: booking.disputeStatus,
      },
      escrowStatus: {
        paymentId: payment.id,
        status: 'FROZEN_ESCROW',
        amountInCents: payment.amount,
        frozenAt: now.toISOString(),
      },
      disputeLog: {
        id: disputeLog.id,
        conditionStatus: disputeLog.conditionStatus,
        notes: disputeLog.notes,
        imageUrls: disputeLog.imageUrls,
      },
      systemLog: {
        id: newSysLog.id,
        eventType: newSysLog.eventType,
        userId: newSysLog.userId,
        targetId: newSysLog.targetId,
        metadata: newSysLog.metadata as Record<string, unknown>,
        createdAt: newSysLog.createdAt.toISOString(),
      },
    };
  });
}

/**
 * Fetch all condition logs for a booking (pickup baseline & return audit)
 */
export async function getConditionLogs(bookingId: string): Promise<ConditionLog[]> {
  if (!bookingId) return [];

  const logs = Array.from(memoryStore.conditionLogs.values()).filter(
    (log) => log.bookingId === bookingId
  );

  return logs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * Server Action: Resolve Dispute
 *
 * Administrator or community trust committee resolution.
 */
export async function resolveDispute(
  bookingId: string,
  resolutionNotes: string,
  payoutAction: 'RELEASE_TO_HOST' | 'REFUND_TO_RENTER' | 'SPLIT_DEPOSIT',
  resolvedBy: string = 'usr_me'
): Promise<{ success: boolean; disputeStatus: string; paymentStatus: string }> {
  return await db.transaction(async (tx: any) => {
    const now = new Date();
    const booking = memoryStore.bookings.get(bookingId);
    if (!booking) throw new Error('Booking not found');

    booking.disputeStatus = 'RESOLVED';
    booking.updatedAt = now;
    memoryStore.bookings.set(bookingId, booking);

    const payment = Array.from(memoryStore.payments.values()).find((p) => p.bookingId === bookingId);
    let finalPaymentStatus = 'CAPTURED';
    if (payment) {
      if (payoutAction === 'REFUND_TO_RENTER') {
        payment.status = 'REFUNDED';
        finalPaymentStatus = 'REFUNDED';
      } else {
        payment.status = 'CAPTURED';
        payment.escrowReleasedAt = now;
        finalPaymentStatus = 'CAPTURED';
      }
      payment.updatedAt = now;
      memoryStore.payments.set(payment.id, payment);
    }

    const sysLogId = `sys_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newSysLog: SystemLog = {
      id: sysLogId,
      eventType: 'DISPUTE_RESOLVED',
      userId: resolvedBy,
      targetId: bookingId,
      metadata: {
        bookingId,
        resolutionNotes,
        payoutAction,
        resolvedAt: now.toISOString(),
      },
      createdAt: now,
    };
    memoryStore.systemLogs.set(sysLogId, newSysLog);

    return {
      success: true,
      disputeStatus: 'RESOLVED',
      paymentStatus: finalPaymentStatus,
    };
  });
}
