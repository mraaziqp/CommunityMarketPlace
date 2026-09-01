-- ============================================================================
-- SHAREHUB AUDIT PASS: HIGH PERFORMANCE DATABASE INDEXES & SPATIAL POSTGIS
-- Migration: 0003_indexes_and_postgis_gist.sql
-- ============================================================================

-- Enable PostGIS spatial extension if not already present
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Spatial GiST index on listings.location for O(log N) radius proximity queries (ST_DWithin, ST_Distance)
CREATE INDEX IF NOT EXISTS idx_listings_location ON listings USING GIST (location);

-- 2. Foreign Key & Filter composite indexes for listings discovery
CREATE INDEX IF NOT EXISTS idx_listings_category_id ON listings(category_id);
CREATE INDEX IF NOT EXISTS idx_listings_owner_id ON listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_listings_visibility_group_id ON listings(visibility_group_id);
CREATE INDEX IF NOT EXISTS idx_listings_filter ON listings(category_id, is_available, visibility_group_id);
CREATE INDEX IF NOT EXISTS idx_listings_neighborhood ON listings(neighborhood);

-- 3. Bookings foreign key & multi-column status index for conflict guards & lookups
CREATE INDEX IF NOT EXISTS idx_bookings_renter_listing_status ON bookings(renter_id, listing_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_renter_id ON bookings(renter_id);
CREATE INDEX IF NOT EXISTS idx_bookings_listing_id ON bookings(listing_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(start_date, end_date);

-- 4. User subscriptions quota and active state indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status ON user_subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_listing_id ON user_subscriptions(listing_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_pricing_tier_id ON user_subscriptions(pricing_tier_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);

-- 5. Usage logs subscription and chronological tracking
CREATE INDEX IF NOT EXISTS idx_usage_logs_subscription_id ON usage_logs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_listing ON usage_logs(user_id, listing_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_started_at ON usage_logs(started_at);

-- 6. Pricing tiers listing index
CREATE INDEX IF NOT EXISTS idx_pricing_tiers_listing_id ON pricing_tiers(listing_id);
CREATE INDEX IF NOT EXISTS idx_pricing_tiers_type ON pricing_tiers(type);

-- 7. Payment & Escrow ledger indexes
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payment(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payment(status);

-- 8. Condition inspection logs
CREATE INDEX IF NOT EXISTS idx_condition_logs_booking_id ON condition_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_condition_logs_type ON condition_logs(type);

-- 9. Private Trust Groups & Memberships
CREATE INDEX IF NOT EXISTS idx_trust_groups_invite_code ON trust_groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_trust_groups_admin_id ON trust_groups(admin_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_group_user ON group_memberships(group_id, user_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_user_id ON group_memberships(user_id);

-- 10. Reviews & Reputation
CREATE INDEX IF NOT EXISTS idx_reviews_target_id ON review(target_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking_id ON review(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_listing_id ON review(listing_id);

-- 11. Categories taxonomy hierarchy
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);

-- 12. GIN Index on JSONB system audit log metadata & event lookups
CREATE INDEX IF NOT EXISTS idx_system_logs_metadata ON system_logs USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_event ON system_logs(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_target_id ON system_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
