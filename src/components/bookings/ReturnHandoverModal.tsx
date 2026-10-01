import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, AlertTriangle, Camera, X, AlertCircle, Loader2 } from 'lucide-react';
import { BookingModel, ItemConditionStatus } from '../../types';
import { api } from '../../api/client';
import { prepareImage } from '../../lib/images';
import { formatCurrency, cn } from '../../lib/utils';

interface ReturnHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingModel;
  onReturnCompleted?: (outcome: 'returned' | 'dispute') => void;
}

const PLATFORM_FEE = 0.1;
const MAX_PHOTOS = 6;

const CONDITIONS: { id: ItemConditionStatus; title: string; body: string; tone: string }[] = [
  { id: 'GOOD', title: 'All good', body: 'Clean and working as expected.', tone: 'border-emerald-600 bg-emerald-50/60 ring-emerald-500/20' },
  { id: 'MINOR_WEAR', title: 'Normal wear', body: 'A few light marks from normal use.', tone: 'border-blue-600 bg-blue-50/60 ring-blue-500/20' },
  { id: 'DAMAGED', title: 'Something is wrong', body: 'Damaged or missing parts. We will step in.', tone: 'border-red-600 bg-red-50/60 ring-red-500/20' },
];

/** The host checks a returned item over, then releases the payment or reports a problem. */
export function ReturnHandoverModal({ isOpen, onClose, booking, onReturnCompleted }: ReturnHandoverModalProps) {
  const [condition, setCondition] = useState<ItemConditionStatus>('GOOD');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<'returned' | 'dispute' | null>(null);

  if (!isOpen) return null;

  const renterFirst = booking.renterName.split(' ')[0];
  const hostPayout = Math.round(booking.totalAmountInCents * (1 - PLATFORM_FEE));
  const isProblem = condition === 'DAMAGED';

  // Photos are downscaled before saving so they fit in browser storage.
  const addPhoto = async (file: File | undefined) => {
    if (!file || photos.length >= MAX_PHOTOS) return;
    const result = await prepareImage(file);
    if (result.success === true) setPhotos((prev) => [...prev, result.dataUrl]);
    else setError(result.error);
  };

  const handleSubmit = async () => {
    setError(null);
    if (isProblem && notes.trim().length < 5) {
      setError("Please describe what's wrong so we can help sort it out.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (isProblem) {
        await api.reportProblem(booking.id, notes.trim(), photos);
        setOutcome('dispute');
        onReturnCompleted?.('dispute');
      } else {
        await api.confirmReturn(booking.id, condition as 'GOOD' | 'MINOR_WEAR', notes.trim(), photos);
        setOutcome('returned');
        onReturnCompleted?.('returned');
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="return-title"
        className="relative w-full max-w-2xl max-h-[calc(100dvh-2rem)] flex flex-col bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div>
            <h2 id="return-title" className="text-lg font-bold text-zinc-900 leading-tight">
              Check it back in
            </h2>
            <p className="text-xs text-zinc-500">
              {booking.listingTitle} · returned by {booking.renterName}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {outcome ? (
            <div className="py-4 space-y-5">
              <div
                className={cn(
                  'p-6 rounded-2xl border flex items-start gap-4',
                  outcome === 'returned' ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-amber-50 border-amber-200 text-amber-950'
                )}
              >
                {outcome === 'returned' ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                ) : (
                  <ShieldAlert className="w-8 h-8 text-amber-600 shrink-0" />
                )}
                <div className="space-y-1">
                  <h3 className="text-base font-bold">{outcome === 'returned' ? 'All checked in' : "Thanks, we're on it"}</h3>
                  <p className="text-sm text-zinc-600">
                    {outcome === 'returned'
                      ? `${formatCurrency(hostPayout)} is on its way to you, and ${renterFirst}'s deposit has been returned.`
                      : `We've paused the payout and ${renterFirst}'s deposit while we look into it. We'll be in touch with you both.`}
                  </p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded-xl transition-all">
                Done
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <fieldset className="space-y-3">
                <legend className="block text-sm font-bold text-zinc-900 mb-3">How did it come back?</legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {CONDITIONS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={condition === c.id}
                      onClick={() => setCondition(c.id)}
                      className={cn(
                        'p-3.5 rounded-xl border text-left transition-all space-y-1',
                        condition === c.id ? `${c.tone} ring-2` : 'border-zinc-200 hover:border-zinc-300 bg-white'
                      )}
                    >
                      <span className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-zinc-900">{c.title}</span>
                        {condition === c.id &&
                          (c.id === 'DAMAGED' ? <AlertTriangle className="w-4 h-4 text-red-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />)}
                      </span>
                      <span className="text-xs text-zinc-500 leading-snug block">{c.body}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="space-y-3">
                <span className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-zinc-600" />
                  Photos <span className="font-normal text-zinc-400">({isProblem ? 'strongly recommended' : 'optional'})</span>
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {photos.map((src, idx) => (
                    <div key={idx} className="relative w-24 h-20 rounded-xl overflow-hidden border border-zinc-200">
                      <img src={src} alt={`Return photo ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        aria-label="Remove photo"
                        onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black text-white rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <label className="w-24 h-20 rounded-xl border-2 border-dashed border-zinc-300 hover:border-zinc-400 flex flex-col items-center justify-center cursor-pointer text-zinc-500 hover:text-zinc-700 bg-zinc-50/50">
                      <Camera className="w-4 h-4 mb-1" />
                      <span className="text-[10px] font-medium">Add photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          addPhoto(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              <label className="block space-y-2">
                <span className="block text-sm font-bold text-zinc-900">
                  {isProblem ? "What's wrong?" : 'Notes'}{' '}
                  {!isProblem && <span className="font-normal text-zinc-400">(optional)</span>}
                </span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isProblem ? 'e.g. The charger is missing and the case is cracked.' : 'e.g. All parts back, batteries charged.'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 placeholder:text-zinc-400"
                />
              </label>

              <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-1.5 text-xs text-zinc-600">
                <div className="flex justify-between">
                  <span>Rental</span>
                  <span className="text-zinc-900">{formatCurrency(booking.totalAmountInCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span>ShareHub fee (10%)</span>
                  <span>−{formatCurrency(booking.totalAmountInCents - hostPayout)}</span>
                </div>
                <div className="flex justify-between font-bold text-zinc-900 pt-1 border-t border-zinc-200">
                  <span>{isProblem ? 'Your payout (paused while we review)' : 'Your payout'}</span>
                  <span className={isProblem ? 'text-amber-700' : 'text-emerald-700'}>{formatCurrency(hostPayout)}</span>
                </div>
                {booking.depositAmountInCents > 0 && (
                  <p className="text-[11px] text-zinc-500 pt-1">
                    {isProblem
                      ? `${renterFirst}'s ${formatCurrency(booking.depositAmountInCents)} deposit is held until this is resolved.`
                      : `${renterFirst}'s ${formatCurrency(booking.depositAmountInCents)} deposit goes back to them.`}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className={cn(
                    'px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 rounded-xl transition-all shadow-sm flex items-center gap-2',
                    isProblem ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  )}
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : isProblem ? <ShieldAlert className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  {isProblem ? 'Report a problem' : 'Confirm return'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
