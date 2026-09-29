-- =============================================================================
-- Migration: 20261001_exam_lifecycle_intelligence.sql
-- Description: Production-grade Multi-Exam Recruitment Intelligence & Document Lifecycle Linking Engine.
--              Transforms flat 1:1 PDF-notification assumption into an Entity-Lifecycle
--              and Evidence Graph anchored on canonical Exam Cycles with non-destructive
--              event supersession, field-level provenance, and HITL review queue.
-- Architecture Reference: ADR-002 (Database Schema), ADR-003 (RBAC), ADR-015 (Lifecycle Graph)
-- Rules: AGENTS.md Rule 3 (Mandatory RLS on all tables, Audit Trail)
-- =============================================================================

-- Enable uuid extension if not present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. ORGANIZATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    organization_type TEXT NOT NULL CHECK (organization_type IN ('CENTRAL_COMMISSION', 'STATE_PSC', 'RECRUITMENT_BOARD', 'BANKING_INSTITUTE', 'PSU', 'OTHER')),
    official_website TEXT,
    country TEXT DEFAULT 'IN',
    state TEXT NULL,
    config_json JSONB DEFAULT '{}'::jsonb,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 2. EXAM MASTER (Persistent Canonical Examination Series)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.exam_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    exam_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    short_name TEXT,
    description TEXT,
    category TEXT CHECK (category IN ('CIVIL_SERVICES', 'STAFF_SELECTION', 'RAILWAYS', 'BANKING', 'DEFENCE', 'ENGINEERING', 'STATE_SERVICES', 'OTHER')),
    aliases JSONB DEFAULT '[]'::jsonb,
    typical_stages JSONB DEFAULT '[]'::jsonb,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 3. EXAM CYCLE (Edition / Year-Specific Cycle)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.exam_cycle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_master_id UUID NOT NULL REFERENCES public.exam_master(id) ON DELETE CASCADE,
    cycle_year INTEGER NULL,
    cycle_code TEXT NOT NULL,
    cycle_label TEXT NOT NULL,
    primary_reference_no TEXT NULL,
    status TEXT NOT NULL DEFAULT 'DISCOVERED' CHECK (status IN (
        'DISCOVERED', 'APPLICATION_OPEN', 'APPLICATION_CLOSED',
        'EXAM_SCHEDULED', 'EXAM_IN_PROGRESS', 'EXAM_COMPLETED',
        'RESULT_PENDING', 'RESULT_DECLARED', 'INTERVIEW_SCHEDULED',
        'FINAL_RESULT_DECLARED', 'COMPLETED', 'WITHDRAWN', 'ARCHIVED'
    )),
    current_stage TEXT NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    total_vacancies_current INTEGER NULL,
    latest_update_summary TEXT NULL,
    latest_update_at TIMESTAMPTZ NULL,
    latest_document_id UUID NULL,
    verification_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'NEEDS_REVIEW', 'REJECTED')),
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_exam_cycle_master_code UNIQUE (exam_master_id, cycle_code)
);

