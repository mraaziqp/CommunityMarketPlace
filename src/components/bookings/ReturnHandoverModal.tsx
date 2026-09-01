import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Upload,
  X,
  ArrowRight,
  Lock,
  Unlock,
  FileCheck,
  Clock,
  Sparkles,
  HelpCircle,
  ChevronRight,
  Info,
  DollarSign,
} from 'lucide-react';
import { BookingModel, ConditionLogModel, ItemConditionStatus } from '../../types';
import { confirmReturn, initiateDispute, logCondition } from '../../../actions/returns';
import { cn } from '../../lib/utils';

interface ReturnHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingModel | null;
  onReturnCompleted?: (updatedBooking: any) => void;
  currentUserId?: string;
}

export function ReturnHandoverModal({
  isOpen,
  onClose,
  booking,
  onReturnCompleted,
  currentUserId = 'usr_me',
}: ReturnHandoverModalProps) {
  const [selectedCondition, setSelectedCondition] = useState<ItemConditionStatus>('GOOD');
  const [notes, setNotes] = useState<string>('');
  const [images, setImages] = useState<string[]>([
    'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&auto=format&fit=crop&q=80',
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultState, setResultState] = useState<{
    status: 'SUCCESS_RELEASED' | 'DISPUTE_FROZEN' | null;
    message: string;
    details?: any;
  }>({ status: null, message: '' });

  if (!isOpen || !booking) return null;

  const totalRentalZAR = (booking.totalAmountInCents || 15000) / 100;
  const depositZAR = (booking.depositAmountInCents || 50000) / 100;
  const hostPayoutZAR = Math.round(totalRentalZAR * 0.9);
  const platformFeeZAR = totalRentalZAR - hostPayoutZAR;

  const handleAddSamplePhoto = (url: string) => {
    if (!images.includes(url)) {
      setImages((prev) => [...prev, url]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (selectedCondition === 'DAMAGED') {
        const res = await initiateDispute(
          booking.id,
          'DAMAGED',
          notes || 'Item returned with physical damage or missing components. Escrow security deposit frozen for review.',
          images,
          currentUserId
        );
        setResultState({
          status: 'DISPUTE_FROZEN',
          message: 'Escrow Frozen & Dispute Filed with Community Trust Committee',
          details: res,
        });
        if (onReturnCompleted) {
          onReturnCompleted({
            ...booking,
            status: 'ACTIVE',
            disputeStatus: 'PENDING_REVIEW',
          });
        }
      } else {
        const res = await confirmReturn(
          booking.id,
          selectedCondition,
          notes || 'Return inspection completed. Item received in verified working order.',
          images,
          currentUserId
        );
        setResultState({
          status: 'SUCCESS_RELEASED',
          message: 'Return Handover Signed Off & Escrow Successfully Released',
          details: res,
        });
        if (onReturnCompleted) {
          onReturnCompleted({
            ...booking,
            status: 'COMPLETED',
            disputeStatus: 'NONE',
          });
        }
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred during return handover processing');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="return-handover-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div
        id="return-handover-modal-content"
        className="relative w-full max-w-2xl max-h-[calc(100dvh-2rem)] flex flex-col bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 leading-tight">
                Return Handover & Escrow Sign-Off
              </h2>
              <p className="text-xs text-zinc-500">
                Booking ID: <span className="font-mono">{booking.id}</span> • {booking.listingTitle}
              </p>
            </div>
          </div>
          <button
            id="close-return-modal-btn"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {resultState.status ? (
            /* Result State View */
            <div className="py-4 space-y-5">
              <div
                className={cn(
                  'p-6 rounded-2xl border flex items-start gap-4',
                  resultState.status === 'SUCCESS_RELEASED'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50 border-amber-200 text-amber-950'
                )}
              >
                {resultState.status === 'SUCCESS_RELEASED' ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="w-8 h-8 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <h3 className="text-base font-bold">{resultState.message}</h3>
                  <p className="text-xs text-zinc-600">
                    {resultState.status === 'SUCCESS_RELEASED'
                      ? 'The security deposit of R' +
                        depositZAR +
                        ' has been automatically authorized for instant release to the renter. Host payout of R' +
                        hostPayoutZAR +
                        ' (net of 10% platform fee) has been captured.'
                      : 'The security deposit of R' +
                        depositZAR +
                        ' has been FROZEN in escrow. Payouts are suspended pending dispute committee review of the condition photos and damage report.'}
                  </p>
                </div>
              </div>

              {/* Audit Proof Box */}
              <div className="p-4 rounded-xl bg-zinc-900 text-zinc-100 font-mono text-xs space-y-2">
                <div className="flex items-center justify-between text-zinc-400 pb-2 border-b border-zinc-800">
                  <span className="font-sans font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    Immutable Audit Ledger Record
                  </span>
                  <span>{new Date().toISOString()}</span>
                </div>
                <div className="space-y-1 text-zinc-300">
                  <p>• Event: {resultState.status === 'SUCCESS_RELEASED' ? 'HANDOVER_COMPLETED' : 'DISPUTE_RAISED'}</p>
                  <p>• Escrow Status: {resultState.status === 'SUCCESS_RELEASED' ? 'CAPTURED & RELEASED' : 'FROZEN_ESCROW'}</p>
                  <p>• Target Booking: {booking.id}</p>
                  <p>• Inspection Condition: {selectedCondition}</p>
                  <p>• Evidence Photos: {images.length} attached</p>
                </div>
              </div>

              <button
                id="done-return-modal-btn"
                onClick={onClose}
                className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded-xl transition-all"
              >
                Close & Return to Dashboard
              </button>
            </div>
          ) : (
            /* Active Form View */
            <div className="space-y-6">
              {/* Pickup Baseline Info Card */}
              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-zinc-200 shadow-sm">
                    <Clock className="w-4 h-4 text-zinc-600" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Initial Pickup Baseline
                    </span>
                    <p className="text-sm font-medium text-zinc-900">
                      Handover PIN Verified • Condition: <span className="text-emerald-700 font-bold">Good</span>
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Escrow Held (R{totalRentalZAR + depositZAR})
                </span>
              </div>

              {/* Step 1: Select Return Condition */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-zinc-900">
                  1. Select Return Inspection Condition
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* GOOD */}
                  <button
                    id="condition-good-btn"
                    type="button"
                    onClick={() => setSelectedCondition('GOOD')}
                    className={cn(
                      'p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2',
                      selectedCondition === 'GOOD'
                        ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20 text-emerald-950'
                        : 'border-zinc-200 hover:border-zinc-300 bg-white'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        GOOD
                      </span>
                      {selectedCondition === 'GOOD' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-900">Pristine / Normal</h4>
                      <p className="text-xs text-zinc-500 mt-0.5 leading-snug">
                        Clean, fully functional. Releases full host payout & refunds deposit.
                      </p>
                    </div>
                  </button>

                  {/* MINOR_WEAR */}
                  <button
                    id="condition-minor-btn"
                    type="button"
                    onClick={() => setSelectedCondition('MINOR_WEAR')}
                    className={cn(
                      'p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2',
                      selectedCondition === 'MINOR_WEAR'
                        ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 text-blue-950'
                        : 'border-zinc-200 hover:border-zinc-300 bg-white'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        MINOR WEAR
                      </span>
                      {selectedCondition === 'MINOR_WEAR' && (
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-900">Expected Wear</h4>
                      <p className="text-xs text-zinc-500 mt-0.5 leading-snug">
                        Light superficial scuffs. Releases payout and signs off booking.
                      </p>
                    </div>
                  </button>

                  {/* DAMAGED */}
                  <button
                    id="condition-damaged-btn"
                    type="button"
                    onClick={() => setSelectedCondition('DAMAGED')}
                    className={cn(
                      'p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2',
                      selectedCondition === 'DAMAGED'
                        ? 'border-red-600 bg-red-50/60 ring-2 ring-red-500/20 text-red-950'
                        : 'border-zinc-200 hover:border-zinc-300 bg-white'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                        DAMAGED / MISSING
                      </span>
                      {selectedCondition === 'DAMAGED' && (
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-900">Flag Issue</h4>
                      <p className="text-xs text-zinc-500 mt-0.5 leading-snug">
                        Defects detected. Freezes escrow and begins arbitration.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Step 2: Photo Evidence */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-zinc-600" />
                    2. Inspection Photos & Proof ({images.length} attached)
                  </label>
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        handleAddSamplePhoto(
                          'https://images.unsplash.com/photo-1581147036324-c17ac41dfa6c?w=600&auto=format&fit=crop&q=80'
                        )
                      }
                      className="px-2 py-1 text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors"
                    >
                      + Add Battery/Plug Photo
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleAddSamplePhoto(
                          'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=600&auto=format&fit=crop&q=80'
                        )
                      }
                      className="px-2 py-1 text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors"
                    >
                      + Add Serial/Case Photo
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {images.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      className="relative w-24 h-20 rounded-xl overflow-hidden border border-zinc-200 shadow-sm group"
                    >
                      <img
                        src={imgUrl}
                        alt={`Inspection ${idx + 1}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black text-white rounded-full transition-colors opacity-80 hover:opacity-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  <label className="w-24 h-20 rounded-xl border-2 border-dashed border-zinc-300 hover:border-zinc-400 flex flex-col items-center justify-center cursor-pointer text-zinc-500 hover:text-zinc-700 transition-colors bg-zinc-50/50">
                    <Upload className="w-4 h-4 mb-1" />
                    <span className="text-[10px] font-medium">Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          // Simulate immediate data URL preview
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            if (event.target?.result) {
                              setImages((prev) => [...prev, event.target!.result as string]);
                            }
                          };
                          reader.readAsDataURL(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Step 3: Inspection Notes */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-zinc-900">
                  3. Handover Notes & Sign-Off Comments
                </label>
                <textarea
                  id="return-notes-input"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    selectedCondition === 'DAMAGED'
                      ? 'Please describe the exact damage, missing bit, or defect detected...'
                      : 'E.g. Cleaned, bit set complete, batteries returned at 90% charge.'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all placeholder:text-zinc-400"
                />
              </div>

              {/* Step 4: Financial Escrow Impact Breakdown */}
              <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-zinc-500 pb-2 border-b border-zinc-200">
                  <span className="font-semibold uppercase tracking-wider text-zinc-700">
                    Escrow Financial Settlement
                  </span>
                  <span className="font-mono">Hold Ref: {booking.payment?.paymentGatewayRef || 'PSTK-AUTH-8842'}</span>
                </div>

                <div className="space-y-1.5 text-xs text-zinc-600">
                  <div className="flex justify-between">
                    <span>Rental Fee Captured</span>
                    <span className="font-medium text-zinc-900">R{totalRentalZAR.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Host Earnings (90% payout)</span>
                    <span className="font-medium text-emerald-700 font-semibold">R{hostPayoutZAR.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Platform Insurance & Guarantee Fee (10%)</span>
                    <span>R{platformFeeZAR.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-zinc-200">
                    <span className="font-bold text-zinc-900">Security Deposit Settlement (R{depositZAR})</span>
                    <span
                      className={cn(
                        'font-bold',
                        selectedCondition === 'DAMAGED' ? 'text-red-700' : 'text-emerald-700'
                      )}
                    >
                      {selectedCondition === 'DAMAGED' ? 'FROZEN IN ESCROW' : 'REFUNDED TO RENTER'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>

                {selectedCondition === 'DAMAGED' ? (
                  <button
                    id="confirm-dispute-btn"
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl transition-all shadow-sm flex items-center gap-2"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    {isSubmitting ? 'Freezing Escrow...' : 'Flag Damage & Freeze Escrow'}
                  </button>
                ) : (
                  <button
                    id="confirm-return-btn"
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-all shadow-sm flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isSubmitting ? 'Releasing Escrow...' : 'Sign Off Return & Release Escrow'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
