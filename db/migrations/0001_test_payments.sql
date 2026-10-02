ALTER TYPE "public"."payment_kind" ADD VALUE 'test';--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "gateway_token" text;