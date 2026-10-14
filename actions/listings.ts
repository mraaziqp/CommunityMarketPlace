
import { memoryStore } from '../db';
import * as schema from '../db/schema';
import { validateInput, CreateListingSchema } from '../lib/validations';
import {
  ListingCategory,
  ListingModel,
  PricingTierModel,
  PricingType,
  GeospatialSearchParams,
} from '../src/types';
import { INITIAL_LISTINGS } from '../src/data/mockListings';

export interface CreateListingInput {
  title: string;
  description: string;
  category: ListingCategory;
  categoryId?: string;
  categorySlug?: string;
  ownerId?: string;
  address: string;
  neighborhood: string;
  city: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  images: string[];
  rules?: string;
  depositRequiredInCents?: number;
  maxSubscribers?: number;
  accessMethod?: 'pin_code' | 'qr_code' | 'host_handover' | 'smart_plug';
  visibilityGroupId?: string | null;
  visibilityGroupName?: string | null;
  specs?: {
    brand?: string;
    model?: string;
    powerRating?: string;
    warrantyStatus?: string;
    bedrooms?: number;
    bathrooms?: number;
    maxGuests?: number;
  };
  amenities?: string[];
  pricingTiers?: Array<{
    id?: string;
    name: string;
    description?: string;
    type: PricingType;
    priceInCents: number;
    currency?: string;
    usageLimitPerPeriod?: number | null;
    periodUnit?: 'hour' | 'day' | 'month' | 'year' | 'one_time';
    periodDuration?: number;
    maxActiveSubscribers?: number | null;
    isPopular?: boolean;
    isActive?: boolean;
  }>;
}

export interface CreateListingResult {
  success: boolean;
  listing?: ListingModel;
  systemLog?: {
    id: string;
    eventType: string;
    userId: string;
    targetId: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  };
  error?: string;
}

/**
 * ============================================================================
 * SERVER ACTION: createListing
 * Inserts a new listing and its associated pricing tier(s) into Neon PostgreSQL.
 * Writes an immutable LISTING_CREATED event to SystemLogs.
 * ============================================================================
 */
