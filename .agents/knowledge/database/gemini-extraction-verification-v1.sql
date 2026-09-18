-- ==============================================================================
-- UPA-GURU Database Verification: Gemini Structured Extraction & Confidence Scoring
-- File: gemini-extraction-verification-v1.sql
-- Associated Task: TASK-04020102
-- Description:
--   Verifies draft_notifications fields populated by Gemini extraction engine,
--   including completeness scoring, validation warnings, and priority review triage.
-- ==============================================================================

-- 1. Inspect draft_notifications structure for Gemini extraction telemetry
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default 
FROM information_schema.columns 
WHERE table_name = 'draft_notifications' 
  AND column_name IN (
      'parsed_json', 
      'raw_text', 
      'extraction_confidence_score', 
      'completeness_score', 
      'validation_warnings', 
      'priority_review',
      'extraction_model',
      'prompt_version'
  )
ORDER BY column_name;

-- 2. Query simulated priority review queue based on completeness and corrigendum status
SELECT 
    id,
    parsed_json->>'title' AS title,
    parsed_json->>'conducting_body' AS conducting_body,
    extraction_model,
    completeness_score,
    extraction_confidence_score,
    priority_review,
    is_corrigendum,
    validation_warnings,
    status,
    created_at
FROM public.draft_notifications
WHERE status = 'pending_review'
  AND (priority_review = TRUE OR completeness_score < 0.70 OR is_corrigendum = TRUE)
ORDER BY priority_review DESC, completeness_score ASC, created_at DESC
LIMIT 10;

-- 3. Aggregated completeness metric check (validates distribution once populated)
SELECT 
    COALESCE(extraction_model, 'unknown') AS model,
    COUNT(*) AS total_drafts,
    ROUND(AVG(completeness_score)::numeric, 3) AS avg_completeness,
    ROUND(AVG(extraction_confidence_score)::numeric, 3) AS avg_confidence,
    COUNT(*) FILTER (WHERE priority_review = TRUE) AS total_flagged_for_priority
FROM public.draft_notifications
GROUP BY extraction_model;
