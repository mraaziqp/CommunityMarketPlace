import { relations } from 'drizzle-orm';
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * ============================================================================
 * POSTGIS GEOMETRY POINT CUSTOM TYPE (SRID 4326)
 * Supports ST_DWithin, ST_Distance, and ST_MakePoint spatial queries on Neon
 * ============================================================================
 */
export const pointGeometry = customType<{
  data: { longitude: number; latitude: number } | string;
  driverData: string;
}>({
  dataType() {
    return 'geometry(Point, 4326)';
  },
  toDriver(value) {
    if (typeof value === 'string') return value;
    return `SRID=4326;POINT(${value.longitude} ${value.latitude})`;
  },
  fromDriver(value: string) {
    if (!value) return { longitude: 0, latitude: 0 };
    const match = value.match(/POINT\(([-\d\.]+)\s+([-\d\.]+)\)/i);
    if (match) {
      return { longitude: parseFloat(match[1]), latitude: parseFloat(match[2]) };
    }
    return { longitude: 0, latitude: 0 };
  },
});

/**
 * ============================================================================
 * RAW SQL MIGRATION FOR NEON POSTGRESQL (POSTGIS EXTENSION)
 *
 * Execute in your Neon SQL console / migration runner:
 *
 * CREATE EXTENSION IF NOT EXISTS postgis;
 *
 * -- Spatial GIST index for fast O(log N) proximity search:
 * CREATE INDEX IF NOT EXISTS idx_listings_location_gist ON listings USING GIST (location);
 * CREATE INDEX IF NOT EXISTS idx_listings_category_id ON listings(category_id);
 * CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
 * CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
 * ============================================================================
 */

/**
 * ============================================================================
 * ENUMS
 * ============================================================================
 */
export const userRoleEnum = pgEnum('user_role', [
  'USER',
  'VERIFIED_HOST',
  'ADMIN',
]);

export const listingCategoryEnum = pgEnum('listing_category', [
  'room',
  'physical_item',
  'fractional_appliance',
]);

export const pricingTypeEnum = pgEnum('pricing_type', [
  'nightly',
  'hourly',
  'daily',
  'monthly_subscription',
  'usage_pack',
]);

export const periodUnitEnum = pgEnum('period_unit', [
  'hour',
  'day',
  'month',
  'year',
  'one_time',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'paused',
  'expired',
  'cancelled',
  'past_due',
]);

export const usageStatusEnum = pgEnum('usage_status', [
  'completed',
  'in_progress',
  'flagged',
  'cancelled',
]);

export const bookingStatusEnum = pgEnum('booking_status', [
  'PENDING_PAYMENT',
  'PENDING_HANDOVER',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
]);

export const disputeStatusEnum = pgEnum('dispute_status', [
  'NONE',
  'PENDING_REVIEW',
  'RESOLVED',
]);

export const conditionLogTypeEnum = pgEnum('condition_log_type', [
  'PICKUP',
  'RETURN',
]);

export const conditionStatusEnum = pgEnum('condition_status', [
  'GOOD',
  'MINOR_WEAR',
  'DAMAGED',
]);

export const groupMembershipStatusEnum = pgEnum('group_membership_status', [
  'PENDING',
  'ACTIVE',
  'BANNED',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'PENDING',
  'HELD_IN_ESCROW',
  'CAPTURED',
  'REFUNDED',
  'FROZEN_ESCROW',
]);

export const systemEventTypeEnum = pgEnum('system_event_type', [
  'BOOKING_CREATED',
  'HANDOVER_COMPLETED',
  'FRACTIONAL_USE_LOGGED',
  'PAYMENT_HELD',
  'PAYMENT_CAPTURED',
  'PAYMENT_REFUNDED',
  'MESSAGE_SENT',
  'REVIEW_SUBMITTED',
  'LISTING_CREATED',
  'AUTH_SIGNIN',
  'AUTH_SIGNUP',
  'IMAGE_UPLOADED',
  'CONDITION_LOGGED',
  'DISPUTE_RAISED',
  'DISPUTE_RESOLVED',
  'GROUP_CREATED',
  'GROUP_JOINED',
  'CRON_EXECUTION_COMPLETED',
]);

