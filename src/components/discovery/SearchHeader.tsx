import React, { useState, useEffect } from 'react';
import {
  Search,
  MapPin,
  Navigation,
  Crosshair,
  SlidersHorizontal,
  X,
  Check,
  AlertCircle,
  Share2,
  Sparkles,
  Compass,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface LocationState {
  latitude: number | null;
  longitude: number | null;
  label: string;
  isGeoActive: boolean;
  error?: string | null;
}

export interface SearchHeaderProps {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  locationState: LocationState;
  onLocationChange: (loc: Partial<LocationState>) => void;
  radiusKm: number;
  onRadiusChange: (radius: number) => void;
  cityFilter: string;
  onCityFilterChange: (city: string) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
  totalResultsCount: number;
}

// Preset neighborhood coordinates in Cape Town
const CAPE_TOWN_NEIGHBORHOODS = [
  { name: 'All Cape Town', city: 'Cape Town', lat: null, lng: null },
  { name: 'Observatory', city: 'Cape Town', lat: -33.936, lng: 18.4715 },
  { name: 'Woodstock', city: 'Cape Town', lat: -33.928, lng: 18.4485 },
  { name: 'Tamboerskloof', city: 'Cape Town', lat: -33.9295, lng: 18.4055 },
  { name: 'Claremont', city: 'Cape Town', lat: -33.9805, lng: 18.465 },
  { name: 'Sea Point', city: 'Cape Town', lat: -33.915, lng: 18.39 },
];

const RADIUS_OPTIONS = [5, 10, 25, 50];

export const SearchHeader: React.FC<SearchHeaderProps> = ({
  searchTerm,
  onSearchTermChange,
  locationState,
  onLocationChange,
  radiusKm,
  onRadiusChange,
  cityFilter,
  onCityFilterChange,
  onResetFilters,
  hasActiveFilters,
  totalResultsCount,
}) => {
  const [isLocating, setIsLocating] = useState(false);
  const [showCopiedNotification, setShowCopiedNotification] = useState(false);

  // Trigger HTML5 Geolocation API
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      onLocationChange({
        error: 'Geolocation is not supported by your browser.',
        isGeoActive: false,
      });
      return;
    }

    setIsLocating(true);
    onLocationChange({ error: null });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        onLocationChange({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: 'Current Device Location',
          isGeoActive: true,
          error: null,
        });
      },
      (error) => {
        setIsLocating(false);
        let errorMsg = 'Unable to retrieve your location.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location permission denied. Select a neighborhood preset.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'GPS location unavailable.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Location request timed out.';
        }
        onLocationChange({
          error: errorMsg,
          isGeoActive: false,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  const handleShareSearchUrl = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setShowCopiedNotification(true);
      setTimeout(() => setShowCopiedNotification(false), 2500);
    }
  };

  return (
    <div className="w-full bg-slate-50/80 border-b border-slate-200/90 py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-3">
        {/* Main Discovery Bar: Search Input + Geolocation "Near Me" Button + Share Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          {/* Search Term Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="discovery-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              placeholder="Search car parts, power tools, washing machines, studios..."
              className="w-full pl-10 pr-9 py-2.5 text-sm bg-white rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 outline-none shadow-2xs transition-all text-slate-900 placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                id="clear-search-btn"
                type="button"
                onClick={() => onSearchTermChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* "Near Me" / HTML5 Geolocation Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="near-me-btn"
              type="button"
              onClick={handleDetectLocation}
              disabled={isLocating}
              className={cn(
                'inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-2xs',
                locationState.isGeoActive
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-700'
                  : 'bg-white text-slate-700 hover:bg-slate-100/80 border border-slate-200'
              )}
            >
              {isLocating ? (
                <Crosshair className="w-4 h-4 text-indigo-500 animate-spin" />
              ) : locationState.isGeoActive ? (
                <Navigation className="w-4 h-4 text-white fill-white" />
              ) : (
                <Compass className="w-4 h-4 text-indigo-600" />
              )}
              <span>
                {isLocating
                  ? 'Detecting GPS...'
                  : locationState.isGeoActive
                  ? 'Near Me (GPS Active)'
                  : 'Around Me'}
              </span>
            </button>

            {/* Share Search URL Button */}
            <button
              id="share-search-url-btn"
              type="button"
              onClick={handleShareSearchUrl}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white text-slate-700 hover:bg-slate-100/80 border border-slate-200 shadow-2xs transition-all cursor-pointer"
              title="Copy shareable search link"
            >
              {showCopiedNotification ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Link Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Share Search</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Proximity Radius, Presets, and Active Location Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
          {/* Left: Neighborhood Presets & Radius Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              Neighborhoods:
            </span>

            {CAPE_TOWN_NEIGHBORHOODS.map((hood) => {
              const isSelected =
                (hood.lat === null && !locationState.latitude) ||
                (locationState.latitude === hood.lat &&
                  locationState.longitude === hood.lng);

              return (
                <button
                  key={hood.name}
                  id={`hood-btn-${hood.name.toLowerCase().replace(/\s+/g, '-')}`}
                  type="button"
                  onClick={() => {
                    if (hood.lat === null) {
                      onLocationChange({
                        latitude: null,
                        longitude: null,
                        label: 'All Cape Town',
                        isGeoActive: false,
                        error: null,
                      });
                    } else {
                      onLocationChange({
                        latitude: hood.lat,
                        longitude: hood.lng,
                        label: hood.name,
                        isGeoActive: false,
                        error: null,
                      });
                    }
                  }}
                  className={cn(
                    'px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                  )}
                >
                  {hood.name}
                </button>
              );
            })}

            {/* Proximity Radius Selector (when location is set) */}
            {locationState.latitude !== null && (
              <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
                <span className="text-slate-400 font-medium">Radius:</span>
                {RADIUS_OPTIONS.map((r) => (
                  <button
                    key={r}
                    id={`radius-pill-${r}km`}
                    type="button"
                    onClick={() => onRadiusChange(r)}
                    className={cn(
                      'px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer',
                      radiusKm === r
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    )}
                  >
                    {r} km
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Results Count & Clear Filters Trigger */}
          <div className="flex items-center gap-2.5">
            {hasActiveFilters && (
              <button
                id="reset-filters-btn"
                type="button"
                onClick={onResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200/70 transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
                Reset Filters
              </button>
            )}

            <span className="text-slate-500 font-medium">
              Found <strong className="text-slate-900">{totalResultsCount}</strong> {totalResultsCount === 1 ? 'asset' : 'assets'}
            </span>
          </div>
        </div>

        {/* Location Error Notice if any */}
        {locationState.error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200/80 text-xs text-amber-800 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{locationState.error}</span>
          </div>
        )}
      </div>
    </div>
  );
};
