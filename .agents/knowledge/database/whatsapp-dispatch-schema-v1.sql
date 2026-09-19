-- =========================================================================
-- UPA-GURU Database Migration Script
-- Script Name: whatsapp-dispatch-schema-v1.sql
-- Path: .agents/knowledge/database/whatsapp-dispatch-schema-v1.sql
-- Task Reference: TASK-05040101 (Subtask: SUB-0504010101)
-- Architecture Reference: ADR-002 (Database), ADR-007 (Omnichannel Push Alert Engine), ADR-013 (Security)
-- Date: 2026-09-19
-- =========================================================================
-- Description:
-- Establishes a partial B-Tree index on public.user_subscriptions(whatsapp_phone_number)
-- to accelerate subscriber matching for WhatsApp alert broadcasts.
-- Ensures notification_dispatch_logs handles 'whatsapp' channel telemetry.
-- =========================================================================

-- 1. Partial index for WhatsApp subscribers
-- Only indexes rows with an active, non-null whatsapp_phone_number
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_whatsapp
    ON public.user_subscriptions (whatsapp_phone_number)
    WHERE whatsapp_phone_number IS NOT NULL;

-- 2. Audit Trail Comment
COMMENT ON INDEX public.idx_user_subscriptions_whatsapp IS
    'Accelerates recipient resolution for WhatsApp Business API broadcast delivery.';

-- 3. Verify Row Level Security is active
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