/**
 * ============================================================================
 * 1. BETTER AUTH CORE TABLES
 * Compatible with Better Auth specification
 * ============================================================================
 */
export const users = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  role: userRoleEnum('role').default('USER').notNull(), // 'USER' | 'VERIFIED_HOST' | 'ADMIN'
  image: text('image'),
  phoneNumber: text('phone_number'),
  bio: text('bio'),
  neighborhood: text('neighborhood'),
  trustScore: integer('trust_score').default(100).notNull(), // 0-100 trust rating
  isHost: boolean('is_host').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sessions = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});

export const accounts = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const verifications = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * ============================================================================
 * 2. CATEGORIES TABLE (Hierarchical / Multi-Level Taxonomies)
 * Organizes listings with parent-child support (e.g. Vehicles -> Car Parts)
 * ============================================================================
 */
export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  parentId: text('parent_id'), // Self-referencing FK for subcategories
  icon: varchar('icon', { length: 50 }), // Lucide icon identifier e.g. "Car", "Wrench", "Zap"
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_categories_slug').on(table.slug),
  index('idx_categories_parent_id').on(table.parentId),
]);

/**
 * ============================================================================
 * 3. LISTINGS TABLE
 * Supports Rooms, Physical Items, and Fractional Appliances with PostGIS Point
 * ============================================================================
 */
