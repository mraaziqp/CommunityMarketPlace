import React, { useState } from 'react';
import {
  X,
  Lock,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Building,
  Smartphone,
  ArrowRight,
} from 'lucide-react';
import { createPaymentIntent } from '../../../actions/payments';
import type { BookingModel, PaymentModel } from '../../types';

interface EscrowPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingModel;
  onPaymentAuthorized?: (payment: PaymentModel) => void;
}

export const EscrowPaymentModal: React.FC<EscrowPaymentModalProps> = ({
  isOpen,
  onClose,
  booking,
  onPaymentAuthorized,
}) => {
  const [gateway, setGateway] = useState<'paystack' | 'stripe'>('paystack');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'eft' | 'snapscan'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successPayment, setSuccessPayment] = useState<PaymentModel | null>(null);

  if (!isOpen) return null;

  const rentalAmount = booking.totalAmountInCents;
  const depositAmount = booking.depositAmountInCents;
  const totalEscrowHold = rentalAmount + depositAmount;

  const handleAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setError(null);

    try {
      const result = await createPaymentIntent(
        booking.id,
        totalEscrowHold,
        gateway,
        booking.renterId
      );

      if (result.success) {
        const paymentModel: PaymentModel = {
          id: result.payment.id,
          bookingId: result.payment.bookingId,
          amount: result.payment.amount,
          currency: result.payment.currency,
          status: 'HELD_IN_ESCROW',
          paymentGatewayRef: result.payment.paymentGatewayRef,
          createdAt: result.payment.createdAt,
        };

        setSuccessPayment(paymentModel);
        if (onPaymentAuthorized) {
          onPaymentAuthorized(paymentModel);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Payment authorization failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="escrow-payment-modal-backdrop"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        id="escrow-payment-modal-content"
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]"
      >
        {/* Header */}
        <div className="p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-200 shadow-2xs">
              <Lock className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900">Secure Escrow Authorization</h2>
              <p className="text-xs text-stone-500">Funds locked until mutual physical handover</p>
            </div>
          </div>
          <button
            id="close-escrow-modal-btn"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-stone-200 text-stone-500 hover:text-stone-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successPayment ? (
          /* Escrow Held Success State */
          <div className="p-6 text-center space-y-4 overflow-y-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200 shadow-xs">
              <ShieldCheck className="w-9 h-9" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900">Escrow Hold Authorized!</h3>
              <p className="text-sm text-stone-600 max-w-sm mx-auto mt-1">
                <span className="font-semibold">R{(totalEscrowHold / 100).toFixed(2)}</span> has been
                authorized and held securely in ShareHub Escrow.
              </p>
            </div>

            {/* Escrow Certificate Breakdown */}
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-left space-y-2.5 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>Escrow Hold Ref:</span>
                <span className="font-mono font-semibold text-stone-900">
                  {successPayment.paymentGatewayRef}
                </span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Rental Charge:</span>
                <span className="font-semibold text-stone-900">
                  R{(rentalAmount / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Refundable Deposit:</span>
                <span className="font-semibold text-stone-900">
                  R{(depositAmount / 100).toFixed(2)}
                </span>
              </div>
              <div className="h-px bg-stone-200 my-1" />
              <div className="flex justify-between text-emerald-800 font-bold">
                <span>Escrow Status:</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px]">
                  HELD_IN_ESCROW
                </span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 text-left flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
              <span>
                Funds will automatically release to the host only after you scan or verify the
                Digital Handover PIN upon asset collection.
              </span>
            </div>

            <button
              id="finish-escrow-btn"
              onClick={onClose}
              className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-xs transition-colors"
            >
              Continue to Handover
            </button>
          </div>
        ) : (
          /* Payment Form */
          <form onSubmit={handleAuthorize} className="p-6 space-y-5 overflow-y-auto flex-1">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Escrow Mechanism Explanation Banner */}
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-semibold">How Escrow Protects You:</span> Money is locked on
                your card. If the asset isn't available, funds are refunded immediately. The host is
                guaranteed payout upon verified QR/PIN handover.
              </div>
            </div>

            {/* Amount Breakdown Card */}
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>Rental Duration & Item:</span>
                <span className="font-medium text-stone-900 truncate max-w-[200px]">
                  {booking.listingTitle}
                </span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Rental Amount:</span>
                <span className="font-semibold text-stone-900">
                  R{(rentalAmount / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Security Deposit (Refundable):</span>
                <span className="font-semibold text-stone-900">
                  R{(depositAmount / 100).toFixed(2)}
                </span>
              </div>
              <div className="h-px bg-stone-200 my-1" />
              <div className="flex justify-between text-stone-900 text-sm font-bold">
                <span>Total Escrow Hold:</span>
                <span className="text-emerald-700">R{(totalEscrowHold / 100).toFixed(2)} ZAR</span>
              </div>
            </div>

            {/* Payment Gateway Toggle */}
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                Payment Gateway Provider
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  id="select-paystack-btn"
                  onClick={() => setGateway('paystack')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    gateway === 'paystack'
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-2xs'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-stone-900">Paystack</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-medium">
                      SA Default
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500">Cards, Instant EFT, SnapScan</p>
                </button>

                <button
                  type="button"
                  id="select-stripe-btn"
                  onClick={() => setGateway('stripe')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    gateway === 'stripe'
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-2xs'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-stone-900">Stripe</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded font-medium">
                      Global
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500">Global Visa/Mastercard/Amex</p>
                </button>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    paymentMethod === 'card'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <CreditCard className="w-4 h-4 mx-auto mb-1 text-emerald-700" />
                  <span className="text-xs">Credit Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('eft')}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    paymentMethod === 'eft'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <Building className="w-4 h-4 mx-auto mb-1 text-emerald-700" />
                  <span className="text-xs">Instant EFT</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('snapscan')}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    paymentMethod === 'snapscan'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <Smartphone className="w-4 h-4 mx-auto mb-1 text-emerald-700" />
                  <span className="text-xs">SnapScan</span>
                </button>
              </div>
            </div>

            {/* Card Simulation Inputs */}
            {paymentMethod === 'card' && (
              <div className="space-y-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    Cardholder Name
                  </label>
                  <input
                    type="text"
                    defaultValue="Alex Rivera"
                    className="w-full text-xs p-2 rounded-lg border border-stone-300 bg-white"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      Card Number
                    </label>
                    <input
                      type="text"
                      defaultValue="•••• •••• •••• 4242"
                      className="w-full text-xs p-2 rounded-lg border border-stone-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      CVC / Expiry
                    </label>
                    <input
                      type="text"
                      defaultValue="12/28 (332)"
                      className="w-full text-xs p-2 rounded-lg border border-stone-300 bg-white font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                id="cancel-escrow-btn"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="authorize-escrow-btn"
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>
                  {isProcessing
                    ? 'Authorizing Escrow...'
                    : `Authorize R${(totalEscrowHold / 100).toFixed(2)} Hold`}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
