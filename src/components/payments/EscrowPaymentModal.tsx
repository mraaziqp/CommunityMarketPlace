import React, { useState } from 'react';
import { X, Lock, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import type { BookingModel } from '../../types';
import { api, submitCheckout } from '../../api/client';
import { formatCurrency } from '../../lib/utils';

interface EscrowPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingModel;
}

/**
 * Pay for a held booking. The member is sent to PayFast to pay; ShareHub
 * never sees card details. The booking is confirmed when PayFast notifies
 * the server, not when the browser comes back.
 */
export const EscrowPaymentModal: React.FC<EscrowPaymentModalProps> = ({ isOpen, onClose, booking }) => {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const rental = booking.totalAmountInCents;
  const deposit = booking.depositAmountInCents;
  const total = rental + deposit;

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRedirecting(true);
    setError(null);
    try {
      submitCheckout(await api.bookingCheckout(booking.id));
    } catch (err: any) {
      setError(err?.message || 'We could not start the payment. Please try again.');
      setIsRedirecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-title"
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]"
      >
        <div className="p-5 border-b border-stone-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-200">
              <Lock className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h2 id="payment-title" className="text-lg font-bold text-stone-900">
                Pay for your booking
              </h2>
              <p className="text-xs text-stone-500 truncate max-w-[260px]">{booking.listingTitle}</p>
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500 hover:text-stone-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handlePay} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2 text-sm">
            <p className="text-xs text-stone-600">
              {new Date(booking.startDate).toLocaleDateString()} – {new Date(booking.endDate).toLocaleDateString()}
            </p>
            <div className="flex justify-between text-stone-600">
              <span>Rental</span>
              <span className="font-semibold text-stone-900">{formatCurrency(rental)}</span>
            </div>
            {deposit > 0 && (
              <div className="flex justify-between text-stone-600">
                <span>Refundable deposit</span>
                <span className="font-semibold text-stone-900">{formatCurrency(deposit)}</span>
              </div>
            )}
            <div className="h-px bg-stone-200 my-1" />
            <div className="flex justify-between text-stone-900 font-bold">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              You'll pay securely on PayFast (card, Instant EFT and more). We hold the money until you return the item; then the
              host is paid and your deposit comes back.
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 text-sm font-semibold transition-colors">
              Not now
            </button>
            <button
              type="submit"
              disabled={isRedirecting}
              className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              {isRedirecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>{isRedirecting ? 'Taking you to PayFast…' : `Pay ${formatCurrency(total)} with PayFast`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
