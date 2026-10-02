import React, { useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  CreditCard,
  Star,
  Loader2,
} from 'lucide-react';
import { BookingModel } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';

export interface RentalCardProps {
  booking: BookingModel;
  onConfirmPickup: (bookingId: string, code: string) => Promise<void>;
  onPay: (b: BookingModel) => void;
  onCheckReturn: (b: BookingModel) => void;
  onReview: (b: BookingModel) => void;
}

const dateFmt: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
const fmtDate = (iso: string) => new Date(iso).toLocaleString([], dateFmt);

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

export const RentalCard: React.FC<RentalCardProps> = ({
  booking,
  onConfirmPickup,
  onPay,
  onCheckReturn,
  onReview,
}) => {
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
    <article className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-white shadow-2xs hover:shadow-md transition-all duration-200 space-y-3.5">
      <div className="flex items-start gap-3.5">
        {booking.listingImage ? (
          <img
            src={booking.listingImage}
            alt=""
            referrerPolicy="no-referrer"
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-slate-200 shrink-0"
          />
        ) : (
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 font-bold text-xs">
            Item
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-snug">{booking.listingTitle}</h3>
            <span className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap', chip.className)}>
              {chip.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isHost ? `Booked by ${booking.renterName}` : `Hosted by ${booking.hostName}`}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
              {fmtDate(booking.startDate)} → {fmtDate(booking.endDate)}
            </span>
            <span className="font-semibold text-slate-800">
              {formatCurrency(booking.totalAmountInCents)}
              {booking.depositAmountInCents > 0 && (
                <span className="font-normal text-slate-500"> + {formatCurrency(booking.depositAmountInCents)} deposit</span>
              )}
            </span>
          </div>
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
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
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
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-950 space-y-1.5">
            <p className="font-medium">
              {renterFirst} is collecting on {fmtDate(booking.startDate)}. Give them this code when you hand it over:
            </p>
            <div className="p-2 bg-white rounded-lg border border-amber-300 inline-block font-mono text-base font-bold tracking-wider text-amber-900 shadow-2xs">
              {booking.verificationCode}
            </div>
          </div>
        ) : (
          <form onSubmit={confirmPickup} className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 space-y-2.5">
            <p className="text-xs text-amber-950 font-medium">
              <KeyRound className="w-3.5 h-3.5 inline mr-1 -mt-0.5 text-amber-700" />
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
                className="flex-1 min-w-0 px-3.5 py-2 text-sm bg-white rounded-xl border border-slate-200 focus:border-slate-400 outline-none font-mono uppercase font-semibold"
              />
              <button
                type="submit"
                disabled={isWorking || code.trim().length < 3}
                className="py-2 px-4 rounded-xl font-bold text-xs text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
              >
                {isWorking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                Confirm pickup
              </button>
            </div>
          </form>
        )
      ) : booking.status === 'ACTIVE' ? (
        isHost ? (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200">
            <p className="text-xs text-indigo-950">Due back {fmtDate(booking.endDate)}. Check it over when {renterFirst} returns it.</p>
            <button
              type="button"
              onClick={() => onCheckReturn(booking)}
              className="px-3.5 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Check it back in
            </button>
          </div>
        ) : (
          <p className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950">
            Enjoy! Please return it to {hostFirst} by {fmtDate(booking.endDate)}. Your deposit comes back once it's checked in.
          </p>
        )
      ) : booking.status === 'COMPLETED' ? (
        isHost ? (
          <p className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Returned and checked in. Your payment has been released.
          </p>
        ) : booking.hasReview ? (
          <p className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Returned. Thanks for leaving a review!
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200">
            <p className="text-xs text-amber-950 font-medium">All done, and your deposit is on its way back. How was it?</p>
            <button
              type="button"
              onClick={() => onReview(booking)}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Star className="w-3.5 h-3.5 fill-stone-950" /> Review {hostFirst}
            </button>
          </div>
        )
      ) : null}
    </article>
  );
};