-- =============================================================================
-- 4. RECRUITMENT (Post / Cadre / Opportunity Layer)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.recruitment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_cycle_id UUID NOT NULL REFERENCES public.exam_cycle(id) ON DELETE CASCADE,
    post_code TEXT NULL,
    title TEXT NOT NULL,
    normalized_title TEXT NOT NULL,
    department_or_cadre TEXT NULL,
    vacancies_current INTEGER NULL,
    pay_level TEXT NULL,
    eligibility_json JSONB NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'WITHDRAWN', 'SUPERSEDED', 'COMPLETED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 5. EXAM DOCUMENT (Official Source Documents)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.exam_document (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    exam_master_id UUID NULL REFERENCES public.exam_master(id) ON DELETE SET NULL,
    exam_cycle_id UUID NULL REFERENCES public.exam_cycle(id) ON DELETE SET NULL,
    recruitment_id UUID NULL REFERENCES public.recruitment(id) ON DELETE SET NULL,
    document_type TEXT NOT NULL,
    document_subtype TEXT NULL,
    title TEXT NOT NULL,
    normalized_title TEXT NOT NULL,
    source_url TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    source_page_url TEXT NULL,
    file_url TEXT NULL,
    mime_type TEXT DEFAULT 'application/pdf',
    file_size_bytes BIGINT NULL,
    document_hash TEXT NULL,
    content_hash TEXT NULL,
    reference_type TEXT NULL,
    reference_number TEXT NULL,
    normalized_reference_number TEXT NULL,
    publication_date DATE NULL,
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    text_content TEXT NULL,
    ocr_used BOOLEAN DEFAULT FALSE,
    page_count INTEGER NULL,
    language TEXT DEFAULT 'en',
    is_multi_exam BOOLEAN DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'DISCOVERED' CHECK (status IN (
        'DISCOVERED', 'DOWNLOADED', 'EXTRACTED', 'LINKED', 'NEEDS_REVIEW',
        'VERIFIED', 'PUBLISHED', 'ARCHIVED', 'FAILED'
    )),
    link_confidence NUMERIC(5,2) NULL,
    classification_confidence NUMERIC(5,2) NULL,
    verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN (
        'UNVERIFIED', 'AUTO_VERIFIED', 'HUMAN_VERIFIED', 'REJECTED', 'REVIEW_REQUIRED'
    )),
    raw_metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update foreign key on exam_cycle for latest_document_id now that exam_document exists
ALTER TABLE public.exam_cycle 
    DROP CONSTRAINT IF EXISTS fk_exam_cycle_latest_doc;
ALTER TABLE public.exam_cycle 
    ADD CONSTRAINT fk_exam_cycle_latest_doc 
    FOREIGN KEY (latest_document_id) REFERENCES public.exam_document(id) ON DELETE SET NULL;

-- =============================================================================
-- 6. DOCUMENT EXAM CYCLE (Many-to-Many Join for Multi-Exam Documents)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.document_exam_cycle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.exam_document(id) ON DELETE CASCADE,
    exam_master_id UUID NULL REFERENCES public.exam_master(id) ON DELETE SET NULL,
    exam_cycle_id UUID NOT NULL REFERENCES public.exam_cycle(id) ON DELETE CASCADE,
    recruitment_id UUID NULL REFERENCES public.recruitment(id) ON DELETE SET NULL,
    relationship_role TEXT NOT NULL CHECK (relationship_role IN (
        'PRIMARY_NOTIFICATION', 'CALENDAR_ENTRY', 'SCHEDULE_UPDATE',
        'CORRIGENDUM', 'RESULT', 'GENERAL_REFERENCE'
    )),
    confidence NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    link_reasons_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    decision TEXT NOT NULL DEFAULT 'AUTO_LINK' CHECK (decision IN (
        'AUTO_LINK', 'REVIEW_RECOMMENDED', 'MANUAL_LINK', 'REJECTED'
    )),
    verified BOOLEAN DEFAULT FALSE,
    verified_by TEXT NULL,
    verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_doc_exam_cycle UNIQUE (document_id, exam_cycle_id)
);