export const listings = pgTable('listings', {
  id: text('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  category: listingCategoryEnum('category').notNull(), // Legacy enum for backward compatibility
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Location & Physical Details (PostGIS + Textual Fallbacks)
  address: text('address').notNull(),
  neighborhood: varchar('neighborhood', { length: 150 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  latitude: text('latitude'),
  longitude: text('longitude'),
  location: pointGeometry('location'), // PostGIS geometry(Point, 4326)

  // Media & Metadata
  images: text('images').array().notNull().default([]),
  rules: text('rules'),
  depositRequiredInCents: integer('deposit_required_in_cents').default(0).notNull(),

  // Fractional Sharing Constraints
  maxSubscribers: integer('max_subscribers').default(1).notNull(), // E.g., 4 for a shared washing machine
  currentSubscribersCount: integer('current_subscribers_count').default(0).notNull(),
  isAvailable: boolean('is_available').default(true).notNull(),

  // Visibility & Private Trust Group scoping
  visibilityGroupId: text('visibility_group_id'), // Optional FK to trust_groups. If set, only active group members can view/book

  // Hardware / Access control (for fractional appliances & smart locks)
  accessMethod: text('access_method').default('pin_code'), // 'pin_code' | 'qr_code' | 'host_handover' | 'smart_plug'

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_listings_location').using('gist', table.location),
  index('idx_listings_category_id').on(table.categoryId),
  index('idx_listings_owner_id').on(table.ownerId),
  index('idx_listings_visibility_group_id').on(table.visibilityGroupId),
  index('idx_listings_filter').on(table.categoryId, table.isAvailable, table.visibilityGroupId),
  index('idx_listings_neighborhood').on(table.neighborhood),
]);

/**
 * ============================================================================
 * 3. PRICING TIERS TABLE
 * One-to-many relationship with Listings.
 * Handles Time-Based (nightly, daily) vs Usage-Based Fractional Subscriptions.
 * ============================================================================
 */
export const pricingTiers = pgTable('pricing_tiers', {
  id: text('id').primaryKey(),
  listingId: text('listing_id')
    .notNull()
    .references(() => listings.id, { onDelete: 'cascade' }),

  name: varchar('name', { length: 120 }).notNull(), // e.g. "Standard Co-Op (10 Uses)", "Weekend Pass", "Nightly Stay"
  description: text('description'),
  type: pricingTypeEnum('type').notNull(), // 'nightly' | 'daily' | 'monthly_subscription' | 'usage_pack'
  
  priceInCents: integer('price_in_cents').notNull(), // E.g. 50000 = R500.00 or $50.00
  currency: varchar('currency', { length: 10 }).default('ZAR').notNull(), // Supports ZAR, USD, EUR, GBP

  // Fractional Quotas
  usageLimitPerPeriod: integer('usage_limit_per_period'), // E.g. 10 uses (null for unlimited time-based)
  periodUnit: periodUnitEnum('period_unit').default('month').notNull(), // 'month', 'day', 'one_time'
  periodDuration: integer('period_duration').default(1).notNull(), // E.g. 1 (month)
  
  // Capacity control per tier
  maxActiveSubscribers: integer('max_active_subscribers'), // Max subscribers allowed on this specific tier

  isPopular: boolean('is_popular').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_pricing_tiers_listing_id').on(table.listingId),
  index('idx_pricing_tiers_type').on(table.type),
]);

/**
 * ============================================================================
 * 4. USER SUBSCRIPTIONS TABLE
 * Tracks active member allocations, recurring billing status, & remaining uses.
 * ============================================================================
 */
export const userSubscriptions = pgTable('user_subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  listingId: text('listing_id')
    .notNull()
    .references(() => listings.id, { onDelete: 'cascade' }),
  pricingTierId: text('pricing_tier_id')
    .notNull()
    .references(() => pricingTiers.id, { onDelete: 'restrict' }),

  status: subscriptionStatusEnum('status').default('active').notNull(),

  // Fractional Quota Tracking
  remainingUsesThisPeriod: integer('remaining_uses_this_period').notNull(), // E.g. Starts at 10, decrements to 0
  totalUsesUsed: integer('total_uses_used').default(0).notNull(),

  // Cycle Windows
  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  renewsAt: timestamp('renews_at'),
  cancelledAt: timestamp('cancelled_at'),

  stripeSubscriptionId: text('stripe_subscription_id'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_user_subscriptions_user_status').on(table.userId, table.status),
  index('idx_user_subscriptions_listing_id').on(table.listingId),
  index('idx_user_subscriptions_pricing_tier_id').on(table.pricingTierId),
  index('idx_user_subscriptions_status').on(table.status),
]);

/**
 * ============================================================================
 * 5. USAGE LOGS TABLE
 * Immutable, timestamped audit records of every fractional machine run or rental event.
 * ============================================================================
 */
export const usageLogs = pgTable('usage_logs', {
  id: text('id').primaryKey(),
  subscriptionId: text('subscription_id')
    .notNull()
    .references(() => userSubscriptions.id, { onDelete: 'cascade' }),
  listingId: text('listing_id')
    .notNull()
    .references(() => listings.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  unitsUsed: integer('units_used').default(1).notNull(), // E.g., 1 cycle, 2 hours, 1 run
  
  status: usageStatusEnum('status').default('completed').notNull(),
  notes: text('notes'), // E.g. "Standard 40C Cotton Cycle - 60 min"
  verificationCode: varchar('verification_code', { length: 32 }), // QR code verification or IoT pulse hash

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_usage_logs_subscription_id').on(table.subscriptionId),
  index('idx_usage_logs_user_listing').on(table.userId, table.listingId),
  index('idx_usage_logs_started_at').on(table.startedAt),
]);

/**
 * ============================================================================
 * 6. BOOKINGS TABLE
 * Time-based rentals (Rooms, Equipment) with Digital Handover States
 * ============================================================================
 */
export const bookings = pgTable('bookings', {
  id: text('id').primaryKey(),
  listingId: text('listing_id')
    .notNull()
    .references(() => listings.id, { onDelete: 'cascade' }),
  renterId: text('renter_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  pricingTierId: text('pricing_tier_id')
    .references(() => pricingTiers.id, { onDelete: 'set null' }),

  status: bookingStatusEnum('status').default('PENDING_HANDOVER').notNull(),
  disputeStatus: disputeStatusEnum('dispute_status').default('NONE').notNull(),
  verificationCode: varchar('verification_code', { length: 32 }).notNull(), // Digital Handover PIN / QR Token
  totalAmountInCents: integer('total_amount_in_cents').notNull(),
  depositAmountInCents: integer('deposit_amount_in_cents').default(0).notNull(),
  
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  
  handoverCompletedAt: timestamp('handover_completed_at'),
  handoverNotes: text('handover_notes'),
  returnConditionLogId: text('return_condition_log_id'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_bookings_renter_listing_status').on(table.renterId, table.listingId, table.status),
  index('idx_bookings_renter_id').on(table.renterId),
  index('idx_bookings_listing_id').on(table.listingId),
  index('idx_bookings_status').on(table.status),
  index('idx_bookings_dates').on(table.startDate, table.endDate),
]);

/**
 * ============================================================================
 * 7. PAYMENTS & ESCROW TABLE
 * Supports authorizing charges and holding funds in escrow until Digital Handover.
 * ============================================================================
 */
export const payments = pgTable('payment', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id')
    .notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(), // amount in cents (e.g. 15000 = R150.00)
  currency: text('currency').default('ZAR').notNull(),
  status: paymentStatusEnum('status').default('PENDING').notNull(), // PENDING | HELD_IN_ESCROW | CAPTURED | REFUNDED | FROZEN_ESCROW
  paymentGatewayRef: text('payment_gateway_ref'), // Paystack reference or Stripe PaymentIntent ID
  escrowReleasedAt: timestamp('escrow_released_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_payments_booking_id').on(table.bookingId),
  index('idx_payments_status').on(table.status),
]);

/**
 * ============================================================================
 * 8. CONDITION LOGS TABLE (PICKUP & RETURN HANDOVER INSPECTIONS)
 * Immutable records of item condition signed off by parties to release or freeze escrow.
 * ============================================================================
 */
export const conditionLogs = pgTable('condition_logs', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id')
    .notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  type: conditionLogTypeEnum('type').notNull(), // 'PICKUP' | 'RETURN'
  conditionStatus: conditionStatusEnum('condition_status').notNull(), // 'GOOD' | 'MINOR_WEAR' | 'DAMAGED'
  notes: text('notes'),
  imageUrls: jsonb('image_urls').$type<string[]>().default([]).notNull(),
  reportedBy: text('reported_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_condition_logs_booking_id').on(table.bookingId),
  index('idx_condition_logs_type').on(table.type),
]);

/**
 * ============================================================================
 * 9. PRIVATE TRUST GROUPS & MEMBERSHIPS
 * Closed communities (Apartments, Workplaces, Co-ops) with private asset scoping.
 * ============================================================================
 */
export const trustGroups = pgTable('trust_groups', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  inviteCode: varchar('invite_code', { length: 32 }).notNull().unique(),
  adminId: text('admin_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  icon: text('icon'),
  memberCount: integer('member_count').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_trust_groups_invite_code').on(table.inviteCode),
  index('idx_trust_groups_admin_id').on(table.adminId),
]);

export const groupMemberships = pgTable('group_memberships', {
  id: text('id').primaryKey(),
  groupId: text('group_id')
    .notNull()
    .references(() => trustGroups.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: groupMembershipStatusEnum('status').default('ACTIVE').notNull(), // 'PENDING' | 'ACTIVE' | 'BANNED'
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => [
  index('idx_group_memberships_group_user').on(table.groupId, table.userId),
  index('idx_group_memberships_user_id').on(table.userId),
]);

/**
 * ============================================================================
 * 10. P2P MESSAGING TABLES (CONVERSATIONS & MESSAGES)
 * Real-time inquiry and coordination channels between renters and hosts.
 * ============================================================================
 */
export const conversations = pgTable('conversation', {
  id: text('id').primaryKey(),
  listingId: text('listing_id')
    .notNull()
    .references(() => listings.id, { onDelete: 'cascade' }),
  renterId: text('renter_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  hostId: text('host_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  lastMessageAt: timestamp('last_message_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_conversations_renter_host').on(table.renterId, table.hostId),
  index('idx_conversations_listing_id').on(table.listingId),
]);

export const messages = pgTable('message', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  senderId: text('sender_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_messages_conversation_id').on(table.conversationId),
  index('idx_messages_created_at').on(table.createdAt),
]);

/**
 * ============================================================================
 * 9. TWO-WAY TRUST & REVIEWS TABLE
 * Granular host & renter ratings with verifiable reputation scoring.
 * ============================================================================
 */
export const reviews = pgTable('review', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id')
    .notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  reviewerId: text('reviewer_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  targetId: text('target_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }), // Target user (Host or Renter)
  listingId: text('listing_id')
    .references(() => listings.id, { onDelete: 'set null' }),
  rating: integer('rating').notNull(), // 1 to 5
  comment: text('comment').notNull(),
  cleanlinessRating: integer('cleanliness_rating'),
  communicationRating: integer('communication_rating'),
  accuracyRating: integer('accuracy_rating'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_reviews_target_id').on(table.targetId),
  index('idx_reviews_booking_id').on(table.bookingId),
  index('idx_reviews_listing_id').on(table.listingId),
]);

/**
 * ============================================================================
 * 10. SYSTEM LOGS TABLE (IMMUTABLE AUDIT LEDGER)
 * Tracks every state change across the system with tamper-evident JSONB metadata.
 * ============================================================================
 */
export const systemLogs = pgTable('system_logs', {
  id: text('id').primaryKey(),
  eventType: systemEventTypeEnum('event_type').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  targetId: text('target_id').notNull(), // listing, booking, subscription, payment, review, or message ID
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_system_logs_metadata').using('gin', table.metadata),
  index('idx_system_logs_user_event').on(table.userId, table.eventType),
  index('idx_system_logs_target_id').on(table.targetId),
  index('idx_system_logs_created_at').on(table.createdAt),
]);

/**
 * ============================================================================
 * DRIZZLE RELATIONS MAPPINGS
 * ============================================================================
 */
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  ownedListings: many(listings),
  subscriptions: many(userSubscriptions),
  usageLogs: many(usageLogs),
  bookings: many(bookings),
  sentMessages: many(messages),
  renterConversations: many(conversations, { relationName: 'renterConversations' }),
  hostConversations: many(conversations, { relationName: 'hostConversations' }),
  reviewsAuthored: many(reviews, { relationName: 'reviewerReviews' }),
  reviewsReceived: many(reviews, { relationName: 'targetReviews' }),
  systemLogs: many(systemLogs),
  conditionLogs: many(conditionLogs),
  groupMemberships: many(groupMemberships),
  adminGroups: many(trustGroups),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'categoryHierarchy',
  }),
  children: many(categories, {
    relationName: 'categoryHierarchy',
  }),
  listings: many(listings),
}));

