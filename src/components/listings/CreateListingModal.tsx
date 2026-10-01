import React, { useRef, useState } from 'react';
import { X, Plus, Trash2, Zap, BedDouble, Wrench, CheckCircle2, AlertCircle, UploadCloud, Loader2, Lock, Camera } from 'lucide-react';
import { ListingCategory, ListingModel, PricingType, TrustGroupModel } from '../../types';
import { prepareImage } from '../../lib/images';
import { api } from '../../api/client';
import { cn } from '../../lib/utils';

export interface CreateListingModalProps {
  /** Circles the host belongs to; a listing can be limited to one of them. */
  circles: TrustGroupModel[];
  onClose: () => void;
  onCreate: (listing: ListingModel) => void;
}

const CATEGORIES: { id: ListingCategory; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: 'physical_item', label: 'Tools & gear', hint: 'Drills, saws, roof boxes, camping kit', icon: <Wrench className="w-3.5 h-3.5 text-indigo-400" /> },
  { id: 'room', label: 'A space', hint: 'Studio, workshop, garage, spare room', icon: <BedDouble className="w-3.5 h-3.5 text-emerald-400" /> },
  { id: 'fractional_appliance', label: 'Shared appliance', hint: 'Washer, 3D printer, solar battery', icon: <Zap className="w-3.5 h-3.5 text-amber-400" /> },
];

const RATE_OPTIONS: Record<ListingCategory, { type: PricingType; label: string }[]> = {
  physical_item: [
    { type: 'daily', label: 'per day' },
    { type: 'hourly', label: 'per hour' },
  ],
  room: [
    { type: 'hourly', label: 'per hour' },
    { type: 'daily', label: 'per day' },
    { type: 'nightly', label: 'per night' },
  ],
  fractional_appliance: [{ type: 'monthly_subscription', label: 'per month' }],
};

const DEFAULT_DEPOSIT_RANDS: Record<ListingCategory, number> = { physical_item: 500, room: 500, fractional_appliance: 200 };

const fieldClass = 'w-full px-3.5 py-2.5 text-sm bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:border-slate-400 outline-none';

