import { memoryStore, type PendingWrite } from '../db';
import type { SystemLog } from '../db/schema';
import { accessCodeFor } from '../actions/usage';
import { emailEnabled, renderEmail, sendEmail, type EmailContent } from './email';

/**
 * Turns committed business events into emails. Runs after each successful
 * commit, so a rolled-back change never emails anyone.
 */

const rand = (cents: number) =>
  `R${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (d: Date) =>
  d.toLocaleString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' });
const first = (name?: string | null) => (name ?? 'there').split(' ')[0];

type Outgoing = { to: string; content: EmailContent };

function user(id?: string | null) {
  return id ? memoryStore.users.get(id) : undefined;
}

function bookingContext(bookingId: string) {
  const booking = memoryStore.bookings.get(bookingId);
  if (!booking) return null;
  const listing = memoryStore.listings.get(booking.listingId);
  const renter = user(booking.renterId);
  const host = user(listing?.ownerId);
  if (!listing || !renter || !host) return null;
  return { booking, listing, renter, host };
}

/** The emails a single event should produce (pure: easy to test). */
export function emailsForEvent(log: SystemLog): Outgoing[] {
  const meta = (log.metadata ?? {}) as Record<string, any>;
  const out: Outgoing[] = [];

  switch (log.eventType) {
    case 'AUTH_SIGNUP': {
      const u = user(log.userId);
      if (u) {
        out.push({
          to: u.email,
          content: {
            subject: 'Welcome to ShareHub',
            heading: `Welcome, ${first(u.name)}!`,
            paragraphs: [
              'You can now borrow tools and gear from neighbours, book spaces, and join small co-ops that share appliances like washers and 3D printers.',
              'Got something you rarely use? List it in a couple of minutes and earn from it.',
            ],
            cta: { label: 'Open my dashboard', path: '/me' },
          },
        });
      }
      break;
    }

    case 'PAYMENT_HELD': {
      const ctx = meta.bookingId ? bookingContext(meta.bookingId) : null;
      if (!ctx) break;
      const { booking, listing, renter, host } = ctx;
      const dates = `${when(booking.startDate)} → ${when(booking.endDate)}`;
      out.push({
        to: renter.email,
        content: {
          subject: `Booking confirmed: ${listing.title}`,
          heading: "You're booked!",
          paragraphs: [
            `Your payment for ${listing.title} has been received. When you collect it, ${first(host.name)} will give you a pickup code — enter it in your dashboard to confirm you have the item.`,
            'Your deposit comes back once the item is returned in good order.',
          ],
          details: [
            ['When', dates],
            ['Where', `${listing.neighborhood}, ${listing.city}`],
            ['Host', host.name],
            ['Paid', rand(booking.totalAmountInCents + booking.depositAmountInCents)],
            ['Of which refundable deposit', rand(booking.depositAmountInCents)],
          ],
          cta: { label: 'View my rental', path: '/me/rentals' },
        },
      });
      out.push({
        to: host.email,
        content: {
          subject: `New booking: ${listing.title}`,
          heading: `${first(renter.name)} booked ${listing.title}`,
          paragraphs: [
            'The booking is paid. Give this code to the renter when you hand the item over; they enter it to confirm pickup.',
          ],
          code: { label: 'Pickup code', value: booking.verificationCode },
          details: [
            ['When', dates],
            ['Renter', renter.name],
            ['Rental', rand(booking.totalAmountInCents)],
          ],
          cta: { label: 'Manage bookings', path: '/me/listings' },
        },
      });
      break;
    }

    case 'PAYMENT_CAPTURED': {
      if (meta.kind === 'subscription' && meta.subscriptionId) {
        const sub = memoryStore.userSubscriptions.get(meta.subscriptionId);
        const listing = sub ? memoryStore.listings.get(sub.listingId) : undefined;
        const member = user(sub?.userId);
        if (!sub || !listing || !member) break;
        const tier = memoryStore.pricingTiers.get(sub.pricingTierId);
        out.push({
          to: member.email,
          content: {
            subject: `Welcome to ${listing.title}`,
            heading: "You're in the co-op!",
            paragraphs: [
              `Your membership of ${listing.title} is active. Use your personal code to start a turn, and log each turn from your dashboard.`,
              'Your turns refresh each month. To cancel, manage the subscription in your PayFast account.',
            ],
            code: { label: 'Your access code', value: accessCodeFor(sub.id, listing.accessMethod) },
            details: [
              ['Plan', tier?.name ?? 'Membership'],
              ['Turns this month', String(sub.remainingUsesThisPeriod)],
              ['Monthly', rand(meta.amountInCents ?? tier?.priceInCents ?? 0)],
            ],
            cta: { label: 'Open my memberships', path: '/me/memberships' },
          },
        });
      } else if (meta.kind === 'subscription_renewal') {
        const payment = memoryStore.payments.get(log.targetId);
        const sub = payment?.subscriptionId ? memoryStore.userSubscriptions.get(payment.subscriptionId) : undefined;
        const listing = sub ? memoryStore.listings.get(sub.listingId) : undefined;
        const member = user(sub?.userId);
        if (!sub || !listing || !member) break;
        out.push({
          to: member.email,
          content: {
            subject: `Receipt: ${listing.title} membership`,
            heading: 'Membership renewed',
            paragraphs: [`Thanks! Your membership of ${listing.title} has renewed and your turns have been refreshed.`],
            details: [
              ['Amount', rand(meta.amountInCents ?? payment?.amount ?? 0)],
              ['Next renewal', sub.currentPeriodEnd.toLocaleDateString('en-ZA')],
            ],
            cta: { label: 'Open my memberships', path: '/me/memberships' },
          },
        });
      } else if (meta.kind === 'test' || meta.kind === 'test_renewal') {
        const admin = user(log.userId);
        const payment = memoryStore.payments.get(log.targetId);
        if (!admin || !payment) break;
        out.push({
          to: admin.email,
          content: {
            subject: `Test payment received: ${rand(payment.amount)}`,
            heading: 'PayFast test payment received ✓',
            paragraphs: [
              'PayFast confirmed the payment, the notification reached ShareHub and passed every check. The gateway is working end to end.',
            ],
            details: [
              ['Amount', rand(payment.amount)],
              ['PayFast reference', payment.paymentGatewayRef ?? '—'],
              ['Type', meta.kind === 'test_renewal' ? 'Monthly renewal' : meta.recurring ? 'Monthly (first payment)' : 'Once-off'],
            ],
            cta: { label: 'Open payments', path: '/admin/payments' },
          },
        });
      }
      break;
    }

    case 'HANDOVER_COMPLETED': {
      const ctx = bookingContext(log.targetId);
      if (!ctx) break;
      const { booking, listing, renter, host } = ctx;
      const isReturn = meta.stage === 'return' || String(meta.action ?? '').includes('RETURN');
      if (!isReturn) {
        out.push({
          to: host.email,
          content: {
            subject: `${listing.title} was picked up`,
            heading: 'Pickup confirmed',
            paragraphs: [`${renter.name} has collected ${listing.title}. It's due back ${when(booking.endDate)}.`],
            cta: { label: 'View booking', path: '/me/listings' },
          },
        });
      } else {
        const payment = Array.from(memoryStore.payments.values()).find((p) => p.bookingId === booking.id);
        out.push({
          to: renter.email,
          content: {
            subject: `Returned: ${listing.title}`,
            heading: 'All returned — thank you!',
            paragraphs: [
              `${first(host.name)} has checked ${listing.title} back in.`,
              booking.depositAmountInCents > 0
                ? `Your ${rand(booking.depositAmountInCents)} deposit is on its way back to you.`
                : 'There was no deposit on this rental.',
              'How did it go? A quick review helps your neighbours choose with confidence.',
            ],
            cta: { label: 'Leave a review', path: '/me/rentals' },
          },
        });
        out.push({
          to: host.email,
          content: {
            subject: `Payout due: ${listing.title}`,
            heading: 'Rental complete',
            paragraphs: ['Thanks for sharing! Your payout for this rental is now due and will be paid to you shortly.'],
            details: [['Your payout', rand(payment?.hostPayoutInCents ?? Math.round(booking.totalAmountInCents * 0.9))]],
            cta: { label: 'View earnings', path: '/me/earnings' },
          },
        });
      }
      break;
    }

    case 'DISPUTE_RAISED': {
      const ctx = bookingContext(log.targetId);
      if (!ctx) break;
      const { listing, renter, host } = ctx;
      for (const person of [renter, host]) {
        out.push({
          to: person.email,
          content: {
            subject: `A problem was reported: ${listing.title}`,
            heading: "We're looking into a return",
            paragraphs: [
              `${first(host.name)} reported a problem when ${listing.title} came back. The payout and the deposit are paused while we review the notes and photos.`,
              "We'll be in touch with you both. Reply to this email if you'd like to add anything.",
            ],
            cta: { label: 'View rental', path: person.id === host.id ? '/me/listings' : '/me/rentals' },
          },
        });
      }
      break;
    }

    case 'REVIEW_SUBMITTED': {
      const host = user(meta.targetId);
      if (!host) break;
      out.push({
        to: host.email,
        content: {
          subject: `You got a ${meta.rating}-star review`,
          heading: 'New review',
          paragraphs: [`${meta.reviewerName ?? 'A renter'} left you a ${meta.rating}-star review.`, meta.commentSnippet ? `“${meta.commentSnippet}”` : ''].filter(Boolean),
          cta: { label: 'Open my dashboard', path: '/me' },
        },
      });
      break;
    }

    case 'SUBSCRIPTION_CANCELLED': {
      if (meta.kind === 'test') break;
      const sub = memoryStore.userSubscriptions.get(log.targetId);
      const listing = sub ? memoryStore.listings.get(sub.listingId) : undefined;
      const member = user(sub?.userId);
      if (!sub || !listing || !member) break;
      out.push({
        to: member.email,
        content: {
          subject: `Membership ended: ${listing.title}`,
          heading: 'Your membership has ended',
          paragraphs: [`Your membership of ${listing.title} was cancelled and won't renew. You're welcome back any time a spot is free.`],
          cta: { label: 'Browse listings', path: '/' },
        },
      });
      break;
    }
  }
  return out;
}

/** Hooked to memoryStore.onCommitted. */
export function sendCommittedNotifications(writes: PendingWrite[]) {
  if (!emailEnabled()) return;
  for (const w of writes) {
    if (w.collection !== 'systemLogs' || !w.record) continue;
    let emails: Outgoing[] = [];
    try {
      emails = emailsForEvent(w.record as SystemLog);
    } catch (err) {
      console.error('[email] could not build notification', err);
    }
    for (const e of emails) void sendEmail({ to: e.to, ...renderEmail(e.content) });
  }
}