export async function createListing(input: CreateListingInput): Promise<CreateListingResult> {
  try {
    // 1. Zod Schema Validation
    const validated = validateInput(CreateListingSchema, {
      ...input,
      images: input.images && input.images.length > 0 ? input.images : ['https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=800'],
    });

    const {
      title,
      description,
      category,
      categoryId,
      ownerId,
      address,
      neighborhood,
      city,
      latitude,
      longitude,
      images = [],
      rules = '',
      depositRequiredInCents = category === 'fractional_appliance' ? 20000 : 50000,
      maxSubscribers = category === 'fractional_appliance' ? 4 : 1,
      accessMethod = category === 'fractional_appliance' ? 'smart_plug' : 'pin_code',
      visibilityGroupId = null,
      pricingTiers = [],
    } = { ...input, ...validated };

    const listingId = `list_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    const cleanImages =
      images.length > 0
        ? images
        : ['https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=800'];

    // 1. The host must be a signed-in member.
    const ownerUser = ownerId ? memoryStore.users.get(ownerId) : undefined;
    if (!ownerUser) {
      return { success: false, error: 'Please sign in to share an item.' };
    }
    if (!ownerUser.isHost) {
      memoryStore.users.set(ownerUser.id, { ...ownerUser, isHost: true, updatedAt: now });
    }
    if (visibilityGroupId) {
      const isMember = Array.from(memoryStore.groupMemberships.values()).some(
        (m) => m.groupId === visibilityGroupId && m.userId === ownerUser.id && m.status === 'ACTIVE'
      );
      if (!isMember) {
        return { success: false, error: 'You can only share privately with circles you belong to.' };
      }
    }

    // 2. Prepare listing record
    const newListingRecord: schema.Listing = {
      id: listingId,
      title: title.trim(),
      description: description.trim(),
      category: category as any,
      categoryId: categoryId || null,
      ownerId: ownerUser.id,
      address: address.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      latitude: latitude != null && latitude !== '' ? String(latitude) : null,
      longitude: longitude != null && longitude !== '' ? String(longitude) : null,
      images: cleanImages,
      rules: rules?.trim() || null,
      depositRequiredInCents,
      maxSubscribers,
      currentSubscribersCount: 0,
      isAvailable: true,
      visibilityGroupId: visibilityGroupId || null,
      accessMethod: accessMethod || 'pin_code',
      createdAt: now,
      updatedAt: now,
    };

    // 3. Prepare pricing tiers
    const rawTiers =
      pricingTiers.length > 0
        ? pricingTiers
        : [
            {
              name: category === 'fractional_appliance' ? 'Co-Op Monthly (10 Uses)' : 'Standard Day Pass',
              type: (category === 'fractional_appliance' ? 'monthly_subscription' : 'daily') as PricingType,
              priceInCents: category === 'fractional_appliance' ? 45000 : 15000,
              currency: 'ZAR',
              usageLimitPerPeriod: category === 'fractional_appliance' ? 10 : null,
              periodUnit: (category === 'fractional_appliance' ? 'month' : 'day') as any,
              periodDuration: 1,
              maxActiveSubscribers: maxSubscribers,
              isPopular: true,
              isActive: true,
            },
          ];

    const insertedTiers: PricingTierModel[] = rawTiers.map((t, idx) => {
      const tierId = t.id || `tier_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
      return {
        id: tierId,
        listingId,
        name: t.name,
        description: t.description,
        type: t.type,
        priceInCents: t.priceInCents,
        currency: t.currency || 'ZAR',
        usageLimitPerPeriod: t.usageLimitPerPeriod ?? null,
        periodUnit: (t.periodUnit || (t.type === 'monthly_subscription' ? 'month' : 'day')) as any,
        periodDuration: t.periodDuration || 1,
        maxActiveSubscribers: t.maxActiveSubscribers ?? maxSubscribers,
        isPopular: t.isPopular ?? idx === 0,
        isActive: t.isActive ?? true,
      };
    });

    // 4. Save the listing and its tiers
    memoryStore.listings.set(listingId, newListingRecord);
    for (const tier of insertedTiers) {
      memoryStore.pricingTiers.set(tier.id, {
        id: tier.id,
        listingId: tier.listingId,
        name: tier.name,
        description: tier.description || null,
        type: tier.type as any,
        priceInCents: tier.priceInCents,
        currency: tier.currency,
        usageLimitPerPeriod: tier.usageLimitPerPeriod || null,
        periodUnit: tier.periodUnit as any,
        periodDuration: tier.periodDuration,
        maxActiveSubscribers: tier.maxActiveSubscribers || null,
        isPopular: tier.isPopular || false,
        isActive: tier.isActive,
        createdAt: now,
      });
    }

    // 5. Insert immutable audit event into SystemLogs
    const systemLogId = `sys_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const systemLogRecord: schema.SystemLog = {
      id: systemLogId,
      eventType: 'LISTING_CREATED',
      userId: ownerUser.id,
      targetId: listingId,
      metadata: {
        action: 'LISTING_CREATED_PIPELINE',
        listingId,
        title: newListingRecord.title,
        category: newListingRecord.category,
        neighborhood: newListingRecord.neighborhood,
        city: newListingRecord.city,
        imageCount: cleanImages.length,
        pricingTiersCount: insertedTiers.length,
        firstTierPriceInCents: insertedTiers[0]?.priceInCents,
        maxSubscribers: newListingRecord.maxSubscribers,
        depositRequiredInCents: newListingRecord.depositRequiredInCents,
        createdAtIso: now.toISOString(),
      },
      createdAt: now,
    };

    memoryStore.systemLogs.set(systemLogId, systemLogRecord);

    return {
      success: true,
      listing: toListingModel(newListingRecord),
      systemLog: {
        id: systemLogRecord.id,
        eventType: systemLogRecord.eventType,
        userId: systemLogRecord.userId,
        targetId: systemLogRecord.targetId,
        metadata: systemLogRecord.metadata as Record<string, unknown>,
        createdAt: systemLogRecord.createdAt.toISOString(),
      },
    };
  } catch (error: any) {
    console.error('Failed to create listing:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred while saving the listing.',
    };
  }
}

/**
 * ============================================================================
 * LISTING READS
 * The store is the single source of truth. Catalogue listings carry extra
 * detail (specs, amenities, historical rating) that the store schema has no
 * columns for, so that is merged back in from the catalogue by id.
 * ============================================================================
 */

const FALLBACK_LISTING_IMAGE = 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=800';
const FALLBACK_AVATAR = 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=150&auto=format&fit=crop&q=80';

/**
 * Rating for a listing: the catalogue's historical reviews combined with any
 * reviews left through ShareHub. Listings with no reviews have no rating.
 */
export function getListingRating(listingId: string): { rating: number | undefined; reviewCount: number } {
  const catalogue = INITIAL_LISTINGS.find((l) => l.id === listingId);
  let total = (catalogue?.rating ?? 0) * (catalogue?.reviewCount ?? 0);
  let count = catalogue?.reviewCount ?? 0;
  for (const review of memoryStore.reviews.values()) {
    if (review.listingId === listingId) {
      total += review.rating;
      count++;
    }
  }
  return { rating: count > 0 ? Math.round((total / count) * 100) / 100 : undefined, reviewCount: count };
}

function toPricingTierModel(t: schema.PricingTier): PricingTierModel {
  return {
    id: t.id,
    listingId: t.listingId,
    name: t.name,
    description: t.description || undefined,
    type: t.type as PricingType,
    priceInCents: t.priceInCents,
    currency: t.currency,
    usageLimitPerPeriod: t.usageLimitPerPeriod,
    periodUnit: t.periodUnit as PricingTierModel['periodUnit'],
    periodDuration: t.periodDuration,
    maxActiveSubscribers: t.maxActiveSubscribers,
    isPopular: t.isPopular,
    isActive: t.isActive,
  };
}

/** Maps a stored listing row to the model the UI renders. */
export function toListingModel(row: schema.Listing): ListingModel {
  const catalogue = INITIAL_LISTINGS.find((l) => l.id === row.id);
  const owner = memoryStore.users.get(row.ownerId);
  const group = row.visibilityGroupId ? memoryStore.trustGroups.get(row.visibilityGroupId) : undefined;
  const { rating, reviewCount } = getListingRating(row.id);

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category as ListingCategory,
    categoryId: row.categoryId,
    categorySlug: catalogue?.categorySlug,
    owner: {
      id: row.ownerId,
      name: owner?.name ?? 'ShareHub member',
      image: owner?.image || FALLBACK_AVATAR,
      trustScore: owner?.trustScore ?? 90,
      neighborhood: `${row.neighborhood}, ${row.city}`,
      isSuperHost: owner?.role === 'VERIFIED_HOST',
    },
    address: row.address,
    neighborhood: row.neighborhood,
    city: row.city,
    latitude: row.latitude ? parseFloat(row.latitude) : null,
    longitude: row.longitude ? parseFloat(row.longitude) : null,
    images: Array.isArray(row.images) && row.images.length > 0 ? row.images : [FALLBACK_LISTING_IMAGE],
    rules: row.rules || undefined,
    depositRequiredInCents: row.depositRequiredInCents,
    visibilityGroupId: row.visibilityGroupId,
    visibilityGroupName: group?.name ?? null,
    maxSubscribers: row.maxSubscribers,
    currentSubscribersCount: row.currentSubscribersCount,
    isAvailable: row.isAvailable,
    accessMethod: row.accessMethod as ListingModel['accessMethod'],
    specs: catalogue?.specs,
    amenities: catalogue?.amenities ?? [],
    pricingTiers: Array.from(memoryStore.pricingTiers.values())
      .filter((t) => t.listingId === row.id && t.isActive)
      .map(toPricingTierModel),
    rating,
    reviewCount,
    createdAt: row.createdAt.toISOString(),
  };
}

/** All available listings. Filtering, visibility and distance are applied by searchListings. */
export async function getListings(_params: GeospatialSearchParams = {}): Promise<ListingModel[]> {
  return Array.from(memoryStore.listings.values())
    .filter((row) => row.isAvailable !== false && !memoryStore.users.get(row.ownerId)?.suspendedAt)
    .map(toListingModel);
}

export async function getListingById(id: string): Promise<ListingModel | null> {
  const row = id ? memoryStore.listings.get(id) : undefined;
  return row ? toListingModel(row) : null;
}