export const listingsRelations = relations(listings, ({ one, many }) => ({
  owner: one(users, {
    fields: [listings.ownerId],
    references: [users.id],
  }),
  categoryRef: one(categories, {
    fields: [listings.categoryId],
    references: [categories.id],
  }),
  visibilityGroup: one(trustGroups, {
    fields: [listings.visibilityGroupId],
    references: [trustGroups.id],
  }),
  pricingTiers: many(pricingTiers),
  subscriptions: many(userSubscriptions),
  usageLogs: many(usageLogs),
  bookings: many(bookings),
  conversations: many(conversations),
  reviews: many(reviews),
}));

export const pricingTiersRelations = relations(pricingTiers, ({ one, many }) => ({
  listing: one(listings, {
    fields: [pricingTiers.listingId],
    references: [listings.id],
  }),
  subscriptions: many(userSubscriptions),
  bookings: many(bookings),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one, many }) => ({
  user: one(users, {
    fields: [userSubscriptions.userId],
    references: [users.id],
  }),
  listing: one(listings, {
    fields: [userSubscriptions.listingId],
    references: [listings.id],
  }),
  pricingTier: one(pricingTiers, {
    fields: [userSubscriptions.pricingTierId],
    references: [pricingTiers.id],
  }),
  usageLogs: many(usageLogs),
}));

