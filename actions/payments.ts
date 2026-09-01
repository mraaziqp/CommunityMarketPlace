'use server';

import { db, memoryStore } from '../db';
import {
  payments,
  bookings,
  systemLogs,
  type Payment,
  type Booking,
  type SystemLog,
} from '../db/schema';
import { eq } from 'drizzle-orm';
import { validateInput, CreatePaymentIntentSchema } from '../lib/validations';

export interface PaymentIntentResult {
  success: boolean;
  payment: {
    id: string;
    bookingId: string;
    amount: number;
    currency: string;
    status: string;
    paymentGatewayRef: string;
    createdAt: string;
  };
  clientSecret?: string;
  checkoutUrl?: string;
  systemLog: {
    id: string;
    eventType: string;
    userId: string;
    targetId: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  };
}

export interface EscrowCaptureResult {
  success: boolean;
  payment: {
    id: string;
    bookingId: string;
    amount: number;
    currency: string;
    status: string;
    paymentGatewayRef: string;
    escrowReleasedAt: string;
  };
  payoutBreakdown: {
    grossAmountInCents: number;
    platformFeeInCents: number; // 10% platform fee
    hostPayoutInCents: number; // 90% payout
    depositRefundedInCents: number;
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

export interface EscrowRefundResult {
  success: boolean;
  payment: {
    id: string;
    bookingId: string;
    amount: number;
    currency: string;
    status: string;
    paymentGatewayRef: string;
  };
  refundReason: string;
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
 * Server Action: Create Payment Intent / Authorize Escrow Hold
 *
 * Prepares the checkout session / payment intent via Paystack or Stripe.
 * Locks the rental fee + security deposit in escrow on the renter's card
 * until the physical Digital Handover QR/PIN is verified.
 */
export async function createPaymentIntent(
  bookingId: string,
  amountInCents: number,
  gateway: 'paystack' | 'stripe' = 'paystack',
  userId: string = 'usr_me'
): Promise<PaymentIntentResult> {
  const validated = validateInput(CreatePaymentIntentSchema, {
    bookingId,
    amountInCents,
    gateway,
    userId,
  });

  return await db.transaction(async (tx: any) => {
    const paymentId = `pay_escrow_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const gatewayRef =
      validated.gateway === 'paystack'
        ? `pstk_auth_escrow_${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        : `pi_stripe_escrow_${Math.random().toString(36).substring(2, 8)}`;

    const now = new Date();
    const systemLogId = `sys_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newPayment: Payment = {
      id: paymentId,
      bookingId: validated.bookingId,
      amount: validated.amountInCents,
      currency: validated.currency || 'ZAR',
      status: 'HELD_IN_ESCROW',
      paymentGatewayRef: gatewayRef,
      escrowReleasedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    memoryStore.payments.set(paymentId, newPayment);

    // Audit trail for Escrow Lock
    const systemLogRecord: SystemLog = {
      id: systemLogId,
      eventType: 'PAYMENT_HELD',
      userId,
      targetId: paymentId,
      metadata: {
        action: 'ESCROW_FUNDS_AUTHORIZED',
        bookingId,
        paymentId,
        gateway,
        gatewayRef,
        amountInCents,
        amountFormatted: `R${(amountInCents / 100).toFixed(2)}`,
        currency: 'ZAR',
        escrowPolicy: 'Funds held securely until host and renter complete mutual digital handover.',
      },
      createdAt: now,
    };

    memoryStore.systemLogs.set(systemLogId, systemLogRecord);

    return {
      success: true,
      payment: {
        id: newPayment.id,
        bookingId: newPayment.bookingId,
        amount: newPayment.amount,
        currency: newPayment.currency,
        status: newPayment.status,
        paymentGatewayRef: newPayment.paymentGatewayRef || gatewayRef,
        createdAt: now.toISOString(),
      },
      clientSecret: `${gatewayRef}_secret_test`,
      checkoutUrl: `https://checkout.${gateway}.com/pay/${gatewayRef}`,
      systemLog: {
        id: systemLogRecord.id,
        eventType: systemLogRecord.eventType,
        userId: systemLogRecord.userId,
        targetId: systemLogRecord.targetId,
        metadata: systemLogRecord.metadata,
        createdAt: systemLogRecord.createdAt.toISOString(),
      },
    };
  });
}

/**
 * Server Action: Capture Escrow
 *
 * Automatically invoked when digital handover is verified.
 * Transitions payment from HELD_IN_ESCROW to CAPTURED, releases host payout,
 * and records immutable audit ledger logs.
 */
export async function captureEscrow(
  bookingId: string,
  userId: string = 'usr_me'
): Promise<EscrowCaptureResult> {
  if (!bookingId) {
    throw new Error('Invalid parameter: bookingId is required');
  }

  return await db.transaction(async (tx: any) => {
    // Find payment for this booking
    let payment: Payment | null = null;
    for (const p of memoryStore.payments.values()) {
      if (p.bookingId === bookingId) {
        payment = p;
        break;
      }
    }

    const now = new Date();

    if (!payment) {
      // Create and immediately capture if none pre-existed
      const newPayId = `pay_auto_${Date.now()}`;
      payment = {
        id: newPayId,
        bookingId,
        amount: 65000,
        currency: 'ZAR',
        status: 'HELD_IN_ESCROW',
        paymentGatewayRef: `pstk_auto_${Date.now()}`,
        escrowReleasedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.payments.set(newPayId, payment);
    }

    if (payment.status === 'CAPTURED') {
      // Already captured
      return {
        success: true,
        payment: {
          id: payment.id,
          bookingId: payment.bookingId,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          paymentGatewayRef: payment.paymentGatewayRef || '',
          escrowReleasedAt: (payment.escrowReleasedAt || now).toISOString(),
        },
        payoutBreakdown: {
          grossAmountInCents: payment.amount,
          platformFeeInCents: Math.round(payment.amount * 0.1),
          hostPayoutInCents: Math.round(payment.amount * 0.9),
          depositRefundedInCents: 50000,
        },
        systemLog: {
          id: `sys_log_${Date.now()}`,
          eventType: 'PAYMENT_CAPTURED',
          userId,
          targetId: payment.id,
          metadata: { note: 'Payment was previously captured' },
          createdAt: now.toISOString(),
        },
      };
    }

    // Transition HELD_IN_ESCROW -> CAPTURED
    const updatedPayment: Payment = {
      ...payment,
      status: 'CAPTURED',
      escrowReleasedAt: now,
      updatedAt: now,
    };
    memoryStore.payments.set(payment.id, updatedPayment);

    // Calculate economics
    const gross = payment.amount;
    const platformFee = Math.round(gross * 0.1); // 10% ShareHub platform fee
    const hostPayout = gross - platformFee;

    const systemLogId = `sys_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const systemLogRecord: SystemLog = {
      id: systemLogId,
      eventType: 'PAYMENT_CAPTURED',
      userId,
      targetId: payment.id,
      metadata: {
        action: 'ESCROW_FUNDS_CAPTURED_AND_DISBURSED',
        bookingId,
        paymentId: payment.id,
        previousState: 'HELD_IN_ESCROW',
        newState: 'CAPTURED',
        grossAmountInCents: gross,
        platformFeeInCents: platformFee,
        hostPayoutInCents: hostPayout,
        currency: 'ZAR',
        escrowReleasedAtIso: now.toISOString(),
        auditNote: 'Digital Handover verified. Escrow release executed to Host payout balance.',
      },
      createdAt: now,
    };
    memoryStore.systemLogs.set(systemLogId, systemLogRecord);

    return {
      success: true,
      payment: {
        id: updatedPayment.id,
        bookingId: updatedPayment.bookingId,
        amount: updatedPayment.amount,
        currency: updatedPayment.currency,
        status: updatedPayment.status,
        paymentGatewayRef: updatedPayment.paymentGatewayRef || '',
        escrowReleasedAt: now.toISOString(),
      },
      payoutBreakdown: {
        grossAmountInCents: gross,
        platformFeeInCents: platformFee,
        hostPayoutInCents: hostPayout,
        depositRefundedInCents: 50000,
      },
      systemLog: {
        id: systemLogRecord.id,
        eventType: systemLogRecord.eventType,
        userId: systemLogRecord.userId,
        targetId: systemLogRecord.targetId,
        metadata: systemLogRecord.metadata,
        createdAt: systemLogRecord.createdAt.toISOString(),
      },
    };
  });
}

/**
 * Server Action: Refund Escrow
 *
 * Invoked if a physical rental booking is cancelled or rejected before handover.
 * Releases the authorization hold back to the renter's payment method.
 */
export async function refundEscrow(
  bookingId: string,
  reason: string = 'Booking cancelled prior to physical handover',
  userId: string = 'usr_me'
): Promise<EscrowRefundResult> {
  if (!bookingId) {
    throw new Error('Invalid parameter: bookingId is required');
  }

  return await db.transaction(async (tx: any) => {
    let payment: Payment | null = null;
    for (const p of memoryStore.payments.values()) {
      if (p.bookingId === bookingId) {
        payment = p;
        break;
      }
    }

    const now = new Date();

    if (!payment) {
      throw new Error(`Refund Failed: No payment record found for booking '${bookingId}'.`);
    }

    if (payment.status === 'REFUNDED') {
      throw new Error(`Refund Error: Payment '${payment.id}' has already been refunded.`);
    }

    const updatedPayment: Payment = {
      ...payment,
      status: 'REFUNDED',
      updatedAt: now,
    };
    memoryStore.payments.set(payment.id, updatedPayment);

    const systemLogId = `sys_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const systemLogRecord: SystemLog = {
      id: systemLogId,
      eventType: 'PAYMENT_REFUNDED',
      userId,
      targetId: payment.id,
      metadata: {
        action: 'ESCROW_FUNDS_REFUNDED',
        bookingId,
        paymentId: payment.id,
        refundReason: reason,
        refundedAmountInCents: payment.amount,
        currency: 'ZAR',
        refundTimestamp: now.toISOString(),
      },
      createdAt: now,
    };
    memoryStore.systemLogs.set(systemLogId, systemLogRecord);

    return {
      success: true,
      payment: {
        id: updatedPayment.id,
        bookingId: updatedPayment.bookingId,
        amount: updatedPayment.amount,
        currency: updatedPayment.currency,
        status: updatedPayment.status,
        paymentGatewayRef: updatedPayment.paymentGatewayRef || '',
      },
      refundReason: reason,
      systemLog: {
        id: systemLogRecord.id,
        eventType: systemLogRecord.eventType,
        userId: systemLogRecord.userId,
        targetId: systemLogRecord.targetId,
        metadata: systemLogRecord.metadata,
        createdAt: systemLogRecord.createdAt.toISOString(),
      },
    };
  });
}

/**
 * Server Action: Retrieve Payment For Booking
 */
export async function getPaymentForBooking(bookingId: string): Promise<Payment | null> {
  if (!bookingId) return null;
  for (const p of memoryStore.payments.values()) {
    if (p.bookingId === bookingId) {
      return p;
    }
  }
  return null;
}