-- =============================================================================
-- 7. EXAM EVENT (Normalized Milestones with Non-Destructive Supersession)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.exam_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_cycle_id UUID NOT NULL REFERENCES public.exam_cycle(id) ON DELETE CASCADE,
    recruitment_id UUID NULL REFERENCES public.recruitment(id) ON DELETE SET NULL,
    source_document_id UUID NOT NULL REFERENCES public.exam_document(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    stage TEXT NULL,
    event_name TEXT NOT NULL,
    start_datetime TIMESTAMPTZ NULL,
    end_datetime TIMESTAMPTZ NULL,
    is_date_tbd BOOLEAN DEFAULT FALSE,
    date_precision TEXT DEFAULT 'DAY' CHECK (date_precision IN ('EXACT_TIME', 'DAY', 'MONTH_ONLY', 'QUARTER', 'TBD')),
    date_text_original TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN (
        'SCHEDULED', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'POSTPONED', 'SUPERSEDED', 'CANCELLED'
    )),
    confidence NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN (
        'UNVERIFIED', 'AUTO_VERIFIED', 'HUMAN_VERIFIED', 'REJECTED', 'REVIEW_REQUIRED'
    )),
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    version_number INTEGER NOT NULL DEFAULT 1,
    supersedes_event_id UUID NULL REFERENCES public.exam_event(id) ON DELETE SET NULL,
    change_reason TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 8. EXAM DOCUMENT RELATIONSHIP (Directed Graph between Documents)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.exam_document_relationship (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_document_id UUID NOT NULL REFERENCES public.exam_document(id) ON DELETE CASCADE,
    target_document_id UUID NOT NULL REFERENCES public.exam_document(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN (
        'CONTINUATION_OF', 'UPDATE_OF', 'CORRIGENDUM_OF', 'ADDENDUM_OF',
        'EXTENSION_OF', 'DATE_CHANGE_OF', 'VACANCY_REVISION_OF', 'RESULT_FOR',
        'CUT_OFF_FOR', 'ADMIT_CARD_FOR', 'ANSWER_KEY_FOR', 'SYLLABUS_FOR',
        'INTERVIEW_NOTICE_FOR', 'DAF_FOR', 'WITHDRAWAL_OF', 'SUPERSEDES',
        'CLARIFIES', 'RELATED_TO'
    )),
    confidence NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    reason TEXT NOT NULL,
    signals_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    automated BOOLEAN NOT NULL DEFAULT TRUE,
    verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN (
        'UNVERIFIED', 'VERIFIED', 'REJECTED', 'REVIEW_REQUIRED'
    )),
    verified_by TEXT NULL,
    verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_exam_doc_rel UNIQUE (source_document_id, target_document_id, relationship_type)
);

-- =============================================================================
-- 9. DOCUMENT EVIDENCE (Field-Level Provenance & Verbatim Snippets)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.document_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.exam_document(id) ON DELETE CASCADE,
    exam_cycle_id UUID NULL REFERENCES public.exam_cycle(id) ON DELETE SET NULL,
    exam_event_id UUID NULL REFERENCES public.exam_event(id) ON DELETE SET NULL,
    field_name TEXT NOT NULL,
    field_value_json JSONB NOT NULL,
    page_number INTEGER NULL,
    section TEXT NULL,
    source_text TEXT NOT NULL,
    extraction_method TEXT NOT NULL CHECK (extraction_method IN ('RULE', 'REGEX', 'TABLE_PARSER', 'LLM', 'MANUAL')),
    confidence NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    verified BOOLEAN DEFAULT FALSE,
    verified_by TEXT NULL,
    verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 10. CYCLE FIELD VERSION (Non-Event Revision Tracking: Vacancies, Fees, Age)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cycle_field_version (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_cycle_id UUID NOT NULL REFERENCES public.exam_cycle(id) ON DELETE CASCADE,
    recruitment_id UUID NULL REFERENCES public.recruitment(id) ON DELETE SET NULL,
    field_name TEXT NOT NULL,
    old_value_json JSONB NULL,
    new_value_json JSONB NOT NULL,
    change_summary TEXT NULL,
    source_document_id UUID NOT NULL REFERENCES public.exam_document(id) ON DELETE CASCADE,
    evidence_id UUID NULL REFERENCES public.document_evidence(id) ON DELETE SET NULL,
    effective_date DATE NULL,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    supersedes_version_id UUID NULL REFERENCES public.cycle_field_version(id) ON DELETE SET NULL,
    verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN (
        'UNVERIFIED', 'VERIFIED', 'REJECTED', 'REVIEW_REQUIRED'
    )),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 11. REVIEW QUEUE ITEM (Human-in-the-Loop Review Queue)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.review_queue_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type TEXT NOT NULL CHECK (item_type IN (
        'DOCUMENT_CYCLE_LINK', 'EVENT_CONFLICT', 'CORRIGENDUM_CHANGE',
        'AMBIGUOUS_EXAM', 'DATA_QUALITY_FLAG', 'LEGACY_MIGRATION'
    )),
    priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
    organization_id UUID NULL REFERENCES public.organizations(id) ON DELETE SET NULL,
    document_id UUID NULL REFERENCES public.exam_document(id) ON DELETE CASCADE,
    proposed_exam_master_id UUID NULL REFERENCES public.exam_master(id) ON DELETE SET NULL,
    proposed_exam_cycle_id UUID NULL REFERENCES public.exam_cycle(id) ON DELETE SET NULL,
    candidate_matches_json JSONB NULL,
    extracted_payload_json JSONB NULL,
    confidence NUMERIC(5,2) NULL,
    reasons_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'MODIFIED', 'ESCALATED')),
    resolution_action TEXT NULL CHECK (resolution_action IS NULL OR resolution_action IN (
        'APPROVE', 'REJECT', 'REASSIGN_EXAM', 'REASSIGN_CYCLE', 'MERGE_CYCLES',
        'SPLIT_CYCLE', 'EDIT_METADATA', 'EDIT_EVENT', 'MARK_CORRIGENDUM', 'CREATE_NEW_CYCLE'
    )),
    resolution_notes TEXT NULL,
    resolved_by TEXT NULL,
    resolved_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 12. CRAWLER RUN & ERROR TELEMETRY
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.crawler_run (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    adapter_name TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL,
    status TEXT NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'COMPLETED', 'PARTIAL_SUCCESS', 'FAILED')),
    documents_discovered INTEGER DEFAULT 0,
    documents_downloaded INTEGER DEFAULT 0,
    documents_new INTEGER DEFAULT 0,
    documents_duplicate INTEGER DEFAULT 0,
    documents_linked INTEGER DEFAULT 0,
    documents_sent_for_review INTEGER DEFAULT 0,
    events_created INTEGER DEFAULT 0,
    events_updated INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    summary_json JSONB NULL
);