export const usageLogsRelations = relations(usageLogs, ({ one }) => ({
  subscription: one(userSubscriptions, {
    fields: [usageLogs.subscriptionId],
    references: [userSubscriptions.id],
  }),
  listing: one(listings, {
    fields: [usageLogs.listingId],
    references: [listings.id],
  }),
  user: one(users, {
    fields: [usageLogs.userId],
    references: [users.id],
  }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  listing: one(listings, {
    fields: [bookings.listingId],
    references: [listings.id],
  }),
  renter: one(users, {
    fields: [bookings.renterId],
    references: [users.id],
  }),
  pricingTier: one(pricingTiers, {
    fields: [bookings.pricingTierId],
    references: [pricingTiers.id],
  }),
  payments: many(payments),
  reviews: many(reviews),
  conditionLogs: many(conditionLogs),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, {
    fields: [payments.bookingId],
    references: [bookings.id],
  }),
}));

export const conditionLogsRelations = relations(conditionLogs, ({ one }) => ({
  booking: one(bookings, {
    fields: [conditionLogs.bookingId],
    references: [bookings.id],
  }),
  reporter: one(users, {
    fields: [conditionLogs.reportedBy],
    references: [users.id],
  }),
}));

export const trustGroupsRelations = relations(trustGroups, ({ one, many }) => ({
  admin: one(users, {
    fields: [trustGroups.adminId],
    references: [users.id],
  }),
  memberships: many(groupMemberships),
  restrictedListings: many(listings),
}));

