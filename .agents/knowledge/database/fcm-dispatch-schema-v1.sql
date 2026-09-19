-- =========================================================================
-- UPA-GURU Database Migration Script
-- Script Name: fcm-dispatch-schema-v1.sql
-- Path: .agents/knowledge/database/fcm-dispatch-schema-v1.sql
-- Task Reference: TASK-05020102 (Subtask: SUB-0502010201)
-- Architecture Reference: ADR-002 (Database), ADR-007 (Omnichannel Push Alert Engine), ADR-013 (Security)
-- Date: 2026-09-19
-- =========================================================================
-- Description:
-- Establishes the notification_dispatch_logs audit table and performance
-- telemetry indexes for recording multicast push deliveries across all channels.
-- =========================================================================

-- 1. Create notification_dispatch_logs table
CREATE TABLE IF NOT EXISTS public.notification_dispatch_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
    channel TEXT NOT NULL, -- 'web_push', 'telegram', 'whatsapp', 'email'
    total_recipients INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed', -- 'completed', 'partial_failure', 'failed'
    error_summary JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Performance Indexes for Analytical Reporting and Queue Telemetry
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_notification 
    ON public.notification_dispatch_logs(notification_id);

CREATE INDEX IF NOT EXISTS idx_dispatch_logs_channel 
    ON public.notification_dispatch_logs(channel);

CREATE INDEX IF NOT EXISTS idx_dispatch_logs_created_at 
    ON public.notification_dispatch_logs(created_at DESC);

-- 3. Row Level Security (RLS) Enforcement
ALTER TABLE public.notification_dispatch_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin Full Access Dispatch Logs" ON public.notification_dispatch_logs;

CREATE POLICY "Admin Full Access Dispatch Logs" ON public.notification_dispatch_logs
    FOR ALL
    USING (auth.jwt() ->> 'role' IN ('admin', 'super_admin'));
