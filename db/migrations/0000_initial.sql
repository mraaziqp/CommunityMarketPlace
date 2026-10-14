CREATE TYPE "public"."booking_status" AS ENUM('PENDING_PAYMENT', 'PENDING_HANDOVER', 'ACTIVE', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."condition_log_type" AS ENUM('PICKUP', 'RETURN');--> statement-breakpoint
CREATE TYPE "public"."condition_status" AS ENUM('GOOD', 'MINOR_WEAR', 'DAMAGED');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('NONE', 'PENDING_REVIEW', 'RESOLVED');--> statement-breakpoint
CREATE TYPE "public"."group_membership_status" AS ENUM('PENDING', 'ACTIVE', 'BANNED');--> statement-breakpoint
CREATE TYPE "public"."listing_category" AS ENUM('room', 'physical_item', 'fractional_appliance');--> statement-breakpoint
CREATE TYPE "public"."payment_kind" AS ENUM('booking', 'subscription');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'HELD_IN_ESCROW', 'CAPTURED', 'REFUNDED', 'FROZEN_ESCROW');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('none', 'due', 'done');--> statement-breakpoint
CREATE TYPE "public"."period_unit" AS ENUM('hour', 'day', 'month', 'year', 'one_time');--> statement-breakpoint
CREATE TYPE "public"."pricing_type" AS ENUM('nightly', 'hourly', 'daily', 'monthly_subscription', 'usage_pack');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('pending_payment', 'active', 'paused', 'expired', 'cancelled', 'past_due');--> statement-breakpoint
CREATE TYPE "public"."system_event_type" AS ENUM('BOOKING_CREATED', 'HANDOVER_COMPLETED', 'FRACTIONAL_USE_LOGGED', 'PAYMENT_HELD', 'PAYMENT_CAPTURED', 'PAYMENT_REFUNDED', 'MESSAGE_SENT', 'REVIEW_SUBMITTED', 'LISTING_CREATED', 'AUTH_SIGNIN', 'AUTH_SIGNUP', 'IMAGE_UPLOADED', 'CONDITION_LOGGED', 'DISPUTE_RAISED', 'DISPUTE_RESOLVED', 'GROUP_CREATED', 'GROUP_JOINED', 'CRON_EXECUTION_COMPLETED', 'PAYMENT_FAILED', 'SUBSCRIPTION_CANCELLED', 'DATA_IMPORTED');--> statement-breakpoint
CREATE TYPE "public"."usage_status" AS ENUM('completed', 'in_progress', 'flagged', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('USER', 'VERIFIED_HOST', 'ADMIN');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"renter_id" text NOT NULL,
	"pricing_tier_id" text,
	"status" "booking_status" DEFAULT 'PENDING_HANDOVER' NOT NULL,
	"dispute_status" "dispute_status" DEFAULT 'NONE' NOT NULL,
	"verification_code" varchar(32) NOT NULL,
	"total_amount_in_cents" integer NOT NULL,
	"deposit_amount_in_cents" integer DEFAULT 0 NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"handover_completed_at" timestamp,
	"handover_notes" text,
	"return_condition_log_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"parent_id" text,
	"icon" varchar(50),
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "condition_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"type" "condition_log_type" NOT NULL,
	"condition_status" "condition_status" NOT NULL,
	"notes" text,
	"image_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reported_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"renter_id" text NOT NULL,
	"host_id" text NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" "group_membership_status" DEFAULT 'ACTIVE' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" text PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"category" "listing_category" NOT NULL,
	"category_id" text,
	"owner_id" text NOT NULL,
	"address" text NOT NULL,
	"neighborhood" varchar(150) NOT NULL,
	"city" varchar(100) NOT NULL,
	"latitude" text,
	"longitude" text,
	"images" text[] DEFAULT '{}' NOT NULL,
	"rules" text,
	"deposit_required_in_cents" integer DEFAULT 0 NOT NULL,
	"max_subscribers" integer DEFAULT 1 NOT NULL,
	"current_subscribers_count" integer DEFAULT 0 NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"visibility_group_id" text,
	"access_method" text DEFAULT 'pin_code',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"content" text NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "payment_kind" DEFAULT 'booking' NOT NULL,
	"booking_id" text,
	"subscription_id" text,
	"payer_id" text,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"provider" text,
	"payment_gateway_ref" text,
	"escrow_released_at" timestamp,
	"host_payout_status" "payout_status" DEFAULT 'none' NOT NULL,
	"host_payout_in_cents" integer DEFAULT 0 NOT NULL,
	"deposit_refund_status" "payout_status" DEFAULT 'none' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_payment_gateway_ref_unique" UNIQUE("payment_gateway_ref")
);
--> statement-breakpoint
CREATE TABLE "pricing_tiers" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"type" "pricing_type" NOT NULL,
	"price_in_cents" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'ZAR' NOT NULL,
	"usage_limit_per_period" integer,
	"period_unit" "period_unit" DEFAULT 'month' NOT NULL,
	"period_duration" integer DEFAULT 1 NOT NULL,
	"max_active_subscribers" integer,
	"is_popular" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"target_id" text NOT NULL,
	"listing_id" text,
	"rating" integer NOT NULL,
	"comment" text NOT NULL,
	"cleanliness_rating" integer,
	"communication_rating" integer,
	"accuracy_rating" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "system_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" "system_event_type" NOT NULL,
	"user_id" text NOT NULL,
	"target_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trust_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"invite_code" varchar(32) NOT NULL,
	"admin_id" text NOT NULL,
	"icon" text,
	"member_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trust_groups_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "usage_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"user_id" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"units_used" integer DEFAULT 1 NOT NULL,
	"status" "usage_status" DEFAULT 'completed' NOT NULL,
	"notes" text,
	"verification_code" varchar(32),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"pricing_tier_id" text NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"remaining_uses_this_period" integer NOT NULL,
	"total_uses_used" integer DEFAULT 0 NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"renews_at" timestamp,
	"cancelled_at" timestamp,
	"stripe_subscription_id" text,
	"gateway_token" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"role" "user_role" DEFAULT 'USER' NOT NULL,
	"image" text,
	"phone_number" text,
	"bio" text,
	"neighborhood" text,
	"trust_score" integer DEFAULT 100 NOT NULL,
	"is_host" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_renter_id_user_id_fk" FOREIGN KEY ("renter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pricing_tier_id_pricing_tiers_id_fk" FOREIGN KEY ("pricing_tier_id") REFERENCES "public"."pricing_tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_logs" ADD CONSTRAINT "condition_logs_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_logs" ADD CONSTRAINT "condition_logs_reported_by_user_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_renter_id_user_id_fk" FOREIGN KEY ("renter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_group_id_trust_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."trust_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_payer_id_user_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_tiers" ADD CONSTRAINT "pricing_tiers_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_target_id_user_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_groups" ADD CONSTRAINT "trust_groups_admin_id_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_pricing_tier_id_pricing_tiers_id_fk" FOREIGN KEY ("pricing_tier_id") REFERENCES "public"."pricing_tiers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bookings_renter_listing_status" ON "bookings" USING btree ("renter_id","listing_id","status");--> statement-breakpoint
