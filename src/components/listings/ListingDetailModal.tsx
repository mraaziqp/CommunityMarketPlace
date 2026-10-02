import React, { useMemo, useState } from 'react';
import {
  X,
  Star,
  ShieldCheck,
  MapPin,
  Users,
  Repeat,
  Zap,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  MessageCircle,
  ExternalLink,
  Loader2,
  Lock,
  KeyRound,
  CalendarDays,
} from 'lucide-react';
import { ListingModel, PricingTierModel, UserSubscriptionModel } from '../../types';
import { formatCurrency, formatTierRate, cn } from '../../lib/utils';
import { generateAwehChatLink } from '../../lib/awehchat';

export interface ListingDetailModalProps {
  listing: ListingModel;
  currentUserId: string | null;
  userSubscription?: UserSubscriptionModel;
  onClose: () => void;
  /** Each action rejects with a friendly message that is shown inline. */
  onJoinCoop: (listing: ListingModel, tier: PricingTierModel) => Promise<void>;
  onBook: (listing: ListingModel, tier: PricingTierModel, start: Date, end: Date) => Promise<void>;
  onLogUsage: (subscriptionId: string, notes: string) => Promise<void>;
  onRequireSignIn: () => void;
}

const HOUR_MS = 60 * 60 * 1000;
const BOOKABLE = ['hourly', 'daily', 'nightly'];

const UNIT_LABEL: Record<string, [string, string]> = {
  hourly: ['hour', 'hours'],
  daily: ['day', 'days'],
  nightly: ['night', 'nights'],
};

const CATEGORY_LABEL: Record<ListingModel['category'], string> = {
  fractional_appliance: 'Shared appliance',
  physical_item: 'Tools & equipment',
  room: 'Space',
};

const ACCESS_LABEL: Record<ListingModel['accessMethod'], string> = {
  smart_plug: 'Unlocks with your personal code',
  pin_code: 'Door code shared after booking',
  qr_code: 'Scan-to-start with your code',
  host_handover: 'Collect from the host in person',
};

function tomorrowISODate() {
  const d = new Date(Date.now() + 24 * HOUR_MS);
  return d.toISOString().slice(0, 10);
}

function pluralUnit(type: string, n: number) {
  const [one, many] = UNIT_LABEL[type] ?? ['unit', 'units'];
  return `${n} ${n === 1 ? one : many}`;
}

