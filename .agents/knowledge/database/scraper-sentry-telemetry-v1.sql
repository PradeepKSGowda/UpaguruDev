-- =============================================================================
-- UPA-GURU Database Migration: Scraper Error Telemetry & Sentry Integration (v1.0.0)
-- Task ID: TASK-07010102 (Subtask: SUB-0701010201 - Sentry Python Scraper SDK)
-- Complies with: ADR-002, ADR-011, ADR-013, AGENTS.md (Rule 3: Mandatory RLS & RBAC)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Scraper Error Telemetry Specialized Index
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_error_telemetry_logs_scraper 
    ON public.error_telemetry_logs (runtime, created_at DESC)
    WHERE runtime = 'scraper';

-- -----------------------------------------------------------------------------
-- 2. Scraper Error Audit View for Admin Verification Portal
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_scraper_error_telemetry 
WITH (security_invoker = true) AS
SELECT 
    id,
    sentry_event_id,
    environment,
    error_name,
    error_message,
    metadata ->> 'crawler_id' AS crawler_id,
    metadata ->> 'source' AS source,
    metadata,
    created_at
FROM public.error_telemetry_logs
WHERE runtime = 'scraper';

COMMENT ON VIEW public.v_scraper_error_telemetry IS 'Security invoker view for monitoring Python crawler microservice exceptions';

-- -----------------------------------------------------------------------------
-- 3. Verification Queries
-- -----------------------------------------------------------------------------
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'error_telemetry_logs'
  AND indexname = 'idx_error_telemetry_logs_scraper';

SELECT count(*) AS total_scraper_errors
FROM public.v_scraper_error_telemetry;