CREATE INDEX "idx_bookings_renter_id" ON "bookings" USING btree ("renter_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_listing_id" ON "bookings" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_status" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bookings_dates" ON "bookings" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_categories_slug" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_categories_parent_id" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_condition_logs_booking_id" ON "condition_logs" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_condition_logs_type" ON "condition_logs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_conversations_renter_host" ON "conversation" USING btree ("renter_id","host_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_listing_id" ON "conversation" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "idx_group_memberships_group_user" ON "group_memberships" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_group_memberships_user_id" ON "group_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_listings_category_id" ON "listings" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_listings_owner_id" ON "listings" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_listings_visibility_group_id" ON "listings" USING btree ("visibility_group_id");--> statement-breakpoint
CREATE INDEX "idx_listings_filter" ON "listings" USING btree ("category_id","is_available","visibility_group_id");--> statement-breakpoint
CREATE INDEX "idx_listings_neighborhood" ON "listings" USING btree ("neighborhood");--> statement-breakpoint
CREATE INDEX "idx_messages_conversation_id" ON "message" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_messages_created_at" ON "message" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_payments_booking_id" ON "payment" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_payments_subscription_id" ON "payment" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_payments_status" ON "payment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_pricing_tiers_listing_id" ON "pricing_tiers" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "idx_pricing_tiers_type" ON "pricing_tiers" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_reviews_target_id" ON "review" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "idx_reviews_booking_id" ON "review" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_reviews_listing_id" ON "review" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "idx_system_logs_metadata" ON "system_logs" USING gin ("metadata");--> statement-breakpoint
CREATE INDEX "idx_system_logs_user_event" ON "system_logs" USING btree ("user_id","event_type");--> statement-breakpoint
CREATE INDEX "idx_system_logs_target_id" ON "system_logs" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "idx_system_logs_created_at" ON "system_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_trust_groups_invite_code" ON "trust_groups" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "idx_trust_groups_admin_id" ON "trust_groups" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "idx_usage_logs_subscription_id" ON "usage_logs" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_usage_logs_user_listing" ON "usage_logs" USING btree ("user_id","listing_id");--> statement-breakpoint
CREATE INDEX "idx_usage_logs_started_at" ON "usage_logs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_gateway_token" ON "user_subscriptions" USING btree ("gateway_token");--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_user_status" ON "user_subscriptions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_listing_id" ON "user_subscriptions" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_pricing_tier_id" ON "user_subscriptions" USING btree ("pricing_tier_id");--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_status" ON "user_subscriptions" USING btree ("status");