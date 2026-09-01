import React, { useState } from 'react';
import {
  X,
  Star,
  ShieldCheck,
  Award,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ThumbsUp,
} from 'lucide-react';
import { createReview } from '../../../actions/reviews';
import type { BookingModel, ReviewModel } from '../../types';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingModel;
  targetUser?: {
    id: string;
    name: string;
    image?: string;
    role?: string;
    trustScore?: number;
  };
  onReviewSubmitted?: (review: ReviewModel, newTrustScore: number) => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  booking,
  targetUser = {
    id: 'usr_host_marcus',
    name: 'Marcus Thorne',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    trustScore: 99,
  },
  onReviewSubmitted,
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [cleanlinessRating, setCleanlinessRating] = useState<number>(5);
  const [communicationRating, setCommunicationRating] = useState<number>(5);
  const [accuracyRating, setAccuracyRating] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    review: ReviewModel;
    newTrustScore: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (comment.trim().length < 5) {
      setError('Please provide at least 5 characters of feedback for the host.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createReview({
        bookingId: booking.id,
        targetId: targetUser.id,
        listingId: booking.listingId,
        rating,
        comment: comment.trim(),
        cleanlinessRating,
        communicationRating,
        accuracyRating,
      });

      if (result.success) {
        setSuccessResult({
          review: result.review,
          newTrustScore: result.newTrustScore,
        });
        if (onReviewSubmitted) {
          onReviewSubmitted(result.review, result.newTrustScore);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStarSelector = (
    value: number,
    onChange: (val: number) => void,
    interactiveHover: boolean = false
  ) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = interactiveHover
            ? star <= (hoverRating !== null ? hoverRating : value)
            : star <= value;
          return (
            <button
              type="button"
              key={star}
              id={`star-btn-${star}`}
              onClick={() => onChange(star)}
              onMouseEnter={() => interactiveHover && setHoverRating(star)}
              onMouseLeave={() => interactiveHover && setHoverRating(null)}
              className="p-1 text-stone-300 hover:text-amber-400 focus:outline-none transition-colors"
            >
              <Star
                className={`w-6 h-6 transition-transform ${
                  isFilled ? 'fill-amber-400 text-amber-400 scale-105' : 'text-stone-300'
                }`}
              />
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div
      id="review-modal-backdrop"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        id="review-modal-content"
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]"
      >
        {/* Header */}
        <div className="p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-200 shadow-2xs">
              <Award className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900">Two-Way Trust Review</h2>
              <p className="text-xs text-stone-500">Rate your experience with {targetUser.name}</p>
            </div>
          </div>
          <button
            id="close-review-modal-btn"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-stone-200 text-stone-500 hover:text-stone-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successResult ? (
          /* Success Confirmation State */
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200 shadow-xs">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900">Review Submitted!</h3>
              <p className="text-sm text-stone-600 max-w-sm mx-auto mt-1">
                Thank you for strengthening community trust. Your review and ratings have been
                recorded to the immutable ledger.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-around text-center">
              <div>
                <span className="text-xs text-stone-500 font-medium">Your Rating</span>
                <div className="flex items-center justify-center gap-1 mt-0.5 text-amber-500 font-bold">
                  <Star className="w-4 h-4 fill-amber-400" />
                  <span>{successResult.review.rating}.0 / 5.0</span>
                </div>
              </div>
              <div className="h-8 w-px bg-stone-200" />
              <div>
                <span className="text-xs text-stone-500 font-medium">Host Trust Score</span>
                <div className="flex items-center justify-center gap-1 mt-0.5 text-emerald-700 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>{successResult.newTrustScore}% Verified</span>
                </div>
              </div>
            </div>

            <button
              id="finish-review-btn"
              onClick={onClose}
              className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-xs transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          /* Form Content */
          <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Target Listing Context */}
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {targetUser.image ? (
                  <img
                    src={targetUser.image}
                    alt={targetUser.name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover border border-stone-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center">
                    {targetUser.name.charAt(0)}
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-semibold text-stone-900">{targetUser.name}</h4>
                  <p className="text-xs text-stone-500 truncate max-w-[200px]">
                    Item: {booking.listingTitle}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {targetUser.trustScore || 98}% Trust Score
                </span>
              </div>
            </div>

            {/* Overall Star Rating */}
            <div className="text-center py-2">
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                Overall Experience Rating
              </label>
              <div className="flex justify-center">
                {renderStarSelector(rating, setRating, true)}
              </div>
              <span className="text-xs font-semibold text-amber-700 mt-1 block">
                {rating === 5 && 'Outstanding — Exceeded expectations!'}
                {rating === 4 && 'Great — Smooth and reliable exchange.'}
                {rating === 3 && 'Good — Minor points for improvement.'}
                {rating === 2 && 'Fair — Had some noticeable issues.'}
                {rating === 1 && 'Poor — Handover or asset issues.'}
              </span>
            </div>

            {/* Granular Sub-Category Ratings */}
            <div className="space-y-2.5 p-3.5 rounded-xl bg-stone-50/80 border border-stone-200 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-stone-700">Cleanliness & Condition:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCleanlinessRating(s)}
                      className={`w-6 h-6 rounded-md text-xs font-bold transition-all ${
                        cleanlinessRating >= s
                          ? 'bg-amber-400 text-stone-900 shadow-2xs'
                          : 'bg-stone-200 text-stone-500'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-medium text-stone-700">Communication & Timeliness:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCommunicationRating(s)}
                      className={`w-6 h-6 rounded-md text-xs font-bold transition-all ${
                        communicationRating >= s
                          ? 'bg-amber-400 text-stone-900 shadow-2xs'
                          : 'bg-stone-200 text-stone-500'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-medium text-stone-700">Accuracy of Description:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setAccuracyRating(s)}
                      className={`w-6 h-6 rounded-md text-xs font-bold transition-all ${
                        accuracyRating >= s
                          ? 'bg-amber-400 text-stone-900 shadow-2xs'
                          : 'bg-stone-200 text-stone-500'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Written Review */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label
                  htmlFor="review-comment"
                  className="text-xs font-bold text-stone-700 uppercase tracking-wider"
                >
                  Written Feedback
                </label>
                <span className="text-[11px] text-stone-400">{comment.length}/500</span>
              </div>
              <textarea
                id="review-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Share how the equipment functioned, the handover ease, and any advice for future neighbors..."
                className="w-full rounded-xl border border-stone-300 p-3 text-sm text-stone-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none transition-all placeholder:text-stone-400"
              />
            </div>

            {/* Submit Action */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                id="cancel-review-btn"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="submit-review-btn"
                disabled={isSubmitting || comment.trim().length < 5}
                className={`px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 shadow-xs transition-all ${
                  !isSubmitting && comment.trim().length >= 5
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer'
                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>{isSubmitting ? 'Submitting...' : 'Post Public Review'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
