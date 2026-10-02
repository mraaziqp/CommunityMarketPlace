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
import { ListingModel } from '../../types';
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
                  Distances are approximate. Hosts share their exact address after you book.
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

      {/* Skeleton Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs animate-pulse">
              <div className="aspect-[4/3] bg-slate-200/70" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-slate-200 rounded-md w-3/4" />
                <div className="h-3 bg-slate-100 rounded-md w-1/2" />
                <div className="flex justify-between items-center pt-2">
                  <div className="h-4 bg-slate-200 rounded-md w-1/4" />
                  <div className="h-4 bg-slate-100 rounded-md w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {listings.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-3xl border border-slate-200/90 text-center shadow-2xs">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4 shadow-2xs">
            <Sparkles className="w-8 h-8 text-indigo-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">
            Be the first to share in your neighbourhood
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
            {isGeoActive
              ? `We couldn't find items within ${radiusKm} km of ${locationState.label}. List something to start sharing with neighbours!`
              : 'Turn your unused tools, appliances, or camping equipment into monthly income and community value.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onResetFilters}
              className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              Reset filters
            </button>
            {isGeoActive && radiusKm < 50 && (
              <button
                id="empty-expand-radius-btn"
                type="button"
                onClick={() => onExpandRadius(50)}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Expand search (50 km)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Listings Grid */}
      {!isLoading && listings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onSelect={onSelectListing}
              isSubscribed={isSubscribedCheck ? isSubscribedCheck(listing.id) : false}
            />
          ))}
        </div>
      )}
    </div>
  );
};
