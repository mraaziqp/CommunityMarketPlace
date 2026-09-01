-- ============================================================================
-- DRIZZLE SQL MIGRATION: Drop Local P2P Messaging Tables
-- P2P communication is now offloaded to AwehChat (https://www.awehchat.co.za/)
-- ============================================================================

-- 1. Drop dependent message table
DROP TABLE IF EXISTS "message" CASCADE;

-- 2. Drop parent conversation table
DROP TABLE IF EXISTS "conversation" CASCADE;

-- 3. (Optional) Drop legacy indexes
DROP INDEX IF EXISTS "idx_messages_conversation_id";
DROP INDEX IF EXISTS "idx_conversations_listing_id";
DROP INDEX IF EXISTS "idx_conversations_participants";
