-- =========================================================================
-- UPA-GURU Database Migration Script
-- Script Name: subscription-preferences-schema-v1.sql
-- Path: .agents/knowledge/database/subscription-preferences-schema-v1.sql
-- Task Reference: TASK-05010101 (Subtasks: SUB-0501010101, SUB-0501010102)
-- Architecture Reference: ADR-002 (Database), ADR-007 (Omnichannel Push Alert Engine), ADR-013 (Security)
-- Date: 2026-09-19
-- =========================================================================
-- Description:
-- Idempotent database script for Candidate Subscription Preferences.
-- 1. Deduplicates existing records in public.user_subscriptions.
-- 2. Adds UNIQUE constraint on user_id to enforce 1-to-1 candidate subscription profile.
-- 3. Creates high-performance GIN indexes for omnichannel matching queries.
-- 4. Establishes strict Row Level Security (RLS) policies for user self-service.
-- =========================================================================

-- 1. Deduplicate existing rows in user_subscriptions, preserving the most recently updated row per user
DELETE FROM public.user_subscriptions
WHERE id NOT IN (
    SELECT DISTINCT ON (user_id) id
    FROM public.user_subscriptions
    ORDER BY user_id, updated_at DESC
);

-- 2. Add Unique Constraint on user_id
ALTER TABLE public.user_subscriptions
DROP CONSTRAINT IF EXISTS user_subscriptions_user_id_key;

ALTER TABLE public.user_subscriptions
ADD CONSTRAINT user_subscriptions_user_id_key UNIQUE (user_id);

-- 3. Create High-Performance GIN Indexes for Omnichannel Dispatch matching queries
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_channels 
    ON public.user_subscriptions USING GIN (preferred_channels);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_categories 
    ON public.user_subscriptions USING GIN (subscribed_categories);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_states 
    ON public.user_subscriptions USING GIN (subscribed_states);

-- 4. Enforce Row Level Security (RLS)
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User Subscriptions Own Access" ON public.user_subscriptions;

CREATE POLICY "User Subscriptions Own Access" ON public.user_subscriptions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. Admin Full Access Policy for System Audit and Dispatch Engines
DROP POLICY IF EXISTS "Admin Full Access User Subscriptions" ON public.user_subscriptions;

CREATE POLICY "Admin Full Access User Subscriptions" ON public.user_subscriptions
    FOR ALL
    USING (auth.jwt() ->> 'role' IN ('admin', 'super_admin'));