export const groupMembershipsRelations = relations(groupMemberships, ({ one }) => ({
  group: one(trustGroups, {
    fields: [groupMemberships.groupId],
    references: [trustGroups.id],
  }),
  user: one(users, {
    fields: [groupMemberships.userId],
    references: [users.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  listing: one(listings, {
    fields: [conversations.listingId],
    references: [listings.id],
  }),
  renter: one(users, {
    fields: [conversations.renterId],
    references: [users.id],
    relationName: 'renterConversations',
  }),
  host: one(users, {
    fields: [conversations.hostId],
    references: [users.id],
    relationName: 'hostConversations',
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  booking: one(bookings, {
    fields: [reviews.bookingId],
    references: [bookings.id],
  }),
  reviewer: one(users, {
    fields: [reviews.reviewerId],
    references: [users.id],
    relationName: 'reviewerReviews',
  }),
  target: one(users, {
    fields: [reviews.targetId],
    references: [users.id],
    relationName: 'targetReviews',
  }),
  listing: one(listings, {
    fields: [reviews.listingId],
    references: [listings.id],
  }),
}));

export const systemLogsRelations = relations(systemLogs, ({ one }) => ({
  user: one(users, {
    fields: [systemLogs.userId],
    references: [users.id],
  }),
}));

/**
 * ============================================================================
 * EXPORTED INFERRED TYPESCRIPT TYPES
 * ============================================================================
 */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;

export type PricingTier = typeof pricingTiers.$inferSelect;
export type NewPricingTier = typeof pricingTiers.$inferInsert;

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type NewUserSubscription = typeof userSubscriptions.$inferInsert;

export type UsageLog = typeof usageLogs.$inferSelect;
export type NewUsageLog = typeof usageLogs.$inferInsert;

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type ConditionLog = typeof conditionLogs.$inferSelect;
export type NewConditionLog = typeof conditionLogs.$inferInsert;

export type TrustGroup = typeof trustGroups.$inferSelect;
export type NewTrustGroup = typeof trustGroups.$inferInsert;

export type GroupMembership = typeof groupMemberships.$inferSelect;
export type NewGroupMembership = typeof groupMemberships.$inferInsert;

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;

export type SystemLog = typeof systemLogs.$inferSelect;
export type NewSystemLog = typeof systemLogs.$inferInsert;

