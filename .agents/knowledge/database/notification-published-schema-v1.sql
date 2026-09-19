-- =========================================================================
-- UPA-GURU Database Migration Script
-- Script Name: notification-published-schema-v1.sql
-- Path: .agents/knowledge/database/notification-published-schema-v1.sql
-- Task Reference: TASK-05050101 (Subtasks: SUB-0505010101, SUB-0505010102)
-- Architecture Reference: ADR-002 (Database), ADR-007 (Omnichannel Push Alert Engine), ADR-013 (Security)
-- Date: 2026-09-19
-- =========================================================================
-- Description:
-- Establishes the high-performance PostgreSQL RPC function
-- `match_notification_subscribers` for candidate matching using array
-- containment (@>) operators, GIN indexes, and secure auth.users email joins.
-- =========================================================================

-- 1. Ensure GIN index on subscribed_categories for array containment
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_categories_gin
    ON public.user_subscriptions USING GIN (subscribed_categories);

-- 2. Ensure GIN index on subscribed_states for array overlap/containment
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_states_gin
    ON public.user_subscriptions USING GIN (subscribed_states);

-- 3. Ensure GIN index on subscribed_exam_ids for array containment
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_exam_ids_gin
    ON public.user_subscriptions USING GIN (subscribed_exam_ids);

-- 4. High-Performance Subscriber Matching RPC Function
CREATE OR REPLACE FUNCTION public.match_notification_subscribers(
    p_exam_id UUID DEFAULT NULL,
    p_category exam_category_enum DEFAULT NULL,
    p_state TEXT DEFAULT NULL
)
RETURNS TABLE (
    user_id UUID,
    preferred_channels TEXT[],
    fcm_device_token TEXT,
    telegram_chat_id TEXT,
    whatsapp_phone_number TEXT,
    email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.user_id,
        s.preferred_channels,
        s.fcm_device_token,
        s.telegram_chat_id,
        s.whatsapp_phone_number,
        u.email::TEXT
    FROM public.user_subscriptions s
    LEFT JOIN auth.users u ON s.user_id = u.id
    WHERE (
        -- Direct Master Exam subscription match
        (p_exam_id IS NOT NULL AND s.subscribed_exam_ids @> ARRAY[p_exam_id])
        OR
        (
            -- Category criteria: User opted into category OR has empty array (all categories)
            (
                s.subscribed_categories IS NULL 
                OR cardinality(s.subscribed_categories) = 0 
                OR (p_category IS NOT NULL AND s.subscribed_categories @> ARRAY[p_category])
            )
            AND
            -- State criteria: User opted into state OR exam is Central/All-India OR user has empty state array (all states)
            (
                s.subscribed_states IS NULL 
                OR cardinality(s.subscribed_states) = 0 
                OR p_state IS NULL 
                OR p_state ILIKE '%Central%'
                OR p_state ILIKE '%All-India%'
                OR s.subscribed_states @> ARRAY['All-India / Central']
                OR s.subscribed_states @> ARRAY[p_state]
            )
        )
    );
END;
$$;

-- 5. Comments for Documentation and Audit
COMMENT ON FUNCTION public.match_notification_subscribers IS
    'Performs array-indexed candidate subscriber matching across exam ID, category, and state.';

-- 6. Verify Row Level Security is active
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