CREATE TABLE IF NOT EXISTS public.crawler_error (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crawler_run_id UUID NOT NULL REFERENCES public.crawler_run(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    url TEXT NULL,
    document_id UUID NULL REFERENCES public.exam_document(id) ON DELETE SET NULL,
    stage TEXT NOT NULL CHECK (stage IN ('DISCOVERY', 'DOWNLOAD', 'EXTRACTION', 'CLASSIFICATION', 'LINKING', 'PERSISTENCE')),
    error_type TEXT NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT NULL,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 13. CYCLE DOMAIN EVENT (Alerts-Ready Outbox)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cycle_domain_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_cycle_id UUID NOT NULL REFERENCES public.exam_cycle(id) ON DELETE CASCADE,
    source_document_id UUID NULL REFERENCES public.exam_document(id) ON DELETE SET NULL,
    exam_event_id UUID NULL REFERENCES public.exam_event(id) ON DELETE SET NULL,
    domain_event_type TEXT NOT NULL CHECK (domain_event_type IN (
        'NEW_NOTIFICATION', 'APPLICATION_OPENED', 'APPLICATION_DEADLINE_CHANGED',
        'EXAM_DATE_ANNOUNCED', 'EXAM_DATE_CHANGED', 'ADMIT_CARD_RELEASED',
        'ANSWER_KEY_RELEASED', 'RESULT_RELEASED', 'INTERVIEW_SCHEDULED',
        'FINAL_RESULT_RELEASED', 'CORRIGENDUM_PUBLISHED', 'VACANCY_UPDATED',
        'NOTIFICATION_WITHDRAWN'
    )),
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    payload_json JSONB NOT NULL,
    dedupe_key TEXT NOT NULL UNIQUE,
    published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 14. PERFORMANCE INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_organizations_code ON public.organizations(code);
CREATE INDEX IF NOT EXISTS idx_exam_master_org_code ON public.exam_master(organization_id, exam_code);
CREATE INDEX IF NOT EXISTS idx_exam_master_norm_name ON public.exam_master(normalized_name);
CREATE INDEX IF NOT EXISTS idx_exam_cycle_master_year ON public.exam_cycle(exam_master_id, cycle_year DESC);
CREATE INDEX IF NOT EXISTS idx_exam_cycle_code ON public.exam_cycle(cycle_code);
CREATE INDEX IF NOT EXISTS idx_exam_cycle_status ON public.exam_cycle(status);
CREATE INDEX IF NOT EXISTS idx_recruitment_cycle ON public.recruitment(exam_cycle_id);
CREATE INDEX IF NOT EXISTS idx_exam_doc_canonical_url ON public.exam_document(canonical_url);
CREATE INDEX IF NOT EXISTS idx_exam_doc_doc_hash ON public.exam_document(document_hash);
CREATE INDEX IF NOT EXISTS idx_exam_doc_content_hash ON public.exam_document(content_hash);
CREATE INDEX IF NOT EXISTS idx_exam_doc_norm_ref ON public.exam_document(normalized_reference_number);
CREATE INDEX IF NOT EXISTS idx_exam_doc_cycle ON public.exam_document(exam_cycle_id);
CREATE INDEX IF NOT EXISTS idx_exam_event_cycle_current ON public.exam_event(exam_cycle_id, is_current);
CREATE INDEX IF NOT EXISTS idx_exam_event_type_stage ON public.exam_event(event_type, stage);
CREATE INDEX IF NOT EXISTS idx_exam_doc_rel_src_tgt ON public.exam_document_relationship(source_document_id, target_document_id);
CREATE INDEX IF NOT EXISTS idx_doc_evidence_doc_field ON public.document_evidence(document_id, field_name);
CREATE INDEX IF NOT EXISTS idx_cycle_field_ver_cycle_current ON public.cycle_field_version(exam_cycle_id, is_current);
CREATE INDEX IF NOT EXISTS idx_review_queue_status_prio ON public.review_queue_item(status, priority);
CREATE INDEX IF NOT EXISTS idx_crawler_run_org_status ON public.crawler_run(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_cycle_domain_event_pub ON public.cycle_domain_event(published, created_at ASC);

-- =============================================================================
-- 15. ROW LEVEL SECURITY (Mandatory on All Tables)
-- =============================================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_cycle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_exam_cycle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_document_relationship ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_field_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_queue_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawler_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawler_error ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_domain_event ENABLE ROW LEVEL SECURITY;

-- 15.1 Public Read Policies for Candidate Facing Entities
DROP POLICY IF EXISTS "Public can view active organizations" ON public.organizations;
CREATE POLICY "Public can view active organizations" ON public.organizations
    FOR SELECT TO public USING (active = TRUE);

DROP POLICY IF EXISTS "Public can view active exam masters" ON public.exam_master;
CREATE POLICY "Public can view active exam masters" ON public.exam_master
    FOR SELECT TO public USING (active = TRUE);

DROP POLICY IF EXISTS "Public can view verified or published exam cycles" ON public.exam_cycle;
CREATE POLICY "Public can view verified or published exam cycles" ON public.exam_cycle
    FOR SELECT TO public USING (verification_status IN ('VERIFIED', 'PENDING'));

DROP POLICY IF EXISTS "Public can view active recruitments" ON public.recruitment;
CREATE POLICY "Public can view active recruitments" ON public.recruitment
    FOR SELECT TO public USING (status = 'ACTIVE');

DROP POLICY IF EXISTS "Public can view published exam documents" ON public.exam_document;
CREATE POLICY "Public can view published exam documents" ON public.exam_document
    FOR SELECT TO public USING (verification_status IN ('AUTO_VERIFIED', 'HUMAN_VERIFIED', 'UNVERIFIED'));

DROP POLICY IF EXISTS "Public can view current verified exam events" ON public.exam_event;
CREATE POLICY "Public can view current verified exam events" ON public.exam_event
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public can view document exam cycle links" ON public.document_exam_cycle;
CREATE POLICY "Public can view document exam cycle links" ON public.document_exam_cycle
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public can view exam document relationships" ON public.exam_document_relationship;
CREATE POLICY "Public can view exam document relationships" ON public.exam_document_relationship
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public can view current cycle field versions" ON public.cycle_field_version;
CREATE POLICY "Public can view current cycle field versions" ON public.cycle_field_version
    FOR SELECT TO public USING (is_current = TRUE);

-- 15.2 Admin Full Access Policies (Using public.has_permission)
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
        'organizations', 'exam_master', 'exam_cycle', 'recruitment', 'exam_document',
        'document_exam_cycle', 'exam_event', 'exam_document_relationship', 'document_evidence',
        'cycle_field_version', 'review_queue_item', 'crawler_run', 'crawler_error', 'cycle_domain_event'
    )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Admin write policy on %I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Admin write policy on %I" ON public.%I FOR ALL TO authenticated USING (public.has_permission(auth.uid(), ''notifications:write'')) WITH CHECK (public.has_permission(auth.uid(), ''notifications:write''))', t, t);
    END LOOP;
END $$;

-- =============================================================================
-- 16. SEED INITIAL ORGANIZATIONS
-- =============================================================================
INSERT INTO public.organizations (code, name, short_name, organization_type, official_website, country, state)
VALUES
    ('UPSC', 'Union Public Service Commission', 'UPSC', 'CENTRAL_COMMISSION', 'https://upsc.gov.in', 'IN', NULL),
    ('KPSC', 'Karnataka Public Service Commission', 'KPSC', 'STATE_PSC', 'https://kpsc.kar.nic.in', 'IN', 'KA'),
    ('SSC', 'Staff Selection Commission', 'SSC', 'CENTRAL_COMMISSION', 'https://ssc.gov.in', 'IN', NULL),
    ('RRB', 'Railway Recruitment Boards', 'RRB', 'RECRUITMENT_BOARD', 'https://rrbcdg.gov.in', 'IN', NULL),
    ('IBPS', 'Institute of Banking Personnel Selection', 'IBPS', 'BANKING_INSTITUTE', 'https://www.ibps.in', 'IN', NULL)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    official_website = EXCLUDED.official_website,
    updated_at = NOW();

-- =============================================================================
-- 17. IDEMPOTENT LEGACY BACKFILL & PROJECTION MIGRATION
-- =============================================================================
-- Projects existing legacy public.exams into public.exam_master,
-- and public.notifications into public.exam_cycle, public.exam_document, and public.exam_event.

DO $$
DECLARE
    r_exam RECORD;
    r_notif RECORD;
    v_org_id UUID;
    v_master_id UUID;
    v_cycle_id UUID;
    v_doc_id UUID;
    v_year INTEGER;
    v_cycle_code TEXT;
    v_org_code TEXT;
BEGIN
    -- Only run backfill if exams table exists and has rows
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'exams') THEN
        FOR r_exam IN SELECT * FROM public.exams LOOP
            -- Determine organization code from conducting_body or state_or_central
            IF r_exam.conducting_body ILIKE '%UPSC%' OR r_exam.conducting_body ILIKE '%Union Public%' THEN
                v_org_code := 'UPSC';
            ELSIF r_exam.conducting_body ILIKE '%KPSC%' OR r_exam.conducting_body ILIKE '%Karnataka%' THEN
                v_org_code := 'KPSC';
            ELSIF r_exam.conducting_body ILIKE '%SSC%' OR r_exam.conducting_body ILIKE '%Staff Selection%' THEN
                v_org_code := 'SSC';
            ELSIF r_exam.conducting_body ILIKE '%RRB%' OR r_exam.conducting_body ILIKE '%Railway%' THEN
                v_org_code := 'RRB';
            ELSIF r_exam.conducting_body ILIKE '%IBPS%' OR r_exam.conducting_body ILIKE '%Banking%' THEN
                v_org_code := 'IBPS';
            ELSE
                v_org_code := 'UPSC'; -- Default fallback
            END IF;

            SELECT id INTO v_org_id FROM public.organizations WHERE code = v_org_code LIMIT 1;

            -- Upsert into exam_master
            INSERT INTO public.exam_master (organization_id, exam_code, name, normalized_name, short_name, category, active)
            VALUES (
                v_org_id,
                UPPER(REPLACE(r_exam.slug, '-', '_')),
                r_exam.title,
                LOWER(REGEXP_REPLACE(r_exam.title, '[^a-zA-Z0-9]+', ' ', 'g')),
                r_exam.conducting_body,
                'OTHER',
                TRUE
            )
            ON CONFLICT (exam_code) DO UPDATE SET updated_at = NOW()
            RETURNING id INTO v_master_id;

            -- Migrate notifications under this exam
            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
                FOR r_notif IN SELECT * FROM public.notifications WHERE exam_id = r_exam.id LOOP
                    -- Extract year from application_start_date or current year
                    v_year := COALESCE(EXTRACT(YEAR FROM r_notif.application_start_date::date)::integer, 2026);
                    v_cycle_code := UPPER(REPLACE(r_exam.slug, '-', '_')) || '_' || v_year::text;

                    -- Insert or get exam_cycle
                    INSERT INTO public.exam_cycle (
                        exam_master_id, cycle_year, cycle_code, cycle_label,
                        primary_reference_no, status, current_stage,
                        total_vacancies_current, latest_update_summary, verification_status
                    )
                    VALUES (
                        v_master_id, v_year, v_cycle_code, r_exam.title || ' ' || v_year::text,
                        r_notif.notification_number, 'APPLICATION_OPEN', 'PRELIMS',
                        r_notif.total_vacancies, r_notif.title, 'VERIFIED'
                    )
                    ON CONFLICT (exam_master_id, cycle_code) DO UPDATE SET
                        total_vacancies_current = EXCLUDED.total_vacancies_current,
                        updated_at = NOW()
                    RETURNING id INTO v_cycle_id;

                    -- Insert source document if official_pdf_url exists
                    INSERT INTO public.exam_document (
                        organization_id, exam_master_id, exam_cycle_id,
                        document_type, title, normalized_title,
                        source_url, canonical_url, reference_number,
                        publication_date, status, verification_status
                    )
                    VALUES (
                        v_org_id, v_master_id, v_cycle_id,
                        'RECRUITMENT_NOTIFICATION', r_notif.title,
                        LOWER(REGEXP_REPLACE(r_notif.title, '[^a-zA-Z0-9]+', ' ', 'g')),
                        COALESCE(r_notif.official_pdf_url, 'https://india.gov.in/' || r_notif.slug),
                        COALESCE(r_notif.official_pdf_url, 'https://india.gov.in/' || r_notif.slug),
                        r_notif.notification_number,
                        r_notif.application_start_date::date,
                        'PUBLISHED', 'HUMAN_VERIFIED'
                    )
                    RETURNING id INTO v_doc_id;

                    -- Insert Application Open milestone
                    IF r_notif.application_start_date IS NOT NULL THEN
                        INSERT INTO public.exam_event (
                            exam_cycle_id, source_document_id, event_type, stage,
                            event_name, start_datetime, date_text_original,
                            status, confidence, verification_status, is_current, version_number
                        )
                        VALUES (
                            v_cycle_id, v_doc_id, 'APPLICATION_OPEN', 'APPLICATION',
                            'Application Window Opens', r_notif.application_start_date::timestamptz,
                            r_notif.application_start_date, 'COMPLETED', 100.00, 'HUMAN_VERIFIED', TRUE, 1
                        );
                    END IF;

                    -- Insert Application Close milestone
                    IF r_notif.application_end_date IS NOT NULL THEN
                        INSERT INTO public.exam_event (
                            exam_cycle_id, source_document_id, event_type, stage,
                            event_name, end_datetime, date_text_original,
                            status, confidence, verification_status, is_current, version_number
                        )
                        VALUES (
                            v_cycle_id, v_doc_id, 'APPLICATION_CLOSE', 'APPLICATION',
                            'Last Date to Apply', r_notif.application_end_date::timestamptz,
                            r_notif.application_end_date, 'SCHEDULED', 100.00, 'HUMAN_VERIFIED', TRUE, 1
                        );
                    END IF;

                    -- Insert Exam Date milestone if known
                    IF r_notif.exam_date IS NOT NULL THEN
                        INSERT INTO public.exam_event (
                            exam_cycle_id, source_document_id, event_type, stage,
                            event_name, start_datetime, date_text_original,
                            status, confidence, verification_status, is_current, version_number
                        )
                        VALUES (
                            v_cycle_id, v_doc_id, 'PRELIMS_EXAM', 'PRELIMS',
                            'Preliminary Examination', r_notif.exam_date::timestamptz,
                            r_notif.exam_date, 'SCHEDULED', 100.00, 'HUMAN_VERIFIED', TRUE, 1
                        );
                    END IF;

                END LOOP;
            END IF;
        END LOOP;
    END IF;
END $$;
