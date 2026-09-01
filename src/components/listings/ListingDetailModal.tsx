import React, { useState, useEffect } from 'react';
import {
  X,
  Star,
  ShieldCheck,
  MapPin,
  Users,
  Repeat,
  Zap,
  Lock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  MessageCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { ListingModel, PricingTierModel, UserSubscriptionModel } from '../../types';
import { formatCurrency, formatTierRate, cn } from '../../lib/utils';
import { generateAwehChatLink } from '../../lib/awehchat';
import { getListingById } from '../../../actions/listings';

export interface ListingDetailModalProps {
  listing: ListingModel | null;
  onClose: () => void;
  onSubscribe: (listing: ListingModel, tier: PricingTierModel) => void;
  userSubscription?: UserSubscriptionModel;
  onLogUsage?: (subscriptionId: string, notes: string) => void;
  onMessageHost?: (listing: ListingModel) => void;
}

export const ListingDetailModal: React.FC<ListingDetailModalProps> = ({
  listing: initialListing,
  onClose,
  onSubscribe,
  userSubscription,
  onLogUsage,
  onMessageHost,
}) => {
  if (!initialListing) return null;

  const [currentListing, setCurrentListing] = useState<ListingModel>(initialListing);
  const [isLiveFetching, setIsLiveFetching] = useState<boolean>(false);
  const [selectedTierId, setSelectedTierId] = useState<string>(
    initialListing.pricingTiers[0]?.id || ''
  );
  const [selectedImage, setSelectedImage] = useState<number>(0);
  const [cycleNotes, setCycleNotes] = useState<string>('Standard 40°C Eco Cycle (60 min)');
  const [isLogging, setIsLogging] = useState(false);
  const [showLogSuccess, setShowLogSuccess] = useState(false);

  // Real Database Fetching: Refresh listing details, real host trust score, and live availability
  useEffect(() => {
    if (!initialListing?.id) return;
    let isMounted = true;
    setIsLiveFetching(true);

    getListingById(initialListing.id)
      .then((liveData) => {
        if (isMounted && liveData) {
          setCurrentListing(liveData);
          if (liveData.pricingTiers.length > 0 && !liveData.pricingTiers.some((t) => t.id === selectedTierId)) {
            setSelectedTierId(liveData.pricingTiers[0].id);
          }
        }
      })
      .catch((err) => {
        console.warn('Real-time listing sync note:', err);
      })
      .finally(() => {
        if (isMounted) setIsLiveFetching(false);
      });

    return () => {
      isMounted = false;
    };
  }, [initialListing?.id]);

  const listing = currentListing;

  const selectedTier =
    listing.pricingTiers.find((t) => t.id === selectedTierId) ||
    listing.pricingTiers[0];

  const isFractional = listing.category === 'fractional_appliance';
  const slotsRemaining = listing.maxSubscribers - listing.currentSubscribersCount;
  const isFull = slotsRemaining <= 0;

  const handleTriggerUse = () => {
    if (!userSubscription || !onLogUsage) return;
    setIsLogging(true);
    setTimeout(() => {
      onLogUsage(userSubscription.id, cycleNotes);
      setIsLogging(false);
      setShowLogSuccess(true);
      setTimeout(() => setShowLogSuccess(false), 3000);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div
        id="listing-detail-modal"
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/90">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                'px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider',
                listing.category === 'fractional_appliance'
                  ? 'bg-slate-900 text-white'
                  : listing.category === 'room'
                  ? 'bg-sky-100 text-sky-900 border border-sky-200/70'
                  : 'bg-amber-100 text-amber-900 border border-amber-200/70'
              )}
            >
              {listing.category.replace('_', ' ')}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              ID: {listing.id}
            </span>
            {isLiveFetching ? (
              <span className="flex items-center gap-1 text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-medium">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Syncing live...</span>
              </span>
            ) : (
              <span className="hidden sm:flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-medium border border-emerald-200/60">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Neon PG Live</span>
              </span>
            )}
          </div>

          <button
            id="close-detail-modal-btn"
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-6 space-y-6">
          {/* Media & Title Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Gallery (Left) */}
            <div className="md:col-span-7 space-y-3">
              <div className="aspect-[16/10] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/80">
                <img
                  src={listing.images[selectedImage] || listing.images[0]}
                  alt={listing.title}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Thumbnails */}
              {listing.images.length > 1 && (
                <div className="flex gap-2">
                  {listing.images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedImage(idx)}
                      className={cn(
                        'w-16 h-12 rounded-xl overflow-hidden border-2 transition-all',
                        idx === selectedImage
                          ? 'border-slate-900 ring-2 ring-slate-200'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      )}
                    >
                      <img
                        src={img}
                        alt="Thumbnail"
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Core Info & Host Summary (Right) */}
            <div className="md:col-span-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1 text-xs text-slate-500 mb-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{listing.neighborhood}, {listing.city}</span>
                </div>

                <h1 className="text-xl font-extrabold text-slate-900 leading-snug mb-2">
                  {listing.title}
                </h1>

                <div className="flex items-center gap-3 text-xs mb-4">
                  <div className="flex items-center gap-1 font-semibold text-slate-800">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>{listing.rating.toFixed(2)}</span>
                    <span className="text-slate-400 font-normal">({listing.reviewCount} reviews)</span>
                  </div>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-700 font-medium bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70">
                    {listing.depositRequiredInCents > 0
                      ? `Refundable Deposit: ${formatCurrency(listing.depositRequiredInCents)}`
                      : 'No Deposit Required'}
                  </span>
                </div>

                {/* Host Profile Box with AwehChat P2P Communication */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={listing.owner.image}
                      alt={listing.owner.name}
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-2xs shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-slate-900 truncate">
                          {listing.owner.name}
                        </span>
                        {listing.owner.isSuperHost && (
                          <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium">
                        Host · {listing.owner.trustScore}% Trust Score
                      </p>
                    </div>
                  </div>

                  <a
                    id="chat-awehchat-detail-btn"
                    href={generateAwehChatLink(
                      listing.owner.id || listing.ownerId || 'usr_host',
                      listing.id,
                      listing.title,
                      {
                        hostName: listing.owner.name,
                      }
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs hover:shadow-md transition-all shrink-0 cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 text-white fill-white/20" />
                    <span>Chat on AwehChat</span>
                    <ExternalLink className="w-3 h-3 text-emerald-200 ml-0.5" />
                  </a>
                </div>

                {/* Fractional Capacity Box */}
                {isFractional && (
                  <div className="mt-4 p-3.5 rounded-2xl bg-slate-100/80 border border-slate-200/80">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-slate-900 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        Co-Op Subscriber Capacity
                      </span>
                      <span className="font-bold text-slate-900">
                        {listing.currentSubscribersCount} / {listing.maxSubscribers} Spots
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden flex">
                      <div
                        className="h-full bg-slate-900 transition-all duration-300"
                        style={{
                          width: `${(listing.currentSubscribersCount / listing.maxSubscribers) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1.5">
                      {slotsRemaining > 0
                        ? `Only ${slotsRemaining} subscription slot remaining to maintain zero waiting.`
                        : 'Currently at full capacity. Next cycle opens on 1st of month.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description & Specifications */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 border-t border-slate-100">
            <div className="md:col-span-7 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">About this Share</h3>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                  {listing.description}
                </p>
              </div>

              {/* Hardware / Space Specifications */}
              {listing.specs && (
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Specifications & Hardware
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {listing.specs.brand && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Brand / Model</span>
                        <span className="font-semibold text-slate-900">{listing.specs.brand} {listing.specs.model}</span>
                      </div>
                    )}
                    {listing.specs.powerRating && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Power & Efficiency</span>
                        <span className="font-semibold text-slate-900">{listing.specs.powerRating}</span>
                      </div>
                    )}
                    {listing.specs.bedrooms && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Bedrooms / Baths</span>
                        <span className="font-semibold text-slate-900">{listing.specs.bedrooms} Bed · {listing.specs.bathrooms} Bath</span>
                      </div>
                    )}
                    {listing.specs.warrantyStatus && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Maintenance Status</span>
                        <span className="font-semibold text-slate-900">{listing.specs.warrantyStatus}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Amenities */}
              {listing.amenities && listing.amenities.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Included Amenities & Care
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {listing.amenities.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-medium border border-slate-200/60"
                      >
                        <Sparkles className="w-3 h-3 text-indigo-500" />
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Rules */}
              {listing.rules && (
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/70 text-xs text-amber-950 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">Community Rules & Etiquette:</span>
                    <span className="leading-relaxed">{listing.rules}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Pricing Tiers & Active Action */}
            <div className="md:col-span-5 space-y-4">
              {/* If already subscribed: Show Live Quota & Usage Trigger */}
              {userSubscription ? (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Active Subscription</h4>
                        <p className="text-[11px] text-slate-500 font-medium">{userSubscription.pricingTier.name}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                      <span className="text-slate-600">Remaining Monthly Quota</span>
                      <span className="text-slate-900 font-bold text-sm">
                        {userSubscription.remainingUsesThisPeriod} Uses Left
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
                      <div
                        className="h-full bg-emerald-500"
                        style={{
                          width: `${Math.max(
                            5,
                            (userSubscription.remainingUsesThisPeriod /
                              (userSubscription.pricingTier.usageLimitPerPeriod || 10)) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      Resets automatically at end of cycle: {userSubscription.currentPeriodEnd}
                    </p>
                  </div>

                  {/* Usage Trigger Simulator */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-200/70">
                    <label className="text-xs font-bold text-slate-800 block">
                      Simulate Triggering Machine / Use (Physical Run):
                    </label>
                    <input
                      type="text"
                      value={cycleNotes}
                      onChange={(e) => setCycleNotes(e.target.value)}
                      placeholder="e.g. 40°C Eco Wash (60 min)"
                      className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />

                    <button
                      type="button"
                      onClick={handleTriggerUse}
                      disabled={isLogging || userSubscription.remainingUsesThisPeriod <= 0}
                      className={cn(
                        'w-full py-2.5 px-4 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-2 transition-all shadow-xs',
                        userSubscription.remainingUsesThisPeriod > 0
                          ? 'bg-slate-900 hover:bg-slate-800'
                          : 'bg-slate-400 cursor-not-allowed'
                      )}
                    >
                      <Zap className="w-4 h-4 text-amber-400" />
                      {isLogging
                        ? 'Activating Machine & Logging...'
                        : userSubscription.remainingUsesThisPeriod > 0
                        ? 'Trigger Appliance & Decrement Quota'
                        : 'Quota Depleted for this Period'}
                    </button>

                    {showLogSuccess && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-medium flex items-center gap-1.5 animate-in fade-in">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Usage log recorded in Drizzle table `UsageLogs` (-1 quota).
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Select Pricing Tier & Subscribe Form */
                <div className="space-y-3.5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Select Sharing Tier
                  </h4>

                  <div className="space-y-2">
                    {listing.pricingTiers.map((tier) => {
                      const isSelected = tier.id === selectedTierId;
                      return (
                        <div
                          key={tier.id}
                          onClick={() => setSelectedTierId(tier.id)}
                          className={cn(
                            'p-3.5 rounded-xl border text-left cursor-pointer transition-all',
                            isSelected
                              ? 'bg-white border-slate-900 ring-2 ring-slate-200 shadow-xs'
                              : 'bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300'
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs text-slate-900">
                              {tier.name}
                            </span>
                            <span className="font-bold text-sm text-slate-900">
                              {formatCurrency(tier.priceInCents, tier.currency)}
                              {tier.type === 'monthly_subscription' && (
                                <span className="text-[10px] font-normal text-slate-500"> /mo</span>
                              )}
                              {tier.type === 'nightly' && (
                                <span className="text-[10px] font-normal text-slate-500"> /night</span>
                              )}
                              {tier.type === 'daily' && (
                                <span className="text-[10px] font-normal text-slate-500"> /day</span>
                              )}
                            </span>
                          </div>
                          {tier.description && (
                            <p className="text-[11px] text-slate-500 leading-tight">
                              {tier.description}
                            </p>
                          )}
                          {tier.usageLimitPerPeriod && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-slate-700">
                              <Repeat className="w-3 h-3 text-indigo-600" />
                              Includes {tier.usageLimitPerPeriod} fractional uses per month
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Booking / Subscription Trigger Button */}
                  <button
                    id="modal-confirm-subscribe-btn"
                    type="button"
                    onClick={() => onSubscribe(listing, selectedTier)}
                    disabled={isFractional && isFull}
                    className={cn(
                      'w-full py-3 px-4 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-xs transition-all',
                      isFractional && isFull
                        ? 'bg-slate-400 cursor-not-allowed'
                        : 'bg-slate-900 hover:bg-slate-800 hover:shadow-md'
                    )}
                  >
                    <span>
                      {isFractional
                        ? isFull
                          ? 'Co-Op Fully Subscribed'
                          : `Join Fractional Co-Op (${formatTierRate(selectedTier)})`
                        : listing.category === 'room'
                        ? 'Book Nightly Reservation'
                        : `Rent Equipment (${formatTierRate(selectedTier)})`}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <p className="text-[10px] text-center text-slate-400">
                    Backed by ShareHub Community Guarantee · Cancel anytime
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

