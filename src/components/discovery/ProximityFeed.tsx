import React from 'react';
import {
  MapPin,
  Shield,
  Navigation,
  Sparkles,
  SlidersHorizontal,
  Compass,
  X,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { ListingModel, PricingTierModel } from '../../types';
import { ListingCard } from '../listings/ListingCard';
import { LocationState } from './SearchHeader';
import { cn } from '../../lib/utils';

export interface ProximityFeedProps {
  listings: ListingModel[];
  locationState: LocationState;
  radiusKm: number;
  selectedCategorySlug: string;
  selectedSubcategorySlug?: string | null;
  searchTerm: string;
  onSelectListing: (listing: ListingModel) => void;
  onQuickSubscribe?: (listing: ListingModel, tier: PricingTierModel) => void;
  isSubscribedCheck?: (listingId: string) => boolean;
  onExpandRadius: (newRadius: number) => void;
  onResetFilters: () => void;
  isLoading?: boolean;
}

export const ProximityFeed: React.FC<ProximityFeedProps> = ({
  listings,
  locationState,
  radiusKm,
  selectedCategorySlug,
  selectedSubcategorySlug,
  searchTerm,
  onSelectListing,
  onQuickSubscribe,
  isSubscribedCheck,
  onExpandRadius,
  onResetFilters,
  isLoading = false,
}) => {
  const isGeoActive = locationState.latitude !== null;

  return (
    <div className="w-full space-y-5">
      {/* Proximity & Privacy Context Banner */}
      {isGeoActive && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-slate-900">
                  Sorted by proximity to {locationState.label || 'Your Location'}
                </span>
                <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  ≤ {radiusKm} km radius
                </span>
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                <Shield className="w-3 h-3 text-emerald-600 inline shrink-0" />
                <span>
                  Host privacy shield active: distances are approximate until booking confirmation.
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {radiusKm < 50 && (
              <button
                id="expand-radius-50km-btn"
                type="button"
                onClick={() => onExpandRadius(50)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-xl border border-indigo-200/60 transition-colors cursor-pointer"
              >
                Expand to 50 km
              </button>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {listings.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-3xl border border-slate-200 text-center shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
            <Compass className="w-7 h-7 text-indigo-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">
            No listings found in this proximity
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
            {isGeoActive
              ? `There are currently no items matching your criteria within ${radiusKm} km of ${locationState.label}. Try expanding your search radius or clearing active filters.`
              : 'No items match your current filter and search criteria. Try a different keyword or category.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {isGeoActive && radiusKm < 50 && (
              <button
                id="empty-expand-radius-btn"
                type="button"
                onClick={() => onExpandRadius(50)}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Expand Search to 50 km
              </button>
            )}
            <button
              id="empty-reset-filters-btn"
              type="button"
              onClick={onResetFilters}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200/80 transition-colors cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      {/* Listings Grid */}
      {listings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onSelect={onSelectListing}
              onQuickSubscribe={onQuickSubscribe}
              isSubscribed={isSubscribedCheck ? isSubscribedCheck(listing.id) : false}
            />
          ))}
        </div>
      )}
    </div>
  );
};
