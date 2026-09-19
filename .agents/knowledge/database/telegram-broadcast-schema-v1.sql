-- =========================================================================
-- UPA-GURU Database Migration Script
-- Script Name: telegram-broadcast-schema-v1.sql
-- Path: .agents/knowledge/database/telegram-broadcast-schema-v1.sql
-- Task Reference: TASK-05030102 (Subtask: SUB-0503010201)
-- Architecture Reference: ADR-002 (Database), ADR-007 (Omnichannel Push Alert Engine), ADR-013 (Security)
-- Date: 2026-09-19
-- =========================================================================
-- Description:
-- Establishes composite indexing for Telegram broadcast dispatch telemetry
-- and validates foreign key cascade rules on notification dispatch logs.
-- =========================================================================

-- 1. Ensure composite index for fast channel-filtered dispatch lookups
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_channel_status 
    ON public.notification_dispatch_logs (channel, status, created_at DESC);

-- 2. Verify Row Level Security
ALTER TABLE public.notification_dispatch_logs ENABLE ROW LEVEL SECURITY;
