import React, { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  PauseCircle,
  PlayCircle,
  Eye,
  Star,
  DollarSign,
  Calendar,
  Users,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  PackageCheck,
} from 'lucide-react';
import { HostListing, api } from '../../api/client';
import { BookingModel, ListingModel } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { RentalCard } from './RentalCard';

export interface MyListingsSectionProps {
  hostListings: HostListing[];
  bookings: BookingModel[];
  onRefresh: () => Promise<void>;
  onEdit: (listing: ListingModel) => void;
  onView: (listing: ListingModel) => void;
  onCreateNew: () => void;
  onConfirmPickup: (bookingId: string, code: string) => Promise<void>;
  onPay: (b: BookingModel) => void;
  onCheckReturn: (b: BookingModel) => void;
  onReview: (b: BookingModel) => void;
  showToast: (msg: string, tone?: 'success' | 'info') => void;
}

export const MyListingsSection: React.FC<MyListingsSectionProps> = ({
  hostListings,
  bookings,
  onRefresh,
  onEdit,
  onView,
  onCreateNew,
  onConfirmPickup,
  onPay,
  onCheckReturn,
  onReview,
  showToast,
}) => {
  const [busyListingId, setBusyListingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedListingId, setExpandedListingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);

  const handleToggleAvailability = async (item: HostListing) => {
    setActionError(null);
    setBusyListingId(item.listing.id);
    try {
      const nextStatus = !item.listing.isAvailable;
      await api.updateListing(item.listing.id, { isAvailable: nextStatus });
      await onRefresh();
      showToast(nextStatus ? `"${item.listing.title}" is now Live.` : `"${item.listing.title}" is paused.`);
    } catch (err: any) {
      setActionError({ id: item.listing.id, message: err?.message || 'Could not update listing.' });
    } finally {
      setBusyListingId(null);
    }
  };

  const handleDeleteListing = async (listingId: string) => {
    setActionError(null);
    setBusyListingId(listingId);
    try {
      await api.deleteListing(listingId);
      setDeleteConfirmId(null);
      await onRefresh();
      showToast('Listing removed successfully.');
    } catch (err: any) {
      setActionError({ id: listingId, message: err?.message || 'Could not delete listing.' });
    } finally {
      setBusyListingId(null);
    }
  };

  if (hostListings.length === 0) {
    return (
      <div className="text-center py-16 px-4 bg-white rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
          <PackageCheck className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">You haven't listed anything yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Turn your unused tools, spare room, camping gear or appliances into neighbourhood income.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateNew}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          <span>Share your first item</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">My Listings & Equipment</h2>
          <p className="text-xs text-slate-500">Manage what you share, view bookings and check item performance</p>
        </div>
        <button
          type="button"
          onClick={onCreateNew}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
          <span>Add new listing</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {hostListings.map(({ listing, stats }) => {
          const isBusy = busyListingId === listing.id;
          const isConfirmingDelete = deleteConfirmId === listing.id;
          const isExpanded = expandedListingId === listing.id;
          const incoming = bookings.filter((b) => b.viewerRole === 'host' && b.listingId === listing.id);

          return (
            <div
              key={listing.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden"
            >
              {/* Image & Status Tag */}
              <div className="relative h-44 bg-slate-100 overflow-hidden">
                {listing.images?.[0] ? (
                  <img
                    src={listing.images[0]}
                    alt={listing.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-sm">
                    No photo
                  </div>
                )}
                <div className="absolute top-3 left-3 flex gap-1.5">
                  <span
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[10px] font-bold shadow-xs backdrop-blur-md',
                      listing.isAvailable
                        ? 'bg-emerald-500/90 text-white'
                        : 'bg-slate-800/90 text-slate-200'
                    )}
                  >
                    {listing.isAvailable ? 'Live' : 'Paused'}
                  </span>
                  {listing.visibilityGroupName && (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-900/80 text-white shadow-xs backdrop-blur-md">
                      {listing.visibilityGroupName}
                    </span>
                  )}
                </div>
              </div>

              {/* Listing Content */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 leading-snug line-clamp-1">{listing.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{listing.neighborhood || listing.city}</p>

                  {/* Performance Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 mt-3.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Bookings</span>
                      <span className="text-xs font-bold text-slate-800">{stats.totalBookings}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Earned</span>
                      <span className="text-xs font-bold text-emerald-600">{formatCurrency(stats.earningsCents)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Rating</span>
                      <span className="text-xs font-bold text-amber-600 flex items-center justify-center gap-0.5">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                        {stats.rating ? stats.rating.toFixed(1) : 'New'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Error Banner */}
                {actionError?.id === listing.id && (
                  <div role="alert" className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <span>{actionError.message}</span>
                  </div>
                )}

                {/* Card Actions */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onView(listing)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      title="Preview listing"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(listing)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      title="Edit details and rates"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleAvailability({ listing, stats })}
                      disabled={isBusy}
                      className={cn(
                        'py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors',
                        listing.isAvailable
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                      )}
                      title={listing.isAvailable ? 'Pause bookings' : 'Resume bookings'}
                    >
                      {listing.isAvailable ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                      <span>{listing.isAvailable ? 'Pause' : 'Resume'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(listing.id)}
                      disabled={isBusy}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 text-xs font-bold cursor-pointer transition-colors"
                      title="Delete listing"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Incoming Bookings Toggle */}
                  {incoming.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpandedListingId(isExpanded ? null : listing.id)}
                      className="w-full py-1.5 px-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors border border-slate-200/60"
                    >
                      <span className="flex items-center gap-1.5 text-indigo-700 font-bold">
                        <Calendar className="w-3.5 h-3.5" />
                        {incoming.length} incoming {incoming.length === 1 ? 'booking' : 'bookings'}
                      </span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                {/* Delete Confirmation Alert */}
                {isConfirmingDelete && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-xs">
                    <p className="font-semibold text-rose-900">Are you sure you want to delete this listing?</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteListing(listing.id)}
                        disabled={isBusy}
                        className="px-3 py-1 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 cursor-pointer text-xs"
                      >
                        {isBusy ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-3 py-1 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300 cursor-pointer text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Expanded Incoming Bookings Drawer */}
              {isExpanded && incoming.length > 0 && (
                <div className="p-4 bg-slate-50/80 border-t border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Bookings for this item</h4>
                  <div className="space-y-3">
                    {incoming.map((b) => (
                      <RentalCard
                        key={b.id}
                        booking={b}
                        onConfirmPickup={onConfirmPickup}
                        onPay={onPay}
                        onCheckReturn={onCheckReturn}
                        onReview={onReview}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
