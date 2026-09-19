-- =========================================================================
-- UPA-GURU Database Migration Script
-- Script Name: telegram-bot-schema-v1.sql
-- Path: .agents/knowledge/database/telegram-bot-schema-v1.sql
-- Task Reference: TASK-05030101 (Subtasks: SUB-0503010101, SUB-0503010102)
-- Architecture Reference: ADR-002 (Database), ADR-007 (Omnichannel Push Alert Engine), ADR-013 (Security)
-- Date: 2026-09-19
-- =========================================================================
-- Description:
-- Establishes partial indexing on telegram_chat_id for ultra-fast Telegram webhook
-- command processing and high-throughput broadcast alert queries.
-- =========================================================================

-- 1. Ensure telegram_chat_id column exists on public.user_subscriptions
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'user_subscriptions' 
          AND column_name = 'telegram_chat_id'
    ) THEN
        ALTER TABLE public.user_subscriptions ADD COLUMN telegram_chat_id TEXT;
    END IF;
END $$;

-- 2. Partial Index for Fast Webhook /status /stop Lookups and Broadcast Matching
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_telegram 
    ON public.user_subscriptions (telegram_chat_id) 
    WHERE telegram_chat_id IS NOT NULL;

-- 3. Row Level Security Verification
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
