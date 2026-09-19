-- =========================================================================
-- UPA-GURU Database Migration Script
-- Script Name: omnichannel-orchestrator-schema-v1.sql
-- Path: .agents/knowledge/database/omnichannel-orchestrator-schema-v1.sql
-- Task Reference: TASK-05050102 (Subtask: SUB-0505010201)
-- Architecture Reference: ADR-002 (Database), ADR-007 (Omnichannel Push Alert Engine), ADR-013 (Security)
-- Date: 2026-09-19
-- =========================================================================
-- Description:
-- Establishes the complete idempotent DDL for public.notification_dispatch_logs,
-- performance composite indexes, and strict Row Level Security (RLS) policies.
-- =========================================================================

-- 1. Create notification_dispatch_logs table if not exists
CREATE TABLE IF NOT EXISTS public.notification_dispatch_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE,
    channel TEXT NOT NULL, -- 'web_push', 'telegram', 'whatsapp', 'email', 'all'
    recipient_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'partial_failure', 'failed', 'skipped'
    duration_ms INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_notification_id 
    ON public.notification_dispatch_logs(notification_id);

CREATE INDEX IF NOT EXISTS idx_dispatch_logs_channel_status 
    ON public.notification_dispatch_logs(channel, status, created_at DESC);

-- 3. Enable Row Level Security (RLS) (AGENTS.md Rule 3)
ALTER TABLE public.notification_dispatch_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Access Policies (Idempotent policy creation)
DROP POLICY IF EXISTS "Admin Full Access Dispatch Logs" ON public.notification_dispatch_logs;
CREATE POLICY "Admin Full Access Dispatch Logs" ON public.notification_dispatch_logs
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Service Role Full Access Dispatch Logs" ON public.notification_dispatch_logs;
CREATE POLICY "Service Role Full Access Dispatch Logs" ON public.notification_dispatch_logs
    FOR ALL USING (auth.role() = 'service_role');

-- 5. Audit Comments
COMMENT ON TABLE public.notification_dispatch_logs IS
    'Persistent telemetry ledger recording multi-channel broadcast delivery results and error diagnostics.';
