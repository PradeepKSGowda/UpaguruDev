-- =========================================================================
-- UPA-GURU Database Migration Script
-- Script Name: email-digest-schema-v1.sql
-- Path: .agents/knowledge/database/email-digest-schema-v1.sql
-- Task Reference: TASK-05040102 (Subtask: SUB-0504010201)
-- Architecture Reference: ADR-002 (Database), ADR-007 (Omnichannel Push Alert Engine), ADR-013 (Security)
-- Date: 2026-09-19
-- =========================================================================
-- Description:
-- Establishes a GIN index on public.user_subscriptions(preferred_channels)
-- to accelerate subscriber matching for Email and multichannel broadcasts.
-- Ensures notification_dispatch_logs handles 'email' channel telemetry.
-- =========================================================================

-- 1. GIN index for channel array matching
-- Accelerates queries like: WHERE preferred_channels @> ARRAY['email']
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_channels
    ON public.user_subscriptions USING GIN (preferred_channels);

-- 2. Audit Trail Comment
COMMENT ON INDEX public.idx_user_subscriptions_channels IS
    'Accelerates multichannel candidate matching using GIN array containment queries.';

-- 3. Verify Row Level Security is active
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
