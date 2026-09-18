-- ==============================================================================
-- UPA-GURU Database Verification: End-to-End Extraction & Draft Insertion
-- File: draft-insertion-pipeline-verification-v1.sql
-- Associated Task: TASK-04020103
-- Description:
--   Verifies draft insertion integrity, foreign keys to pdf_documents/crawl_runs,
--   and validates priority review filtering (confidence/completeness < 0.85).
-- ==============================================================================

-- 1. Inspect recent drafts inserted by the AI extraction pipeline
SELECT 
    d.id AS draft_id,
    d.status,
    d.source_url,
    d.parsed_json->>'title' AS job_title,
    d.parsed_json->>'conducting_body' AS conducting_body,
    d.parsed_json->>'total_vacancies' AS vacancies,
    d.completeness_score,
    d.extraction_confidence_score,
    d.priority_review,
    d.is_corrigendum,
    d.validation_warnings,
    d.pdf_document_id,
    d.run_id,
    d.created_at
FROM public.draft_notifications d
ORDER BY d.created_at DESC
LIMIT 5;

-- 2. Validate HITL priority queue (< 0.85 threshold verification)
SELECT 
    id,
    parsed_json->>'title' AS title,
    completeness_score,
    extraction_confidence_score,
    priority_review,
    status
FROM public.draft_notifications
WHERE status = 'pending_review'
  AND (priority_review = TRUE OR completeness_score < 0.85 OR extraction_confidence_score < 0.85)
ORDER BY priority_review DESC, completeness_score ASC;

-- 3. Verify join consistency between drafts, pdf_documents, and crawl_runs
SELECT 
    d.id AS draft_id,
    d.status AS draft_status,
    p.file_name,
    p.file_size_bytes,
    p.page_count,
    c.portal_code,
    c.status AS crawl_status
FROM public.draft_notifications d
LEFT JOIN public.pdf_documents p ON d.pdf_document_id = p.id
LEFT JOIN public.crawl_runs c ON d.run_id = c.id
ORDER BY d.created_at DESC
LIMIT 5;
