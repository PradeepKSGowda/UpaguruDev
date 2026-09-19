-- =========================================================================
-- UPA-GURU Database Migration Script
-- Script Name: fcm-web-push-schema-v1.sql
-- Path: .agents/knowledge/database/fcm-web-push-schema-v1.sql
-- Task Reference: TASK-05020101 (Subtasks: SUB-0502010101, SUB-0502010102)
-- Architecture Reference: ADR-002 (Database), ADR-007 (Omnichannel Push Alert Engine), ADR-013 (Security)
-- Date: 2026-09-19
-- =========================================================================
-- Description:
-- Establishes database performance indexes and token storage support for
-- Firebase Cloud Messaging (FCM) Web Push notification dispatching.
-- =========================================================================

-- 1. Ensure fcm_device_token column exists on public.user_subscriptions
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'user_subscriptions' 
          AND column_name = 'fcm_device_token'
    ) THEN
        ALTER TABLE public.user_subscriptions ADD COLUMN fcm_device_token TEXT;
    END IF;
END $$;

-- 2. Create Partial Index for High-Throughput Push Dispatching
-- Only indexes rows that have an active registered browser push device token
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_fcm 
    ON public.user_subscriptions (fcm_device_token) 
    WHERE fcm_device_token IS NOT NULL;

-- 3. Verify Row Level Security (RLS)
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
