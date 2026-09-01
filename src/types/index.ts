export type ListingCategory = 'room' | 'physical_item' | 'fractional_appliance';

export type PricingType =
  | 'nightly'
  | 'hourly'
  | 'daily'
  | 'monthly_subscription'
  | 'usage_pack';

export interface CategoryModel {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  icon?: string | null;
  description?: string | null;
  itemCount?: number;
  subcategories?: CategoryModel[];
}

export interface PricingTierModel {
  id: string;
  listingId: string;
  name: string;
  description?: string;
  type: PricingType;
  priceInCents: number;
  currency: string;
  usageLimitPerPeriod?: number | null; // e.g. 10 uses
  periodUnit: 'hour' | 'day' | 'month' | 'year' | 'one_time';
  periodDuration: number;
  maxActiveSubscribers?: number | null;
  isPopular?: boolean;
  isActive: boolean;
}

export interface ListingModel {
  id: string;
  title: string;
  description: string;
  category: ListingCategory;
  categoryId?: string | null;
  categorySlug?: string | null;
  owner: {
    id: string;
    name: string;
    image: string;
    trustScore: number;
    neighborhood: string;
    isSuperHost?: boolean;
  };
  address: string;
  neighborhood: string;
  city: string;
  
  // Geolocation & PostGIS Coordinates
  latitude?: number | string | null;
  longitude?: number | string | null;
  distanceKm?: number | null; // Computed by PostGIS ST_Distance or Haversine
  formattedDistance?: string | null; // e.g. "1.8 km away"
  isDistanceApproximate?: boolean; // Privacy shield for non-booked listings

  images: string[];
  rules?: string;
  depositRequiredInCents: number;
  
  // Visibility & Private Trust Groups
  visibilityGroupId?: string | null;
  visibilityGroupName?: string | null;

  // Fractional sharing & capacity
  maxSubscribers: number; // e.g., 4 slots for washing machine
  currentSubscribersCount: number; // e.g., 3 filled
  isAvailable: boolean;
  accessMethod: 'pin_code' | 'qr_code' | 'host_handover' | 'smart_plug';
  
  // Room / Specs specific attributes
  specs?: {
    bedrooms?: number;
    bathrooms?: number;
    maxGuests?: number;
    brand?: string;
    model?: string;
    powerRating?: string;
    warrantyStatus?: string;
  };
  amenities: string[];
  pricingTiers: PricingTierModel[];
  rating?: number;
  reviewCount?: number;
  createdAt?: string;
}