export const CreateListingModal: React.FC<CreateListingModalProps> = ({ circles, onClose, onCreate }) => {
  const [category, setCategory] = useState<ListingCategory>('physical_item');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('Cape Town');
  const [images, setImages] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [rateType, setRateType] = useState<PricingType>('daily');
  const [price, setPrice] = useState(150);
  const [deposit, setDeposit] = useState(DEFAULT_DEPOSIT_RANDS.physical_item);
  const [maxHouseholds, setMaxHouseholds] = useState(4);
  const [turnsPerMonth, setTurnsPerMonth] = useState(10);
  const [rules, setRules] = useState('');
  const [circleId, setCircleId] = useState('public');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const chooseCategory = (next: ListingCategory) => {
    setCategory(next);
    setRateType(RATE_OPTIONS[next][0].type);
    setDeposit(DEFAULT_DEPOSIT_RANDS[next]);
    setPrice(next === 'fractional_appliance' ? 450 : 150);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      const result = await prepareImage(file);
      if (result.success === true) setImages((prev) => [...prev, result.dataUrl]);
      else setError(result.error);
    } finally {
      setIsUploading(false);
    }
  };

  const addImageUrl = () => {
    const url = imageUrl.trim();
    if (!url) return;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') throw new Error();
      setImages((prev) => [...prev, url]);
      setImageUrl('');
      setError(null);
    } catch {
      setError('Please paste a full image link starting with https://');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (price <= 0) {
      setError('Please set a price.');
      return;
    }
    setIsSubmitting(true);
    const isCoop = category === 'fractional_appliance';
    const rateLabel = RATE_OPTIONS[category].find((r) => r.type === rateType)?.label ?? '';
    try {
      const listing = await api.createListing({
        title: title.trim(),
        description: description.trim(),
        category,
        address,
        neighborhood,
        city,
        images,
        rules: rules.trim() || undefined,
        depositRequiredInCents: Math.max(0, Math.round(deposit * 100)),
        maxSubscribers: isCoop ? maxHouseholds : 1,
        accessMethod: isCoop ? 'pin_code' : category === 'room' ? 'pin_code' : 'host_handover',
        visibilityGroupId: circleId !== 'public' ? circleId : null,
        pricingTiers: [
          {
            name: isCoop ? `${turnsPerMonth} turns a month` : `Rate ${rateLabel}`,
            type: rateType,
            priceInCents: Math.round(price * 100),
            currency: 'ZAR',
            usageLimitPerPeriod: isCoop ? turnsPerMonth : null,
            periodUnit: isCoop ? 'month' : rateType === 'hourly' ? 'hour' : 'day',
            periodDuration: 1,
            isActive: true,
          },
        ],
      });

      onCreate(listing);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'We could not publish your listing. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCoop = category === 'fractional_appliance';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-title"
        className="relative w-full max-w-xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-white">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 id="create-title" className="text-sm font-bold text-slate-900">
                Share something
              </h2>
              <p className="text-[11px] text-slate-500">Earn from the things you already own</p>
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <fieldset>
            <legend className="text-xs font-semibold text-slate-800 mb-1.5">What are you sharing?</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={category === c.id}
                  onClick={() => chooseCategory(c.id)}
                  className={cn(
                    'p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer',
                    category === c.id ? 'bg-slate-900 text-white border-slate-900 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'
                  )}
                >
                  <span className={cn('flex items-center gap-1.5 font-bold text-xs', category === c.id ? 'text-white' : 'text-slate-900')}>
                    {c.icon}
                    {c.label}
                  </span>
                  <span className={cn('text-[10px]', category === c.id ? 'text-slate-300' : 'text-slate-500')}>{c.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-xs font-semibold text-slate-800 block mb-1">Title</span>
            <input
              type="text"
              required
              minLength={3}
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isCoop ? 'e.g. Shared washing machine, Block C laundry' : category === 'room' ? 'e.g. Sunny podcast studio' : 'e.g. Bosch hammer drill with bits'}
              className={fieldClass}
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-800 block mb-1">Description</span>
            <textarea
              required
              minLength={10}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's included, what condition it's in, and anything a borrower should know."
              className={fieldClass}
            />
          </label>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-900 block">Photos</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-xl p-3.5 text-center bg-white cursor-pointer transition-colors flex flex-col items-center gap-1"
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <UploadCloud className="w-4 h-4 text-indigo-600" />}
                <span className="text-[11px] font-bold text-slate-800">{isUploading ? 'Adding…' : 'Upload a photo'}</span>
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-xl p-3.5 text-center bg-white cursor-pointer transition-colors flex flex-col items-center gap-1"
              >
                <Camera className="w-4 h-4 text-emerald-600" />
                <span className="text-[11px] font-bold text-slate-800">Take a photo</span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={handleFile} className="hidden" />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
            </div>

            <div className="flex gap-2">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="…or paste an image link"
                aria-label="Image link"
                className="flex-1 min-w-0 px-3 py-1.5 text-xs bg-white rounded-xl border border-slate-200 outline-none"
              />
              <button type="button" onClick={addImageUrl} className="px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-200 hover:bg-slate-300 rounded-xl transition-colors cursor-pointer">
                Add
              </button>
            </div>

            {images.length > 0 ? (
              <div className="grid grid-cols-4 gap-2 pt-1">
                {images.map((img, idx) => (
                  <div key={idx} className="relative rounded-xl overflow-hidden aspect-video border border-slate-200 bg-slate-100">
                    <img src={img} alt={`Photo ${idx + 1}`} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      aria-label={`Remove photo ${idx + 1}`}
                      onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 p-1 rounded-md bg-black/70 hover:bg-rose-600 text-white transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">Listings with clear photos get booked far more often.</p>
            )}
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-800 block mb-1">
                Street address <span className="font-normal text-slate-400">(only shared once someone books)</span>
              </span>
              <input type="text" required autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 Main Road" className={fieldClass} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-800 block mb-1">Neighbourhood</span>
                <input type="text" required value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Observatory" className={fieldClass} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-800 block mb-1">City</span>
                <input type="text" required value={city} onChange={(e) => setCity(e.target.value)} className={fieldClass} />
              </label>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-900 block">Pricing</span>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] font-semibold text-slate-700 block mb-1">Price</span>
                <span className="relative block">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R</span>
                  <input
                    type="number"
                    min={1}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-2 text-sm bg-white rounded-xl border border-slate-200 outline-none font-semibold"
                  />
                </span>
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-slate-700 block mb-1">Charged</span>
                <select
                  value={rateType}
                  onChange={(e) => setRateType(e.target.value as PricingType)}
                  disabled={RATE_OPTIONS[category].length === 1}
                  className="w-full px-3 py-2 text-sm bg-white rounded-xl border border-slate-200 outline-none cursor-pointer disabled:cursor-default"
                >
                  {RATE_OPTIONS[category].map((r) => (
                    <option key={r.type} value={r.type}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {isCoop && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] font-semibold text-slate-700 block mb-1">Households sharing</span>
                  <input
                    type="number"
                    min={2}
                    max={10}
                    value={maxHouseholds}
                    onChange={(e) => setMaxHouseholds(Math.min(10, Math.max(2, Number(e.target.value) || 2)))}
                    className="w-full px-3 py-2 text-sm bg-white rounded-xl border border-slate-200 outline-none"
                  />
                  <span className="text-[10px] text-slate-500">3–4 keeps waits short</span>
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold text-slate-700 block mb-1">Turns each per month</span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={turnsPerMonth}
                    onChange={(e) => setTurnsPerMonth(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-full px-3 py-2 text-sm bg-white rounded-xl border border-slate-200 outline-none"
                  />
                </label>
              </div>
            )}

            <label className="block">
              <span className="text-[11px] font-semibold text-slate-700 block mb-1">Refundable deposit</span>
              <span className="relative block">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R</span>
                <input
                  type="number"
                  min={0}
                  value={deposit}
                  onChange={(e) => setDeposit(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full pl-7 pr-3 py-2 text-sm bg-white rounded-xl border border-slate-200 outline-none"
                />
              </span>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-slate-800 block mb-1">
              House rules <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <input type="text" value={rules} onChange={(e) => setRules(e.target.value)} placeholder="e.g. Please return it clean and charged." className={fieldClass} />
          </label>

          <label className="block p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-600" />
              Who can see this?
            </span>
            <select
              value={circleId}
              onChange={(e) => setCircleId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white rounded-xl border border-slate-200 outline-none font-medium text-slate-800 cursor-pointer"
            >
              <option value="public">Everyone on ShareHub</option>
              {circles.map((c) => (
                <option key={c.id} value={c.id}>
                  Only members of {c.name}
                </option>
              ))}
            </select>
            {circles.length === 0 && (
              <span className="text-[11px] text-slate-500 block">Join or start a circle to share privately with people you know.</span>
            )}
          </label>

          <button
            type="submit"
            disabled={isSubmitting || isUploading}
            className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            <span>{isSubmitting ? 'Publishing…' : 'Publish listing'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
