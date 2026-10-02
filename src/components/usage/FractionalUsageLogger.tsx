import React, { useState } from 'react';
import {
  Zap,
  CheckCircle2,
  Clock,
  AlertCircle,
  KeyRound,
  History,
  X,
  Loader2,
  Star,
  CalendarDays,
  Package,
  Repeat,
  CreditCard,
  ShieldAlert,
  Users,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import { ActivityHistoryItem, BookingModel, MemberActivity, UserSubscriptionModel } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';

export interface FractionalUsageLoggerProps {
  activity: MemberActivity;
  onClose: () => void;
  /** Each action rejects with a friendly message that is shown inline. */
  onLogUsage: (subscriptionId: string, notes: string) => Promise<void>;
  onConfirmPickup: (bookingId: string, code: string) => Promise<void>;
  onPay: (booking: BookingModel) => void;
  onCheckReturn: (booking: BookingModel) => void;
  onReview: (booking: BookingModel) => void;
  onBrowse: () => void;
}

type Tab = 'rentals' | 'coops' | 'history';

const dateFmt: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
const fmtDate = (iso: string) => new Date(iso).toLocaleString([], dateFmt);

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
}

function statusChip(b: BookingModel): { label: string; className: string } {
  if (b.disputeStatus === 'PENDING_REVIEW') return { label: 'Under review', className: 'bg-rose-50 text-rose-800 border-rose-200' };
  switch (b.status) {
    case 'PENDING_PAYMENT':
      return { label: 'Awaiting payment', className: 'bg-slate-100 text-slate-700 border-slate-200' };
    case 'PENDING_HANDOVER':
      return { label: 'Ready for pickup', className: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'ACTIVE':
      return { label: b.viewerRole === 'host' ? 'Out on loan' : 'With you', className: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
    case 'COMPLETED':
      return { label: 'Returned', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    case 'CANCELLED':
      return { label: 'Cancelled', className: 'bg-slate-100 text-slate-500 border-slate-200' };
    default:
      return { label: 'Pending', className: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
}

const HISTORY_ICON: Record<ActivityHistoryItem['kind'], React.ReactNode> = {
  booking: <CalendarDays className="w-4 h-4 text-indigo-600" />,
  pickup: <Package className="w-4 h-4 text-amber-600" />,
  return: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  usage: <Zap className="w-4 h-4 text-amber-500" />,
  payment: <CreditCard className="w-4 h-4 text-slate-600" />,
  review: <Star className="w-4 h-4 text-amber-500" />,
  listing: <Sparkles className="w-4 h-4 text-indigo-600" />,
  circle: <Users className="w-4 h-4 text-emerald-600" />,
  account: <Sparkles className="w-4 h-4 text-indigo-600" />,
  dispute: <ShieldAlert className="w-4 h-4 text-rose-600" />,
};

function EmptyState({ icon, title, body, onBrowse }: { icon: React.ReactNode; title: string; body: string; onBrowse: () => void }) {
  return (
    <div className="text-center py-12 px-4 space-y-3 bg-slate-50 rounded-2xl border border-slate-200/80">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-white border border-slate-200 flex items-center justify-center">{icon}</div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mx-auto">{body}</p>
      <button
        type="button"
        onClick={onBrowse}
        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
      >
        Browse listings
      </button>
    </div>
  );
}

function RentalCard({
  booking,
  onConfirmPickup,
  onPay,
  onCheckReturn,
  onReview,
}: {
  booking: BookingModel;
  onConfirmPickup: (bookingId: string, code: string) => Promise<void>;
  onPay: (b: BookingModel) => void;
  onCheckReturn: (b: BookingModel) => void;
  onReview: (b: BookingModel) => void;
}) {
  const [code, setCode] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chip = statusChip(booking);
  const isHost = booking.viewerRole === 'host';
  const hostFirst = (booking.hostName ?? 'your host').split(' ')[0];
  const renterFirst = booking.renterName.split(' ')[0];
  const underReview = booking.disputeStatus === 'PENDING_REVIEW';

  const confirmPickup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsWorking(true);
    try {
      await onConfirmPickup(booking.id, code);
      setCode('');
    } catch (err: any) {
      setError(err?.message || 'That did not work. Please try again.');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <article className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3">
      <div className="flex items-start gap-3">
        {booking.listingImage && (
          <img src={booking.listingImage} alt="" referrerPolicy="no-referrer" className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-sm text-slate-900 leading-snug">{booking.listingTitle}</h3>
            <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap', chip.className)}>{chip.label}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isHost ? `Booked by ${booking.renterName}` : `Hosted by ${booking.hostName}`}
          </p>
          <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
            {fmtDate(booking.startDate)} → {fmtDate(booking.endDate)}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            {formatCurrency(booking.totalAmountInCents)}
            {booking.depositAmountInCents > 0 && (
              <span className="text-slate-400"> + {formatCurrency(booking.depositAmountInCents)} refundable deposit</span>
            )}
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {underReview ? (
        <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-xs text-rose-900">
          {isHost
            ? "You reported a problem with this return. We're looking into it and the payout is paused until it's sorted."
            : `${hostFirst} reported a problem with the return. We're looking into it and will be in touch.`}
        </div>
      ) : booking.status === 'PENDING_PAYMENT' ? (
        isHost ? (
          <p className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
            Waiting for {renterFirst} to pay. We'll show you the pickup code once they do.
          </p>
        ) : (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs text-slate-700">Your dates are held for 30 minutes. Pay to lock them in.</p>
            <button
              type="button"
              onClick={() => onPay(booking)}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" /> Pay now
            </button>
          </div>
        )
      ) : booking.status === 'CANCELLED' ? (
        <p className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
          {isHost ? 'This booking was not paid for, so the dates were released.' : 'This booking was not paid in time, so the dates were released. You can book again any time.'}
        </p>
      ) : booking.status === 'PENDING_HANDOVER' ? (
        isHost ? (
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-1.5">
            <p>
              {renterFirst} is collecting on {fmtDate(booking.startDate)}. Give them this code when you hand it over:
            </p>
            <p className="font-mono text-lg font-bold tracking-wider text-amber-900">{booking.verificationCode}</p>
          </div>
        ) : (
          <form onSubmit={confirmPickup} className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
            <p className="text-xs text-amber-950">
              <KeyRound className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              When you collect it, {hostFirst} will give you a pickup code. Enter it here to confirm you have the item.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="PICKUP-1234"
                aria-label="Pickup code"
                autoCapitalize="characters"
                className="flex-1 min-w-0 px-3 py-2 text-sm bg-white rounded-xl border border-slate-200 focus:border-slate-400 outline-none font-mono uppercase"
              />
              <button
                type="submit"
                disabled={isWorking || code.trim().length < 3}
                className="py-2 px-4 rounded-xl font-bold text-xs text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                {isWorking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                Confirm pickup
              </button>
            </div>
          </form>
        )
      ) : booking.status === 'ACTIVE' ? (
        isHost ? (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-indigo-50/70 border border-indigo-200">
            <p className="text-xs text-indigo-950">Due back {fmtDate(booking.endDate)}. Check it over when {renterFirst} returns it.</p>
            <button
              type="button"
              onClick={() => onCheckReturn(booking)}
              className="px-3.5 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Check it back in
            </button>
          </div>
        ) : (
          <p className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950">
            Enjoy! Please return it to {hostFirst} by {fmtDate(booking.endDate)}. Your deposit comes back once it's checked in.
          </p>
        )
      ) : booking.status === 'COMPLETED' ? (
        isHost ? (
          <p className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
            Returned and checked in. Your payment has been released.
          </p>
        ) : booking.hasReview ? (
          <p className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Returned. Thanks for leaving a review!
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-amber-50/60 border border-amber-200">
            <p className="text-xs text-amber-950">All done, and your deposit is on its way back. How was it?</p>
            <button
              type="button"
              onClick={() => onReview(booking)}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Star className="w-3.5 h-3.5 fill-stone-950" /> Review {hostFirst}
            </button>
          </div>
        )
      ) : null}
    </article>
  );
}

function CoopPanel({
  subscriptions,
  usageLogs,
  onLogUsage,
}: {
  subscriptions: UserSubscriptionModel[];
  usageLogs: MemberActivity['usageLogs'];
  onLogUsage: (subscriptionId: string, notes: string) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState(subscriptions[0]?.id ?? '');
  const [notes, setNotes] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = subscriptions.find((s) => s.id === selectedId) ?? subscriptions[0];
  const logs = usageLogs.filter((l) => l.subscriptionId === active?.id);

  const startTurn = async () => {
    if (!active) return;
    setError(null);
    setIsWorking(true);
    try {
      await onLogUsage(active.id, notes.trim());
      setNotes('');
    } catch (err: any) {
      setError(err?.message || 'That did not work. Please try again.');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
      <div className="md:col-span-6 space-y-3">
        {subscriptions.map((sub) => {
          const limit = sub.pricingTier.usageLimitPerPeriod || 10;
          const pct = (sub.remainingUsesThisPeriod / limit) * 100;
          const isSelected = sub.id === active?.id;
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => setSelectedId(sub.id)}
              aria-pressed={isSelected}
              className={cn(
                'w-full p-3.5 rounded-2xl border text-left cursor-pointer transition-all',
                isSelected ? 'bg-slate-50 border-slate-900 ring-2 ring-slate-200' : 'bg-white border-slate-200 hover:border-slate-300'
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h4 className="font-bold text-xs text-slate-900 line-clamp-1">{sub.listing.title}</h4>
                <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">{sub.pricingTier.name}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-slate-500">Turns left</span>
                <span className="font-bold text-slate-800">
                  {sub.remainingUsesThisPeriod} of {limit}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-300',
                    sub.remainingUsesThisPeriod > 3 ? 'bg-slate-900' : sub.remainingUsesThisPeriod > 0 ? 'bg-amber-500' : 'bg-rose-500'
                  )}
                  style={{ width: `${Math.max(4, pct)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">Refreshes {new Date(sub.currentPeriodEnd).toLocaleDateString()}</p>
            </button>
          );
        })}

        {active && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            {error && (
              <div role="alert" className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-center gap-2.5 text-xs text-slate-800">
              <KeyRound className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                Your access code: <strong className="font-mono text-sm">{active.accessKeyOrCode}</strong>
              </span>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700 block mb-1">
                Note <span className="font-normal text-slate-400">(optional)</span>
              </span>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. 40° cotton wash"
                className="w-full px-3 py-2 text-sm bg-white rounded-xl border border-slate-200 focus:border-slate-400 outline-none"
              />
            </label>
            <button
              type="button"
              onClick={startTurn}
              disabled={isWorking || active.remainingUsesThisPeriod <= 0}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              {isWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-amber-400" />}
              {active.remainingUsesThisPeriod > 0 ? 'Start my turn' : 'No turns left this period'}
            </button>
          </div>
        )}
      </div>

      <div className="md:col-span-6 flex flex-col space-y-3">
        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-indigo-600" />
          Usage log
        </span>
        <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-200 p-3 overflow-y-auto max-h-[380px] space-y-2">
          {logs.length === 0 ? (
            <p className="text-center py-10 text-xs text-slate-500">No turns yet this period. Start one when you're ready.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="p-3 rounded-xl bg-white border border-slate-200/80 flex items-start justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{log.notes || 'Turn used'}</p>
                  <p className="text-[11px] text-slate-500 truncate">{log.listingTitle}</p>
                </div>
                <span className="text-[10px] text-slate-400 whitespace-nowrap">{relativeTime(log.startedAt)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** "My activity": rentals, shared appliances and a readable history for the signed-in member. */
export const FractionalUsageLogger: React.FC<FractionalUsageLoggerProps> = ({
  activity,
  onClose,
  onLogUsage,
  onConfirmPickup,
  onPay,
  onCheckReturn,
  onReview,
  onBrowse,
}) => {
  const [tab, setTab] = useState<Tab>(activity.bookings.length > 0 || activity.subscriptions.length === 0 ? 'rentals' : 'coops');
  const needsAttention = activity.bookings.some(
    (b) =>
      (b.status === 'PENDING_PAYMENT' && b.viewerRole === 'renter') ||
      b.status === 'PENDING_HANDOVER' ||
      (b.status === 'ACTIVE' && b.viewerRole === 'host') ||
      (b.status === 'COMPLETED' && b.viewerRole === 'renter' && !b.hasReview)
  );

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number; dot?: boolean }[] = [
    { id: 'rentals', label: 'Rentals', icon: <CalendarDays className="w-3.5 h-3.5" />, count: activity.bookings.length, dot: needsAttention },
    { id: 'coops', label: 'Shared appliances', icon: <Repeat className="w-3.5 h-3.5" />, count: activity.subscriptions.length },
    { id: 'history', label: 'Activity history', icon: <History className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-title"
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Clock className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div>
              <h2 id="activity-title" className="text-base font-bold text-slate-900 tracking-tight">
                My activity
              </h2>
              <p className="text-xs text-slate-500">Manage your shared access and usage history.</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-50 border-b border-slate-200 overflow-x-auto" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap',
                tab === t.id ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              )}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.count ? <span className="opacity-70">({t.count})</span> : null}
              {t.dot && <span className="w-2 h-2 rounded-full bg-amber-400" aria-label="Needs your attention" />}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto p-6 space-y-4">
          {tab === 'rentals' &&
            (activity.bookings.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="w-6 h-6 text-slate-400" />}
                title="No rentals yet"
                body="Borrow a drill for the weekend, a roof box for a road trip, or a studio for an afternoon."
                onBrowse={onBrowse}
              />
            ) : (
              activity.bookings.map((b) => (
                <RentalCard key={b.id} booking={b} onConfirmPickup={onConfirmPickup} onPay={onPay} onCheckReturn={onCheckReturn} onReview={onReview} />
              ))
            ))}

          {tab === 'coops' &&
            (activity.subscriptions.length === 0 ? (
              <EmptyState
                icon={<Repeat className="w-6 h-6 text-slate-400" />}
                title="You're not sharing any appliances yet"
                body="Join a small group sharing a washing machine, 3D printer or solar battery nearby, and use it whenever you need."
                onBrowse={onBrowse}
              />
            ) : (
              <CoopPanel subscriptions={activity.subscriptions} usageLogs={activity.usageLogs} onLogUsage={onLogUsage} />
            ))}

          {tab === 'history' &&
            (activity.history.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="w-6 h-6 text-slate-400" />}
                title="Nothing here yet"
                body="Your bookings, turns and reviews will appear here as you use ShareHub."
                onBrowse={onBrowse}
              />
            ) : (
              <ol className="space-y-2">
                {activity.history.map((item) => (
                  <li key={item.id} className="p-3.5 rounded-2xl bg-white border border-slate-200 flex items-start gap-3">
                    <span className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                      {HISTORY_ICON[item.kind]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      {item.detail && <p className="text-xs text-slate-500">{item.detail}</p>}
                    </div>
                    <time dateTime={item.createdAt} className="text-[11px] text-slate-400 whitespace-nowrap">
                      {relativeTime(item.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            ))}
        </div>
      </div>
    </div>
  );
};
