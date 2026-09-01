import React, { useState } from 'react';
import {
  Star,
  ShieldCheck,
  MapPin,
  Users,
  Repeat,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Zap,
  BedDouble,
  Wrench,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { ListingModel, PricingTierModel } from '../../types';
import { cn, formatCurrency } from '../../lib/utils';

export interface ListingCardProps {
  listing: ListingModel;
  selectedTier?: PricingTierModel;
  onSelect?: (listing: ListingModel) => void;
  onQuickSubscribe?: (listing: ListingModel, tier: PricingTierModel) => void;
  isSubscribed?: boolean;
}

export const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  selectedTier,
  onSelect,
  onQuickSubscribe,
  isSubscribed = false,
}) => {
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  // Determine the primary pricing tier to display
  const primaryTier: PricingTierModel =
    selectedTier ||
    listing.pricingTiers.find((t) => t.isPopular) ||
    listing.pricingTiers[0];

  const hasMultipleImages = listing.images && listing.images.length > 1;

  const handlePrevImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImgIndex((prev) =>
      prev === 0 ? listing.images.length - 1 : prev - 1
    );
  };

  const handleNextImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImgIndex((prev) =>
      prev === listing.images.length - 1 ? 0 : prev + 1
    );
  };

  // Helper to format dynamic rate based on type
  const renderRateBadge = () => {
    if (!primaryTier) return null;

    const priceText = formatCurrency(primaryTier.priceInCents, primaryTier.currency);

    if (primaryTier.type === 'monthly_subscription') {
      const usesText = primaryTier.usageLimitPerPeriod
        ? `${primaryTier.usageLimitPerPeriod} uses`
        : 'unlimited';
      return (
        <div className="flex flex-col items-end">
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-slate-900 tracking-tight">
              {priceText}
            </span>
            <span className="text-xs font-medium text-slate-500">/ mo</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70">
            <Repeat className="w-3 h-3 text-indigo-600" />
            {usesText}
          </span>
        </div>
      );
    }

    if (primaryTier.type === 'nightly') {
      return (
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-slate-900 tracking-tight">
            {priceText}
          </span>
          <span className="text-xs font-medium text-slate-500">/ night</span>
        </div>
      );
    }

    if (primaryTier.type === 'daily') {
      return (
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-slate-900 tracking-tight">
            {priceText}
          </span>
          <span className="text-xs font-medium text-slate-500">/ day</span>
        </div>
      );
    }

    if (primaryTier.type === 'hourly') {
      return (
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-slate-900 tracking-tight">
            {priceText}
          </span>
          <span className="text-xs font-medium text-slate-500">/ hr</span>
        </div>
      );
    }

    // Default or usage pack
    return (
      <div className="flex flex-col items-end">
        <span className="text-lg font-bold text-slate-900">{priceText}</span>
        {primaryTier.usageLimitPerPeriod && (
          <span className="text-[11px] text-slate-500">
            {primaryTier.usageLimitPerPeriod} uses pack
          </span>
        )}
      </div>
    );
  };

  const isFractional = listing.category === 'fractional_appliance';
  const slotsRemaining = listing.maxSubscribers - listing.currentSubscribersCount;
  const isFull = slotsRemaining <= 0;

  return (
    <div
      id={`listing-card-${listing.id}`}
      onClick={() => onSelect?.(listing)}
      className="group relative flex flex-col bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 shadow-2xs hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer"
    >
      {/* Image Carousel & Badges Container */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <img
          src={listing.images[currentImgIndex] || 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=800'}
          alt={listing.title}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-103"
        />

        {/* Carousel Prev/Next Controls */}
        {hasMultipleImages && (
          <div className="absolute inset-0 flex items-center justify-between p-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              id={`prev-img-${listing.id}`}
              type="button"
              onClick={handlePrevImg}
              aria-label="Previous image"
              className="p-1.5 rounded-full bg-white/90 backdrop-blur-xs text-slate-800 hover:bg-white shadow-xs hover:scale-105 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              id={`next-img-${listing.id}`}
              type="button"
              onClick={handleNextImg}
              aria-label="Next image"
              className="p-1.5 rounded-full bg-white/90 backdrop-blur-xs text-slate-800 hover:bg-white shadow-xs hover:scale-105 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Image Indicators */}
        {hasMultipleImages && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-slate-900/60 backdrop-blur-xs px-2 py-0.5 rounded-full">
            {listing.images.map((_, idx) => (
              <span
                key={idx}
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-all',
                  idx === currentImgIndex
                    ? 'bg-white w-2.5'
                    : 'bg-white/50'
                )}
              />
            ))}
          </div>
        )}

        {/* Category Pill */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[75%]">
          {listing.visibilityGroupName && (
            <span
              title={`Private Trust Group: ${listing.visibilityGroupName}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/90 text-emerald-300 text-xs font-semibold shadow-sm border border-emerald-500/40 backdrop-blur-xs"
            >
              <Lock className="w-3 h-3 text-emerald-400" />
              <span className="truncate max-w-[120px]">{listing.visibilityGroupName}</span>
            </span>
          )}
          {listing.category === 'room' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-xs text-xs font-semibold text-sky-900 shadow-2xs border border-slate-200/80">
              <BedDouble className="w-3.5 h-3.5 text-sky-600" />
              Room Stay
            </span>
          )}
          {listing.category === 'physical_item' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-xs text-xs font-semibold text-amber-900 shadow-2xs border border-slate-200/80">
              <Wrench className="w-3.5 h-3.5 text-amber-600" />
              Equipment Rental
            </span>
          )}
          {listing.category === 'fractional_appliance' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 text-white text-xs font-semibold shadow-2xs border border-slate-800">
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              Fractional Co-Op
            </span>
          )}

          {isSubscribed && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-700 text-white text-xs font-semibold shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Subscribed
            </span>
          )}
        </div>

        {/* SuperHost / Verified Owner Pill */}
        {listing.owner.isSuperHost && (
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-xs text-[11px] font-semibold text-slate-700 shadow-2xs border border-slate-200/80">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              Verified Host
            </span>
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-4.5 flex-1 flex flex-col justify-between">
        <div>
          {/* Rating, Proximity & Neighborhood Row */}
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5 gap-1">
            <span className="inline-flex items-center gap-1 font-medium text-slate-600 truncate">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{listing.neighborhood}, {listing.city}</span>
            </span>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Distance Proximity Badge */}
              {listing.formattedDistance && (
                <span
                  title="Approximate distance to protect host home privacy until booking is confirmed"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                >
                  <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                  {listing.formattedDistance}
                </span>
              )}

              <div className="flex items-center gap-1 font-semibold text-slate-800">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{listing.rating.toFixed(2)}</span>
                <span className="text-slate-400 font-normal">({listing.reviewCount})</span>
              </div>
            </div>
          </div>

          {/* Title */}
          <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-1 mb-1 group-hover:text-indigo-600 transition-colors">
            {listing.title}
          </h3>

          {/* Short description / specs teaser */}
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3.5">
            {listing.description}
          </p>

          {/* Fractional Appliance Slot Meter */}
          {isFractional && (
            <div className="mb-3.5 rounded-xl bg-slate-50 p-2.5 border border-slate-200/70">
              <div className="flex items-center justify-between text-[11px] font-medium mb-1.5">
                <span className="text-slate-600 flex items-center gap-1">
                  <Users className="w-3 h-3 text-slate-400" />
                  Subscriber Co-Op Cap
                </span>
                <span
                  className={cn(
                    'font-semibold',
                    isFull ? 'text-rose-600' : 'text-slate-800'
                  )}
                >
                  {listing.currentSubscribersCount}/{listing.maxSubscribers} filled
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden flex">
                <div
                  className={cn(
                    'h-full transition-all duration-300',
                    isFull ? 'bg-rose-500' : 'bg-slate-900'
                  )}
                  style={{
                    width: `${(listing.currentSubscribersCount / listing.maxSubscribers) * 100}%`,
                  }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
                <span>{slotsRemaining > 0 ? `${slotsRemaining} slot remaining` : 'Waitlist only'}</span>
                <span className="text-slate-700 font-medium">Zero-Queue Guarantee</span>
              </div>
            </div>
          )}
        </div>

        {/* Card Footer: Host Avatar & Dynamic Price */}
        <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between mt-1">
          <div className="flex items-center gap-2">
            <img
              src={listing.owner.image}
              alt={listing.owner.name}
              referrerPolicy="no-referrer"
              className="w-7.5 h-7.5 rounded-full object-cover border border-slate-200"
            />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-800 leading-tight">
                {listing.owner.name}
              </span>
              <span className="text-[10px] text-slate-400 leading-none">
                Trust {listing.owner.trustScore}%
              </span>
            </div>
          </div>

          <div className="text-right">{renderRateBadge()}</div>
        </div>
      </div>
    </div>
  );
};