export interface GeospatialSearchParams {
  categoryId?: string;
  categorySlug?: string;
  searchTerm?: string;
  latitude?: number | null;
  longitude?: number | null;
  radiusInKm?: number;
  city?: string;
  pricingType?: 'all' | PricingType;
  availableOnly?: boolean;
  visibilityGroupId?: string;
  userMemberGroupIds?: string[];
  includePrivateGroups?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchResultModel {
  listings: ListingModel[];
  totalCount: number;
  userLocation?: {
    latitude: number;
    longitude: number;
    neighborhood?: string;
    city?: string;
  } | null;
  appliedRadiusKm: number;
  executionTimeMs?: number;
}

export interface UserSubscriptionModel {
  id: string;
  userId: string;
  listingId: string;
  listing: ListingModel;
  pricingTierId: string;
  pricingTier: PricingTierModel;
  status: 'active' | 'paused' | 'expired' | 'cancelled';
  remainingUsesThisPeriod: number;
  totalUsesUsed: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  accessKeyOrCode: string;
}

export interface UsageLogModel {
  id: string;
  subscriptionId: string;
  listingId: string;
  listingTitle: string;
  userId: string;
  userName: string;
  startedAt: string;
  unitsUsed: number;
  status: 'completed' | 'in_progress' | 'flagged';
  notes?: string;
  verificationCode?: string;
}

export type UserRole = 'USER' | 'VERIFIED_HOST' | 'ADMIN';

export interface UserModel {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  image?: string | null;
  phoneNumber?: string | null;
  bio?: string | null;
  neighborhood?: string | null;
  trustScore: number;
  isHost: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthSession {
  user: UserModel | null;
  token?: string | null;
  expiresAt?: string | null;
}

export interface SignedUploadUrlRequest {
  filename: string;
  contentType: string;
  fileSizeBytes: number;
  listingId?: string;
}

export interface SignedUploadUrlResponse {
  success: boolean;
  uploadUrl: string;
  publicUrl: string;
  key: string;
  headers?: Record<string, string>;
  expiresInSeconds: number;
  error?: string;
}

export type SystemEventType =
  | 'BOOKING_CREATED'
  | 'HANDOVER_COMPLETED'
  | 'FRACTIONAL_USE_LOGGED'
  | 'PAYMENT_HELD'
  | 'PAYMENT_CAPTURED'
  | 'PAYMENT_REFUNDED'
  | 'CONDITION_LOGGED'
  | 'DISPUTE_RAISED'
  | 'DISPUTE_RESOLVED'
  | 'GROUP_CREATED'
  | 'GROUP_JOINED'
  | 'MESSAGE_SENT'
  | 'REVIEW_SUBMITTED'
  | 'LISTING_CREATED'
  | 'AUTH_SIGNIN'
  | 'AUTH_SIGNUP'
  | 'IMAGE_UPLOADED'
  | 'CRON_EXECUTION_COMPLETED';

export interface SystemLogModel {
  id: string;
  eventType: SystemEventType;
  userId: string;
  targetId: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export type PaymentStatus = 'PENDING' | 'HELD_IN_ESCROW' | 'CAPTURED' | 'REFUNDED' | 'FROZEN_ESCROW';

export interface PaymentModel {
  id: string;
  bookingId: string;
  amount: number; // in cents
  currency: string;
  status: PaymentStatus;
  paymentGatewayRef?: string | null;
  escrowReleasedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export type ConditionLogType = 'PICKUP' | 'RETURN';
export type ItemConditionStatus = 'GOOD' | 'MINOR_WEAR' | 'DAMAGED';
export type DisputeStatus = 'NONE' | 'PENDING_REVIEW' | 'RESOLVED';

export interface ConditionLogModel {
  id: string;
  bookingId: string;
  type: ConditionLogType;
  conditionStatus: ItemConditionStatus;
  notes?: string | null;
  imageUrls: string[];
  reportedBy: string;
  reporterName?: string;
  createdAt: string;
}

export interface TrustGroupModel {
  id: string;
  name: string;
  description?: string | null;
  inviteCode: string;
  adminId: string;
  adminName?: string;
  icon?: string | null;
  memberCount: number;
  isCurrentUserMember?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface GroupMembershipModel {
  id: string;
  groupId: string;
  groupName?: string;
  userId: string;
  userName?: string;
  status: 'PENDING' | 'ACTIVE' | 'BANNED';
  joinedAt: string;
}

export interface MessageModel {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  senderImage?: string;
  senderRole?: UserRole;
  content: string;
  readAt?: string | null;
  createdAt: string;
  isOutgoing?: boolean;
}

export interface ConversationModel {
  id: string;
  listingId: string;
  listingTitle?: string;
  listingImage?: string;
  listingPriceInCents?: number;
  renterId: string;
  renterName?: string;
  renterImage?: string;
  hostId: string;
  hostName?: string;
  hostImage?: string;
  lastMessage?: string;
  lastMessageAt: string;
  unreadCount?: number;
  createdAt: string;
}

export interface ReviewModel {
  id: string;
  bookingId: string;
  reviewerId: string;
  reviewerName?: string;
  reviewerImage?: string;
  targetId: string;
  targetName?: string;
  listingId?: string | null;
  listingTitle?: string;
  rating: number; // 1-5
  comment: string;
  cleanlinessRating?: number | null;
  communicationRating?: number | null;
  accuracyRating?: number | null;
  createdAt: string;
}

export interface BookingModel {
  id: string;
  listingId: string;
  listingTitle: string;
  listingImage?: string;
  renterId: string;
  renterName: string;
  status: 'PENDING_PAYMENT' | 'PENDING_HANDOVER' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  disputeStatus: DisputeStatus;
  verificationCode: string;
  totalAmountInCents: number;
  depositAmountInCents: number;
  startDate: string;
  endDate: string;
  handoverCompletedAt?: string | null;
  handoverNotes?: string | null;
  returnConditionLogId?: string | null;
  conditionLogs?: ConditionLogModel[];
  payment?: PaymentModel | null;
  hasReview?: boolean;
}

export interface FilterState {
  category: 'all' | ListingCategory;
  searchQuery: string;
  city: string;
  maxPrice: number;
  pricingType: 'all' | PricingType;
  availableOnly: boolean;
}

/**
 * ============================================================================
 * EXECUTIVE ADMIN INTELLIGENCE INTERFACES
 * ============================================================================
 */
export interface ExecutiveKPIs {
  totalGMVZAR: number;
  gmvGrowthPct: number;
  activeSubscriptionsCount: number;
  fractionalUtilizationRate: number; // e.g. 84.5%
  totalUsersCount: number;
  verifiedHostRatio: number; // e.g. 42%
  completedHandoversCount: number;
  activeDisputesCount: number;
  disputeRate: number; // e.g. 0.3%
  averageTrustScore: number;
}

export interface CategoryPerformanceData {
  categoryId: string;
  categoryName: string;
  revenueZAR: number;
  bookingCount: number;
  activeListingsCount: number;
  subscriberCount: number;
  avgTicketZAR: number;
}

export interface RentalVelocityItem {
  id: string;
  title: string;
  category: ListingCategory;
  categoryName: string;
  neighborhood: string;
  ownerName: string;
  totalBookings: number;
  utilizationRatePct: number;
  totalRevenueZAR: number;
  avgTurnaroundHours: number;
  rating: number;
  status: 'high_velocity' | 'steady' | 'underutilized';
}

export interface GeospatialDensityData {
  zone: string;
  neighborhood: string;
  activeListings: number;
  totalBookings: number;
  searchDemandCount: number;
  supplyDemandRatio: number;
  status: 'deficit' | 'balanced' | 'surplus';
  topMissingCategory: string;
}

export interface FractionalApplianceTelemetry {
  listingId: string;
  title: string;
  hostName: string;
  neighborhood: string;
  activeSubscribers: number;
  maxCapacity: number;
  cyclesLoggedThisMonth: number;
  remainingQuotaThisMonth: number;
  wearTearPct: number; // e.g. 74%
  estimatedLifespanRemainingCycles: number;
  maintenanceStatus: 'healthy' | 'maintenance_due' | 'inspection_required';
  lastCycleAt: string;
}

export interface AdminAnalyticsReport {
  kpis: ExecutiveKPIs;
  categoryPerformance: CategoryPerformanceData[];
  rentalVelocity: RentalVelocityItem[];
  geospatialDemand: GeospatialDensityData[];
  fractionalTelemetry: FractionalApplianceTelemetry[];
  recentSystemLogs: SystemLogModel[];
  generatedAt: string;
}