export const ListingDetailModal: React.FC<ListingDetailModalProps> = ({
  listing,
  currentUserId,
  userSubscription,
  onClose,
  onJoinCoop,
  onBook,
  onLogUsage,
  onRequireSignIn,
}) => {
  const [selectedTierId, setSelectedTierId] = useState<string>(listing.pricingTiers[0]?.id ?? '');
  const [selectedImage, setSelectedImage] = useState(0);
  const [cycleNotes, setCycleNotes] = useState('');
  const [startDate, setStartDate] = useState(tomorrowISODate);
  const [startTime, setStartTime] = useState('09:00');
  const [quantity, setQuantity] = useState(1);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justUsed, setJustUsed] = useState(false);

  const selectedTier = listing.pricingTiers.find((t) => t.id === selectedTierId) ?? listing.pricingTiers[0];
  const isOwner = !!currentUserId && currentUserId === listing.owner.id;
  const isCoop = listing.category === 'fractional_appliance';
  const isBookable = !!selectedTier && BOOKABLE.includes(selectedTier.type);
  const spotsLeft = listing.maxSubscribers - listing.currentSubscribersCount;
  const isFull = isCoop && spotsLeft <= 0;

  const bookingWindow = useMemo(() => {
    if (!selectedTier || !isBookable) return null;
    const time = selectedTier.type === 'nightly' ? '14:00' : selectedTier.type === 'hourly' ? startTime : '09:00';
    const start = new Date(`${startDate}T${time}`);
    if (Number.isNaN(start.getTime())) return null;
    const unit = selectedTier.type === 'hourly' ? HOUR_MS : 24 * HOUR_MS;
    const end = new Date(start.getTime() + quantity * unit);
    return { start, end, rental: quantity * selectedTier.priceInCents };
  }, [selectedTier, isBookable, startDate, startTime, quantity]);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setIsWorking(true);
    try {
      await action();
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsWorking(false);
    }
  };

  const handlePrimary = () => {
    if (!currentUserId) {
      onRequireSignIn();
      return;
    }
    if (!selectedTier) return;
    if (isBookable) {
      if (!bookingWindow) {
        setError('Please choose a start date.');
        return;
      }
      run(() => onBook(listing, selectedTier, bookingWindow.start, bookingWindow.end));
    } else {
      run(() => onJoinCoop(listing, selectedTier));
    }
  };

  const handleUse = () => {
    if (!userSubscription) return;
    run(async () => {
      await onLogUsage(userSubscription.id, cycleNotes.trim());
      setCycleNotes('');
      setJustUsed(true);
      window.setTimeout(() => setJustUsed(false), 3000);
    });
  };

  const primaryLabel = !currentUserId
    ? 'Sign in to continue'
    : isBookable
    ? bookingWindow
      ? `Book for ${formatCurrency(bookingWindow.rental, selectedTier.currency)}`
      : 'Book'
    : isFull
    ? 'This co-op is full'
    : `Join for ${formatTierRate(selectedTier)}`;

  const unitType = selectedTier?.type ?? 'daily';
  const maxQuantity = unitType === 'hourly' ? 12 : 30;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div
        id="listing-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="listing-title"
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'px-2.5 py-0.5 rounded-full text-xs font-semibold',
                isCoop ? 'bg-slate-900 text-white' : listing.category === 'room' ? 'bg-sky-100 text-sky-900' : 'bg-amber-100 text-amber-900'
              )}
            >
              {CATEGORY_LABEL[listing.category]}
            </span>
            {listing.visibilityGroupName && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Lock className="w-3 h-3" />
                {listing.visibilityGroupName} members
              </span>
            )}
          </div>

          <button
            id="close-detail-modal-btn"
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Gallery */}
            <div className="md:col-span-7 space-y-3">
              <div className="aspect-[16/10] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/80">
                <img
                  src={listing.images[selectedImage] || listing.images[0]}
                  alt={listing.title}
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              {listing.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {listing.images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      aria-label={`Show photo ${idx + 1}`}
                      onClick={() => setSelectedImage(idx)}
                      className={cn(
                        'w-16 h-12 rounded-xl overflow-hidden border-2 transition-all shrink-0',
                        idx === selectedImage ? 'border-slate-900 ring-2 ring-slate-200' : 'border-transparent opacity-70 hover:opacity-100'
                      )}
                    >
                      <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Summary & host */}
            <div className="md:col-span-5 space-y-4">
              <div>
                <div className="flex items-center gap-1 text-xs text-slate-500 mb-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {listing.neighborhood}, {listing.city}
                  </span>
                  {listing.formattedDistance && <span className="text-slate-400">· {listing.formattedDistance}</span>}
                </div>
                <h1 id="listing-title" className="text-xl font-extrabold text-slate-900 leading-snug mb-2">
                  {listing.title}
                </h1>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs">
                  {listing.rating !== undefined && listing.reviewCount ? (
                    <span className="flex items-center gap-1 font-semibold text-slate-800">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      {listing.rating.toFixed(2)}
                      <span className="text-slate-400 font-normal">({listing.reviewCount} reviews)</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-semibold text-indigo-700">
                      <Sparkles className="w-3.5 h-3.5" /> New listing
                    </span>
                  )}
                  <span className="text-slate-700">
                    {listing.depositRequiredInCents > 0
                      ? `${formatCurrency(listing.depositRequiredInCents)} refundable deposit`
                      : 'No deposit'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={listing.owner.image}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-2xs shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-slate-900 truncate">{listing.owner.name}</span>
                      {listing.owner.isSuperHost && <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" aria-label="Verified host" />}
                    </div>
                    <p className="text-xs text-slate-500">Host · {listing.owner.trustScore}% trust score</p>
                  </div>
                </div>
                {!isOwner && (
                  <a
                    id="chat-awehchat-detail-btn"
                    href={generateAwehChatLink(listing.owner.id, listing.id, listing.title, { hostName: listing.owner.name.split(' ')[0] })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all shrink-0"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Message host</span>
                    <ExternalLink className="w-3 h-3 text-emerald-200" />
                  </a>
                )}
              </div>

              {isCoop && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-900 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      Households sharing
                    </span>
                    <span className="font-bold text-slate-900">
                      {listing.currentSubscribersCount} of {listing.maxSubscribers}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-slate-900 transition-all duration-300"
                      style={{ width: `${Math.min(100, (listing.currentSubscribersCount / Math.max(1, listing.maxSubscribers)) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1.5">
                    {spotsLeft > 0
                      ? `${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left. Groups stay small so there's rarely a wait.`
                      : 'Full right now. Spots open up when a household leaves.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 border-t border-slate-100">
            {/* Details */}
            <div className="md:col-span-7 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">About this listing</h3>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{listing.description}</p>
              </div>

              {listing.specs && (listing.specs.brand || listing.specs.powerRating || listing.specs.bedrooms || listing.specs.warrantyStatus) && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {listing.specs.brand && (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                      <span className="text-slate-400 block text-[10px] font-semibold">Make & model</span>
                      <span className="font-semibold text-slate-900">
                        {listing.specs.brand} {listing.specs.model}
                      </span>
                    </div>
                  )}
                  {listing.specs.powerRating && (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                      <span className="text-slate-400 block text-[10px] font-semibold">Power</span>
                      <span className="font-semibold text-slate-900">{listing.specs.powerRating}</span>
                    </div>
                  )}
                  {listing.specs.bedrooms && (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                      <span className="text-slate-400 block text-[10px] font-semibold">Rooms</span>
                      <span className="font-semibold text-slate-900">
                        {listing.specs.bedrooms} bed · {listing.specs.bathrooms} bath
                      </span>
                    </div>
                  )}
                  {listing.specs.warrantyStatus && (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                      <span className="text-slate-400 block text-[10px] font-semibold">Care & servicing</span>
                      <span className="font-semibold text-slate-900">{listing.specs.warrantyStatus}</span>
                    </div>
                  )}
                </div>
              )}

              {listing.amenities.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-2">What's included</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {listing.amenities.map((item) => (
                      <span key={item} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-medium">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                {ACCESS_LABEL[listing.accessMethod]}
              </p>

              {listing.rules && (
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/70 text-xs text-amber-950 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">House rules</span>
                    <span className="leading-relaxed">{listing.rules}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Action panel */}
            <div className="md:col-span-5 space-y-4">
              {error && (
                <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {isOwner ? (
                <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-sm text-indigo-950">
                  <span className="font-bold block mb-1">This is your listing</span>
                  <span className="text-xs text-indigo-800">
                    Bookings and co-op members will show up in My activity.
                  </span>
                </div>
              ) : userSubscription ? (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">You're a member</h4>
                      <p className="text-[11px] text-slate-500">{userSubscription.pricingTier.name}</p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-slate-200/80">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-600">Turns left this period</span>
                      <span className="text-slate-900 font-bold text-sm">
                        {userSubscription.remainingUsesThisPeriod} of {userSubscription.pricingTier.usageLimitPerPeriod ?? '—'}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500"
                        style={{
                          width: `${Math.max(4, (userSubscription.remainingUsesThisPeriod / (userSubscription.pricingTier.usageLimitPerPeriod || 10)) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1.5">
                      Refreshes on {new Date(userSubscription.currentPeriodEnd).toLocaleDateString()} · Your code{' '}
                      <strong className="font-mono text-slate-800">{userSubscription.accessKeyOrCode}</strong>
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-200/70">
                    <label htmlFor="cycle-notes" className="text-xs font-bold text-slate-800 block">
                      Using it now? <span className="font-normal text-slate-500">(optional note)</span>
                    </label>
                    <input
                      id="cycle-notes"
                      type="text"
                      value={cycleNotes}
                      onChange={(e) => setCycleNotes(e.target.value)}
                      placeholder="e.g. 40° cotton wash"
                      className="w-full px-3 py-2 text-sm bg-white rounded-xl border border-slate-200 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                    <button
                      type="button"
                      onClick={handleUse}
                      disabled={isWorking || userSubscription.remainingUsesThisPeriod <= 0}
                      className="w-full py-2.5 px-4 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all shadow-xs bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed"
                    >
                      {isWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-amber-400" />}
                      {userSubscription.remainingUsesThisPeriod > 0 ? 'Start my turn' : 'No turns left this period'}
                    </button>
                    {justUsed && (
                      <p className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center gap-1.5 animate-in fade-in">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Turn started. Enjoy!
                      </p>
                    )}
                  </div>
                </div>
              ) : listing.pricingTiers.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-600">
                  This listing isn't taking bookings right now.
                </div>
              ) : (
                <div className="space-y-3.5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <h4 className="text-xs font-bold text-slate-900">Choose an option</h4>
                  <div className="space-y-2" role="radiogroup" aria-label="Pricing options">
                    {listing.pricingTiers.map((tier) => {
                      const isSelected = tier.id === selectedTier?.id;
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => {
                            setSelectedTierId(tier.id);
                            setQuantity(1);
                            setError(null);
                          }}
                          className={cn(
                            'w-full p-3.5 rounded-xl border text-left cursor-pointer transition-all',
                            isSelected ? 'bg-white border-slate-900 ring-2 ring-slate-200 shadow-xs' : 'bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-bold text-xs text-slate-900">{tier.name}</span>
                            <span className="font-bold text-sm text-slate-900 whitespace-nowrap">{formatTierRate(tier)}</span>
                          </div>
                          {tier.description && <p className="text-[11px] text-slate-500 leading-tight">{tier.description}</p>}
                          {tier.usageLimitPerPeriod && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-slate-700">
                              <Repeat className="w-3 h-3 text-indigo-600" />
                              {tier.usageLimitPerPeriod} turns {tier.type === 'monthly_subscription' ? 'every month' : 'included'}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {isBookable && (
                    <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <CalendarDays className="w-3.5 h-3.5 text-indigo-600" /> When do you need it?
                      </div>
                      <div className={cn('grid gap-2', unitType === 'hourly' ? 'grid-cols-3' : 'grid-cols-2')}>
                        <label className="text-[11px] text-slate-600 col-span-1">
                          {unitType === 'nightly' ? 'Check-in' : 'Start'}
                          <input
                            type="date"
                            min={new Date().toISOString().slice(0, 10)}
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="mt-0.5 w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:border-slate-400"
                          />
                        </label>
                        {unitType === 'hourly' && (
                          <label className="text-[11px] text-slate-600">
                            From
                            <input
                              type="time"
                              step={1800}
                              value={startTime}
                              onChange={(e) => setStartTime(e.target.value)}
                              className="mt-0.5 w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:border-slate-400"
                            />
                          </label>
                        )}
                        <label className="text-[11px] text-slate-600">
                          {UNIT_LABEL[unitType]?.[1].replace(/^./, (c) => c.toUpperCase())}
                          <input
                            type="number"
                            min={1}
                            max={maxQuantity}
                            value={quantity}
                            onChange={(e) => setQuantity(Math.min(maxQuantity, Math.max(1, Number(e.target.value) || 1)))}
                            className="mt-0.5 w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:border-slate-400"
                          />
                        </label>
                      </div>
                      {bookingWindow && (
                        <div className="text-xs text-slate-600 space-y-1 pt-1 border-t border-slate-100">
                          <div className="flex justify-between">
                            <span>
                              {pluralUnit(unitType, quantity)} × {formatCurrency(selectedTier.priceInCents, selectedTier.currency)}
                            </span>
                            <span className="font-semibold text-slate-900">{formatCurrency(bookingWindow.rental, selectedTier.currency)}</span>
                          </div>
                          {listing.depositRequiredInCents > 0 && (
                            <div className="flex justify-between">
                              <span>Refundable deposit</span>
                              <span>{formatCurrency(listing.depositRequiredInCents)}</span>
                            </div>
                          )}
                          <p className="text-[10px] text-slate-400">
                            Until {bookingWindow.end.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    id="modal-confirm-subscribe-btn"
                    type="button"
                    onClick={handlePrimary}
                    disabled={isWorking || (!!currentUserId && !isBookable && isFull)}
                    className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-xs transition-all bg-slate-900 hover:bg-slate-800 hover:shadow-md disabled:bg-slate-400 disabled:cursor-not-allowed"
                  >
                    {isWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    <span>{primaryLabel}</span>
                    {!isWorking && <ArrowRight className="w-4 h-4" />}
                  </button>

                  <p className="text-[10px] text-center text-slate-500">
                    {isBookable
                      ? "You'll confirm payment on the next step. Your deposit comes back when you return the item."
                      : selectedTier?.type === 'monthly_subscription'
                      ? 'Your turns refresh at the start of every month.'
                      : 'A one-off pack of turns to use whenever you like.'}
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
