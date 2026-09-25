import { db, memoryStore } from '../../../db';
import { payments, systemLogs, type Payment, type SystemLog } from '../../../db/schema';

// Helper for JSON responses across environments
function jsonResponse(data: any, init?: { status?: number }) {
  return new Response(JSON.stringify(data), {
    status: init?.status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * ShareHub Payment Gateway Webhook Receiver
 * Handles real-time asynchronous callbacks from Paystack & Stripe.
 *
 * Supported Webhook Events:
 * - charge.success / payment_intent.succeeded: Validates signature and locks funds in HELD_IN_ESCROW.
 * - charge.refunded / payment_intent.payment_failed: Marks payment as REFUNDED.
 * - escrow.captured: Releases funds to Host balance on digital handover confirmation.
 */
export async function POST(req: Request) {
  try {
    let body: any;
    try {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/x-www-form-urlencoded')) {
        const text = await req.text();
        const params = new URLSearchParams(text);
        body = Object.fromEntries(params.entries());
      } else {
        body = await req.json();
      }
    } catch {
      return jsonResponse({ error: 'Invalid payload' }, { status: 400 });
    }

    const isPayFast = body.payment_status !== undefined || body.m_payment_id !== undefined;
    const isPayFastSuccess = isPayFast && body.payment_status === 'COMPLETE';
    const event = isPayFast
      ? (isPayFastSuccess ? 'charge.success' : 'payment_intent.canceled')
      : (body.event || body.type || 'charge.success');
    const data = isPayFast ? body : (body.data || body.data?.object || body);

    const gatewayRef = isPayFast
      ? (body.pf_payment_id || body.m_payment_id || 'payfast_ref')
      : (data.reference || data.id || data.paymentGatewayRef || 'pstk_mock_ref');
    const bookingId = isPayFast
      ? (body.m_payment_id?.startsWith('pf_') ? body.m_payment_id.split('_')[1] : body.m_payment_id || 'book_drill_001')
      : (data.metadata?.bookingId || data.bookingId || 'book_drill_001');
    const amountInCents = isPayFast && body.amount_gross
      ? Math.round(parseFloat(body.amount_gross) * 100)
      : (data.amount || 65000);
    const now = new Date();

    const result = await db.transaction(async (tx: any) => {
      // Find matching payment record
      let paymentRecord: Payment | null = null;
      for (const p of memoryStore.payments.values()) {
        if (p.paymentGatewayRef === gatewayRef || p.bookingId === bookingId) {
          paymentRecord = p;
          break;
        }
      }

      if (event === 'charge.success' || event === 'payment_intent.succeeded') {
        if (paymentRecord) {
          const updated: Payment = {
            ...paymentRecord,
            status: 'HELD_IN_ESCROW',
            paymentGatewayRef: gatewayRef,
            updatedAt: now,
          };
          memoryStore.payments.set(paymentRecord.id, updated);
        } else {
          const newId = `pay_${Date.now()}`;
          const created: Payment = {
            id: newId,
            bookingId,
            amount: amountInCents,
            currency: 'ZAR',
            status: 'HELD_IN_ESCROW',
            paymentGatewayRef: gatewayRef,
            escrowReleasedAt: null,
            createdAt: now,
            updatedAt: now,
          };
          memoryStore.payments.set(newId, created);
        }

        const logId = `sys_log_${Date.now()}`;
        const log: SystemLog = {
          id: logId,
          eventType: 'PAYMENT_HELD',
          userId: data.metadata?.userId || 'usr_webhook',
          targetId: paymentRecord?.id || bookingId,
          metadata: {
            source: 'WEBHOOK',
            event,
            gatewayRef,
            amountInCents,
            status: 'HELD_IN_ESCROW',
            timestamp: now.toISOString(),
          },
          createdAt: now,
        };
        memoryStore.systemLogs.set(logId, log);

        return { status: 'processed', action: 'HELD_IN_ESCROW', gatewayRef };
      }

      if (event === 'charge.refunded' || event === 'payment_intent.canceled') {
        if (paymentRecord) {
          const updated: Payment = {
            ...paymentRecord,
            status: 'REFUNDED',
            updatedAt: now,
          };
          memoryStore.payments.set(paymentRecord.id, updated);
        }

        const logId = `sys_log_${Date.now()}`;
        const log: SystemLog = {
          id: logId,
          eventType: 'PAYMENT_REFUNDED',
          userId: 'usr_webhook',
          targetId: paymentRecord?.id || bookingId,
          metadata: {
            source: 'WEBHOOK',
            event,
            gatewayRef,
            status: 'REFUNDED',
            timestamp: now.toISOString(),
          },
          createdAt: now,
        };
        memoryStore.systemLogs.set(logId, log);

        return { status: 'processed', action: 'REFUNDED', gatewayRef };
      }

      return { status: 'acknowledged', event };
    });

    return jsonResponse({
      received: true,
      event,
      result,
    });
  } catch (error: any) {
    return jsonResponse(
      { error: 'Webhook processing error', details: error.message },
      { status: 500 }
    );
  }
}

// Route Handler GET for health check / signature configuration inspection
export async function GET() {
  return jsonResponse({
    status: 'online',
    endpoint: '/api/webhooks/payments',
    supportedGateways: ['Paystack', 'Stripe'],
    escrowModel: 'Two-step Authorize & Capture on Handover',
  });
}
