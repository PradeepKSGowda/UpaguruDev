-- =============================================================================
-- Migration: 20261003_complete_exam_lifecycle_engine.sql
-- Description: Complete Exam Lifecycle, Notification Linking & Dynamic Admin Form Engine.
--              Implements master notification taxonomy, dynamic form configuration,
--              organization-specific stage definitions, crawler run telemetry, and
--              strict non-destructive lifecycle event versioning.
-- Architecture Reference: ADR-002, ADR-003 (RBAC), ADR-015 (Lifecycle Graph)
-- Rules: AGENTS.md Rule 3 (Mandatory RLS, Audit Trail)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. NOTIFICATION TYPES (Configurable Master Taxonomy)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notification_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK (category IN (
        'INITIAL_RECRUITMENT',
        'APPLICATION',
        'VACANCY',
        'ELIGIBILITY',
        'SYLLABUS_EXAM_SCHEME',
        'EXAM_SCHEDULE',
        'INTIMATION',
        'ADMIT_CARD',
        'ANSWER_KEY',
        'RESPONSE_SHEET',
        'RESULT',
        'CUT_OFF',
        'SCORECARD_MARKS',
        'MERIT_RANK_LIST',
        'INTERVIEW',
        'SKILL_TEST',
        'PHYSICAL_TEST',
        'DOCUMENT_VERIFICATION',
        'MEDICAL_EXAM',
        'ALLOTMENT',
        'APPOINTMENT_JOINING',
        'CORRIGENDUM_GENERAL',
        'CANCELLATION_WITHDRAWAL',
        'OTHER'
    )),
    label TEXT NOT NULL,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('CREATE', 'UPDATE')),
    requires_existing_exam BOOLEAN NOT NULL DEFAULT TRUE,
    requires_stage BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    icon_name TEXT DEFAULT 'FileText',
    badge_color TEXT DEFAULT 'blue',
    display_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 2. NOTIFICATION TYPE FIELDS (Dynamic Form Field Definitions)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notification_type_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_type_code TEXT NOT NULL REFERENCES public.notification_types(code) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    field_label TEXT NOT NULL,
    field_type TEXT NOT NULL CHECK (field_type IN (
        'text', 'number', 'date', 'datetime', 'url', 'textarea', 'select', 'boolean', 'file'
    )),
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    placeholder TEXT,
    helper_text TEXT,
    default_value JSONB,
    options_json JSONB, -- For select dropdown options: [{"label": "...", "value": "..."}]
    conditional_on_field TEXT, -- Name of field this depends on
    conditional_value JSONB,   -- Value that triggers visibility
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_notif_field UNIQUE (notification_type_code, field_name)
);

-- =============================================================================
-- 3. STAGE DEFINITIONS (Organization-Specific Stage Hierarchy)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.stage_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_code TEXT NOT NULL, -- e.g. UPSC, KPSC, SSC, RRB, IBPS, or ALL
    exam_category TEXT NULL,         -- e.g. CIVIL_SERVICES, RAILWAYS, STAFF_SELECTION
    stage_code TEXT NOT NULL,
    stage_label TEXT NOT NULL,
    stage_order INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_stage_org_code UNIQUE (organization_code, stage_code)
);

-- =============================================================================
-- 4. CRAWLER RUNS & ERRORS (Observability & Health Telemetry)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.crawler_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_code TEXT NOT NULL,
    adapter_name TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED')),
    documents_discovered INTEGER NOT NULL DEFAULT 0,
    documents_downloaded INTEGER NOT NULL DEFAULT 0,
    documents_linked INTEGER NOT NULL DEFAULT 0,
    reviews_queued INTEGER NOT NULL DEFAULT 0,
    errors_count INTEGER NOT NULL DEFAULT 0,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crawler_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES public.crawler_runs(id) ON DELETE CASCADE,
    organization_code TEXT NOT NULL,
    source_url TEXT,
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    payload_snippet JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 5. PERFORMANCE INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_notif_types_category ON public.notification_types(category);
CREATE INDEX IF NOT EXISTS idx_notif_types_operation ON public.notification_types(operation_type);
CREATE INDEX IF NOT EXISTS idx_notif_type_fields_code ON public.notification_type_fields(notification_type_code);
CREATE INDEX IF NOT EXISTS idx_stage_defs_org ON public.stage_definitions(organization_code);
CREATE INDEX IF NOT EXISTS idx_crawler_runs_org_status ON public.crawler_runs(organization_code, status);
CREATE INDEX IF NOT EXISTS idx_crawler_errors_run ON public.crawler_errors(run_id);

-- =============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
ALTER TABLE public.notification_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_type_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawler_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawler_errors ENABLE ROW LEVEL SECURITY;

-- Public/Authenticated read policies for taxonomy & stages
CREATE POLICY "Public Read Notification Types" ON public.notification_types
    FOR SELECT USING (active = TRUE);

CREATE POLICY "Public Read Notification Type Fields" ON public.notification_type_fields
    FOR SELECT USING (TRUE);

CREATE POLICY "Public Read Stage Definitions" ON public.stage_definitions
    FOR SELECT USING (active = TRUE);

-- Admin & Service Role write access for all metadata tables
CREATE POLICY "Admin Full Access Notification Types" ON public.notification_types
    FOR ALL USING (
        auth.role() = 'service_role' OR
        auth.jwt() -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
    )
    WITH CHECK (
        auth.role() = 'service_role' OR
        auth.jwt() -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
    );

CREATE POLICY "Admin Full Access Notification Type Fields" ON public.notification_type_fields
    FOR ALL USING (
        auth.role() = 'service_role' OR
        auth.jwt() -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
    )
    WITH CHECK (
        auth.role() = 'service_role' OR
        auth.jwt() -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
    );

CREATE POLICY "Admin Full Access Stage Definitions" ON public.stage_definitions
    FOR ALL USING (
        auth.role() = 'service_role' OR
        auth.jwt() -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
    )
    WITH CHECK (
        auth.role() = 'service_role' OR
        auth.jwt() -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
    );

CREATE POLICY "Admin Full Access Crawler Runs" ON public.crawler_runs
    FOR ALL USING (
        auth.role() = 'service_role' OR
        auth.jwt() -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
    )
    WITH CHECK (
        auth.role() = 'service_role' OR
        auth.jwt() -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
    );

CREATE POLICY "Admin Full Access Crawler Errors" ON public.crawler_errors
    FOR ALL USING (
        auth.role() = 'service_role' OR
        auth.jwt() -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
    )
    WITH CHECK (
        auth.role() = 'service_role' OR
        auth.jwt() -> 'app_metadata' ->> 'role' IN ('admin', 'super_admin')
    );

-- =============================================================================
-- 7. SEED DATA: MASTER NOTIFICATION TAXONOMY
-- =============================================================================

INSERT INTO public.notification_types (code, category, label, operation_type, requires_existing_exam, requires_stage, description, icon_name, badge_color, display_order)
VALUES
    -- A. INITIAL / RECRUITMENT
    ('FIRST_NOTIFICATION', 'INITIAL_RECRUITMENT', 'First / Original Notification', 'CREATE', FALSE, FALSE, 'Original comprehensive recruitment advertisement initiating a new examination cycle.', 'Sparkles', 'emerald', 10),
    ('RECRUITMENT_NOTIFICATION', 'INITIAL_RECRUITMENT', 'Recruitment Notification (Direct)', 'CREATE', FALSE, FALSE, 'Direct recruitment opening or vacancy circular.', 'Briefcase', 'emerald', 20),
    ('EXAM_SCHEME', 'INITIAL_RECRUITMENT', 'Examination Scheme / Pattern Notice', 'UPDATE', TRUE, FALSE, 'Detailed scheme of examination and marking breakdown.', 'LayoutList', 'blue', 30),

    -- B. APPLICATION
    ('APPLICATION_OPEN', 'APPLICATION', 'Application Window Open', 'UPDATE', TRUE, FALSE, 'Commencement of online application submission.', 'Send', 'indigo', 100),
    ('APPLICATION_EXTENSION', 'APPLICATION', 'Application Deadline Extension', 'UPDATE', TRUE, FALSE, 'Official notice extending the last date for online application submission.', 'CalendarClock', 'amber', 110),
    ('APPLICATION_CORRECTION_WINDOW', 'APPLICATION', 'Application Correction Window', 'UPDATE', TRUE, FALSE, 'Opening of modification/correction window for candidate profile/form.', 'Edit3', 'cyan', 120),
    ('APPLICATION_CORRECTION_EXTENSION', 'APPLICATION', 'Correction Window Extension', 'UPDATE', TRUE, FALSE, 'Extension of the application correction/modification deadline.', 'CalendarClock', 'amber', 130),
    ('APPLICATION_REOPENED', 'APPLICATION', 'Application Window Re-opened', 'UPDATE', TRUE, FALSE, 'Re-opening of application registration portal.', 'RotateCcw', 'amber', 140),
    ('APPLICATION_WITHDRAWAL', 'APPLICATION', 'Application Withdrawal Window', 'UPDATE', TRUE, FALSE, 'Window allowing candidates to withdraw their submitted application.', 'UserX', 'rose', 150),
    ('APPLICATION_FEE_NOTICE', 'APPLICATION', 'Application Fee Notice', 'UPDATE', TRUE, FALSE, 'Notification concerning examination fees, challan submission, or payment deadlines.', 'CreditCard', 'blue', 160),

    -- C. VACANCY
    ('VACANCY_ANNOUNCED', 'VACANCY', 'Initial Vacancies Announced', 'UPDATE', TRUE, FALSE, 'Official announcement of cadre/post breakdown of vacancies.', 'Users', 'blue', 200),
    ('VACANCY_REVISED', 'VACANCY', 'Vacancies Revised', 'UPDATE', TRUE, FALSE, 'Modification of total vacancy count (increase, decrease, or re-allocation).', 'TrendingUp', 'amber', 210),
    ('VACANCY_INCREASED', 'VACANCY', 'Vacancies Increased', 'UPDATE', TRUE, FALSE, 'Addition of more posts/vacancies to existing recruitment.', 'ArrowUpCircle', 'emerald', 220),
    ('VACANCY_DECREASED', 'VACANCY', 'Vacancies Decreased', 'UPDATE', TRUE, FALSE, 'Reduction of vacancy count by commissioning department.', 'ArrowDownCircle', 'rose', 230),

    -- D. ELIGIBILITY
    ('ELIGIBILITY_UPDATE', 'ELIGIBILITY', 'Eligibility Criteria Update', 'UPDATE', TRUE, FALSE, 'Official update to nationality, domicile, experience, or reservations.', 'ShieldCheck', 'violet', 300),
    ('AGE_LIMIT_UPDATE', 'ELIGIBILITY', 'Age Limit / Relaxation Revision', 'UPDATE', TRUE, FALSE, 'Revision of cutoff dates or relaxation for specific candidate categories.', 'Clock', 'violet', 310),
    ('QUALIFICATION_UPDATE', 'ELIGIBILITY', 'Educational Qualification Revision', 'UPDATE', TRUE, FALSE, 'Corrigendum on recognized degrees or equivalent qualifications.', 'GraduationCap', 'violet', 320),

    -- E. SYLLABUS / EXAM SCHEME
    ('SYLLABUS_RELEASED', 'SYLLABUS_EXAM_SCHEME', 'Syllabus Released', 'UPDATE', TRUE, FALSE, 'Official release of detailed stage-wise examination syllabus.', 'BookOpen', 'purple', 400),
    ('SYLLABUS_REVISED', 'SYLLABUS_EXAM_SCHEME', 'Syllabus Revised', 'UPDATE', TRUE, FALSE, 'Non-destructive revision or corrigendum to examination topics.', 'BookCheck', 'purple', 410),

    -- F. EXAM SCHEDULE
    ('EXAM_DATE_ANNOUNCED', 'EXAM_SCHEDULE', 'Exam Date Announced', 'UPDATE', TRUE, TRUE, 'Official declaration of examination date(s) for a specific stage.', 'Calendar', 'blue', 500),
    ('EXAM_DATE_REVISED', 'EXAM_SCHEDULE', 'Exam Date Revised', 'UPDATE', TRUE, TRUE, 'Rescheduling of examination dates.', 'CalendarCheck', 'amber', 510),
    ('EXAM_DATE_POSTPONED', 'EXAM_SCHEDULE', 'Exam Postponed', 'UPDATE', TRUE, TRUE, 'Official deferral of scheduled examination with or without new dates.', 'CalendarX', 'rose', 520),
    ('EXAM_DATE_CANCELLED', 'EXAM_SCHEDULE', 'Exam Session Cancelled', 'UPDATE', TRUE, TRUE, 'Cancellation of scheduled exam shift/session.', 'AlertTriangle', 'rose', 530),

    -- G. INTIMATION / VENUE
    ('CITY_INTIMATION_RELEASED', 'INTIMATION', 'City Intimation Slip Released', 'UPDATE', TRUE, TRUE, 'Pre-admit card intimation of examination city allotment.', 'MapPin', 'sky', 600),
    ('EXAM_CENTRE_NOTICE', 'INTIMATION', 'Exam Centre / Venue Change Notice', 'UPDATE', TRUE, TRUE, 'Corrigendum regarding venue relocation or exam centre changes.', 'Building2', 'sky', 610),

    -- H. ADMIT CARD / HALL TICKET
    ('ADMIT_CARD_RELEASED', 'ADMIT_CARD', 'Admit Card / Hall Ticket Released', 'UPDATE', TRUE, TRUE, 'Official release of hall tickets / admit cards for online download.', 'Ticket', 'emerald', 700),
    ('ADMIT_CARD_REVISED', 'ADMIT_CARD', 'Revised Admit Card Issued', 'UPDATE', TRUE, TRUE, 'Re-issued admit cards due to venue changes or technical corrections.', 'RefreshCw', 'amber', 710),

    -- I. ANSWER KEY LIFECYCLE
    ('ANSWER_KEY_PROVISIONAL', 'ANSWER_KEY', 'Provisional Answer Key Released', 'UPDATE', TRUE, TRUE, 'Release of primary tentative answer key for candidate scrutiny.', 'Key', 'indigo', 800),
    ('ANSWER_KEY_OBJECTION_WINDOW', 'ANSWER_KEY', 'Answer Key Objection Window', 'UPDATE', TRUE, TRUE, 'Window for candidates to submit challenges/objections with fee.', 'HelpCircle', 'amber', 810),
    ('ANSWER_KEY_FINAL', 'ANSWER_KEY', 'Final Answer Key Declared', 'UPDATE', TRUE, TRUE, 'Final verified answer key after reviewing expert objections.', 'KeyRound', 'emerald', 820),

    -- J. RESPONSE SHEET
    ('RESPONSE_SHEET_RELEASED', 'RESPONSE_SHEET', 'Candidate Response Sheet Released', 'UPDATE', TRUE, TRUE, 'Release of candidate marked responses along with question paper.', 'FileSpreadsheet', 'teal', 900),

    -- K. RESULT LIFECYCLE
    ('RESULT_RELEASED', 'RESULT', 'Stage / Written Exam Result', 'UPDATE', TRUE, TRUE, 'Declaration of roll numbers / names of qualified candidates.', 'Award', 'emerald', 1000),
    ('FINAL_RESULT', 'RESULT', 'Final Merit / Selection Result', 'UPDATE', TRUE, TRUE, 'Final selection list concluding the recruitment cycle.', 'Trophy', 'emerald', 1010),

    -- L. CUT-OFF
    ('CUT_OFF_RELEASED', 'CUT_OFF', 'Category-wise Cut-off Marks', 'UPDATE', TRUE, TRUE, 'Minimum qualifying marks across General, OBC, SC, ST, EWS categories.', 'BarChart2', 'blue', 1100),

    -- M. SCORECARD / MARKS
    ('SCORECARD_RELEASED', 'SCORECARD_MARKS', 'Candidate Scorecard / Marks Link', 'UPDATE', TRUE, TRUE, 'Individual candidate scorecards / marks breakdown portal.', 'CheckSquare', 'blue', 1200),

    -- N. INTERVIEW / PERSONALITY TEST
    ('INTERVIEW_SCHEDULE', 'INTERVIEW', 'Interview / Personality Test Schedule', 'UPDATE', TRUE, TRUE, 'Dates, reporting time, and venue for interview/personality test round.', 'UsersRound', 'violet', 1300),
    ('INTERVIEW_CALL_LETTER', 'INTERVIEW', 'Interview Call Letter Released', 'UPDATE', TRUE, TRUE, 'Download link for interview / viva-voce admit card.', 'MailCheck', 'emerald', 1310),

    -- O. DOCUMENT VERIFICATION & MEDICAL
    ('DOCUMENT_VERIFICATION_NOTICE', 'DOCUMENT_VERIFICATION', 'Document Verification (DV) Notice', 'UPDATE', TRUE, TRUE, 'Schedule, reporting venue, and checklist of certificates for DV.', 'FileCheck', 'cyan', 1400),
    ('MEDICAL_EXAMINATION_NOTICE', 'MEDICAL_EXAM', 'Medical Examination Schedule', 'UPDATE', TRUE, TRUE, 'Schedule for candidate medical fitness verification.', 'HeartPulse', 'rose', 1450),

    -- P. ALLOTMENT & APPOINTMENT
    ('SERVICE_ALLOCATION', 'ALLOTMENT', 'Service / Cadre Allocation List', 'UPDATE', TRUE, FALSE, 'Cadre or department allotment of recommended candidates.', 'Layers', 'blue', 1500),
    ('JOINING_NOTICE', 'APPOINTMENT_JOINING', 'Appointment / Joining Notice', 'UPDATE', TRUE, FALSE, 'Instructions for final joining and oath administration.', 'CheckCheck', 'emerald', 1550),

    -- Q. CORRIGENDUM / NOTICE
    ('CORRIGENDUM', 'CORRIGENDUM_GENERAL', 'Official Corrigendum / Amendment', 'UPDATE', TRUE, FALSE, 'Official corrigendum rectifying or amending one or more terms.', 'FileCode', 'amber', 1600),
    ('IMPORTANT_NOTICE', 'CORRIGENDUM_GENERAL', 'Important Notice / Clarification', 'UPDATE', TRUE, FALSE, 'Commission circular, general clarification, or press release.', 'Info', 'blue', 1610),

    -- R. CANCELLATION
    ('RECRUITMENT_CANCELLED', 'CANCELLATION_WITHDRAWAL', 'Recruitment / Examination Cancelled', 'UPDATE', TRUE, FALSE, 'Complete or partial withdrawal/scrapping of recruitment cycle.', 'Ban', 'rose', 1700),
    ('OTHER', 'OTHER', 'Other Official Communication', 'UPDATE', TRUE, FALSE, 'Unclassified circular requiring human classification and tagging.', 'HelpCircle', 'slate', 1800)
ON CONFLICT (code) DO UPDATE SET
    category = EXCLUDED.category,
    label = EXCLUDED.label,
    operation_type = EXCLUDED.operation_type,
    requires_existing_exam = EXCLUDED.requires_existing_exam,
    requires_stage = EXCLUDED.requires_stage,
    description = EXCLUDED.description,
    icon_name = EXCLUDED.icon_name,
    badge_color = EXCLUDED.badge_color,
    display_order = EXCLUDED.display_order;

-- =============================================================================
-- 8. SEED DATA: ORGANIZATION STAGE DEFINITIONS
-- =============================================================================

-- UPSC Stages
INSERT INTO public.stage_definitions (organization_code, stage_code, stage_label, stage_order, description) VALUES
    ('UPSC', 'PRELIMS', 'Preliminary Examination (Objective)', 1, 'Screening round consisting of GS Paper I and CSAT Paper II'),
    ('UPSC', 'MAINS', 'Main Examination (Written Descriptive)', 2, 'Nine descriptive essay and optional papers'),
    ('UPSC', 'INTERVIEW', 'Personality Test / Interview', 3, 'Board interview in Dholpur House, New Delhi'),
    ('UPSC', 'FINAL_SELECTION', 'Final Recommendation / Allocation', 4, 'Final merit list based on Mains + Personality Test scores')
ON CONFLICT (organization_code, stage_code) DO NOTHING;

-- SSC Stages
INSERT INTO public.stage_definitions (organization_code, stage_code, stage_label, stage_order, description) VALUES
    ('SSC', 'TIER_1', 'Tier-I Examination (Computer-Based Test)', 1, 'Objective MCQ screening round'),
    ('SSC', 'TIER_2', 'Tier-II Examination (Computer-Based Test)', 2, 'Main scoring written examination'),
    ('SSC', 'SKILL_TEST', 'Skill / Typing / Data Entry Test', 3, 'Qualifying computer proficiency or typing speed test'),
    ('SSC', 'DOCUMENT_VERIFICATION', 'Document Verification', 4, 'Verification of original credentials by user departments'),
    ('SSC', 'FINAL_SELECTION', 'Final Selection / Allotment', 5, 'Merit rank allocation')
ON CONFLICT (organization_code, stage_code) DO NOTHING;

-- RRB Stages
INSERT INTO public.stage_definitions (organization_code, stage_code, stage_label, stage_order, description) VALUES
    ('RRB', 'CBT_1', '1st Stage CBT (Computer-Based Screening)', 1, 'Common screening test'),
    ('RRB', 'CBT_2', '2nd Stage CBT (Technical / Post Specific)', 2, 'Scoring CBT examination'),
    ('RRB', 'CBAT', 'Computer-Based Aptitude Test (CBAT/AT)', 3, 'Aptitude test for Station Master / Traffic Assistant'),
    ('RRB', 'TYPING_TEST', 'Typing Skill Test', 4, 'Typing test for Clerks and Typist posts'),
    ('RRB', 'PET', 'Physical Efficiency Test (PET)', 5, 'Physical fitness screening for level 1 / safety posts'),
    ('RRB', 'DOCUMENT_VERIFICATION', 'Document Verification & Empanelment', 6, 'Verification of certificates'),
    ('RRB', 'MEDICAL_EXAM', 'Comprehensive Railway Medical Exam', 7, 'Railway hospital fitness standards (A1, A2, B1, etc.)')
ON CONFLICT (organization_code, stage_code) DO NOTHING;

-- IBPS Stages
INSERT INTO public.stage_definitions (organization_code, stage_code, stage_label, stage_order, description) VALUES
    ('IBPS', 'PRELIMS', 'Preliminary Online Examination', 1, 'Speed test in Reasoning, Quant, and English'),
    ('IBPS', 'MAINS', 'Main Online Examination', 2, 'In-depth scoring test including descriptive section'),
    ('IBPS', 'INTERVIEW', 'Common Interview Process', 3, 'Coordinated interview by participating banks'),
    ('IBPS', 'PROVISIONAL_ALLOTMENT', 'Provisional Allotment', 4, 'Allocation to participating public sector banks')
ON CONFLICT (organization_code, stage_code) DO NOTHING;

-- KPSC Stages
INSERT INTO public.stage_definitions (organization_code, stage_code, stage_label, stage_order, description) VALUES
    ('KPSC', 'PRELIMS', 'Preliminary Examination (Objective)', 1, 'General studies screening papers'),
    ('KPSC', 'MAINS', 'Main Written Examination (Descriptive)', 2, 'Compulsory and optional descriptive papers'),
    ('KPSC', 'KANNADA_TEST', 'Compulsory Kannada Language Test', 3, 'Mandatory qualifying Kannada language paper for non-exempted candidates'),
    ('KPSC', 'PERSONALITY_TEST', 'Personality Test / Interview', 4, 'Udyoga Soudha interview round for Group A/B posts'),
    ('KPSC', 'PROVISIONAL_SELECT_LIST', 'Provisional Select List (PSL)', 5, 'Provisional rank list published for objections'),
    ('KPSC', 'FINAL_SELECT_LIST', 'Final Select List (FSL)', 6, 'Final gazetted selection list for government appointment')
ON CONFLICT (organization_code, stage_code) DO NOTHING;

-- =============================================================================
-- 9. SEED DATA: DYNAMIC FORM FIELDS CONFIGURATION
-- =============================================================================

-- Application Extension Fields
INSERT INTO public.notification_type_fields (notification_type_code, field_name, field_label, field_type, is_required, placeholder, helper_text, display_order) VALUES
    ('APPLICATION_EXTENSION', 'original_closing_date', 'Original Closing Date', 'date', FALSE, 'YYYY-MM-DD', 'The original application deadline before this extension.', 10),
    ('APPLICATION_EXTENSION', 'new_closing_date', 'New Extended Closing Date', 'date', TRUE, 'YYYY-MM-DD', 'The newly announced last date to submit applications.', 20),
    ('APPLICATION_EXTENSION', 'fee_payment_extended_date', 'Extended Fee Payment Date', 'date', FALSE, 'YYYY-MM-DD', 'Last date to pay the examination fee if different.', 30),
    ('APPLICATION_EXTENSION', 'extension_reason', 'Extension Reason', 'textarea', FALSE, 'e.g., Heavy server traffic, public holidays, court order', 'Official reason stated in the corrigendum notice.', 40),
    ('APPLICATION_EXTENSION', 'reference_number', 'Corrigendum / Notice Ref No.', 'text', FALSE, 'e.g., Advt No. 04/2026/Ext-1', 'Official notice or file reference number.', 50),
    ('APPLICATION_EXTENSION', 'official_pdf_url', 'Official PDF Document URL', 'url', TRUE, 'https://...', 'Direct URL to the scanned PDF or public notice.', 60),
    ('APPLICATION_EXTENSION', 'apply_online_url', 'Application Portal URL', 'url', FALSE, 'https://...', 'Direct link to the registration/login page.', 70),
    ('APPLICATION_EXTENSION', 'remarks', 'Admin Verification Remarks', 'textarea', FALSE, 'Internal notes regarding this extension.', 'Audit remarks.', 80)
ON CONFLICT (notification_type_code, field_name) DO NOTHING;

-- Admit Card Fields
INSERT INTO public.notification_type_fields (notification_type_code, field_name, field_label, field_type, is_required, placeholder, helper_text, display_order) VALUES
    ('ADMIT_CARD_RELEASED', 'release_date', 'Admit Card Release Date', 'date', TRUE, 'YYYY-MM-DD', 'Date hall ticket download was activated.', 10),
    ('ADMIT_CARD_RELEASED', 'exam_date', 'Examination Date(s)', 'text', TRUE, 'e.g., 2026-10-18 or 18-20 Oct 2026', 'Scheduled date(s) of the examination.', 20),
    ('ADMIT_CARD_RELEASED', 'reporting_time', 'Reporting / Shift Time', 'text', FALSE, 'e.g., 08:30 AM (Shift 1), 01:30 PM (Shift 2)', 'Instructions for gate closing and shifts.', 30),
    ('ADMIT_CARD_RELEASED', 'download_url', 'Admit Card Download Portal URL', 'url', TRUE, 'https://...', 'Official portal where candidate enters roll/registration number.', 40),
    ('ADMIT_CARD_RELEASED', 'instructions_summary', 'Instructions / ID Proofs Required', 'textarea', FALSE, 'e.g., Bring original Aadhaar Card + 2 passport photos', 'Key instructions printed on hall ticket.', 50),
    ('ADMIT_CARD_RELEASED', 'reference_number', 'Notice Reference Number', 'text', FALSE, 'e.g., F.No. 1/4/2026-E.I(B)', 'Official circular reference.', 60),
    ('ADMIT_CARD_RELEASED', 'official_pdf_url', 'Official Notice PDF URL', 'url', TRUE, 'https://...', 'Official press release or download guideline PDF.', 70)
ON CONFLICT (notification_type_code, field_name) DO NOTHING;

-- Answer Key Fields
INSERT INTO public.notification_type_fields (notification_type_code, field_name, field_label, field_type, is_required, placeholder, helper_text, display_order) VALUES
    ('ANSWER_KEY_PROVISIONAL', 'release_date', 'Answer Key Release Date', 'date', TRUE, 'YYYY-MM-DD', 'Date provisional answer keys were published.', 10),
    ('ANSWER_KEY_PROVISIONAL', 'answer_key_type', 'Answer Key Classification', 'select', TRUE, 'Select Key Type', 'Provisional, Master Key, or Subject-wise.', 20),
    ('ANSWER_KEY_PROVISIONAL', 'objection_window_available', 'Is Objection Window Open?', 'boolean', TRUE, NULL, 'Toggle YES if candidates can submit online challenges.', 30),
    ('ANSWER_KEY_PROVISIONAL', 'objection_start_date', 'Objection Submission Start', 'datetime', FALSE, 'YYYY-MM-DD HH:MM', 'Start date and time of objection window.', 40),
    ('ANSWER_KEY_PROVISIONAL', 'objection_end_date', 'Objection Submission Deadline', 'datetime', FALSE, 'YYYY-MM-DD HH:MM', 'Closing date and time for challenges.', 50),
    ('ANSWER_KEY_PROVISIONAL', 'objection_fee_per_question', 'Objection Fee Per Question (INR)', 'number', FALSE, 'e.g., 50 or 100', 'Leave blank or 0 if free.', 60),
    ('ANSWER_KEY_PROVISIONAL', 'objection_portal_url', 'Objection Submission URL', 'url', FALSE, 'https://...', 'Direct portal link to file representation.', 70),
    ('ANSWER_KEY_PROVISIONAL', 'official_pdf_url', 'Official Answer Key PDF', 'url', TRUE, 'https://...', 'Link to the master question paper and key.', 80)
ON CONFLICT (notification_type_code, field_name) DO NOTHING;

-- Exam Date Postponed Fields
INSERT INTO public.notification_type_fields (notification_type_code, field_name, field_label, field_type, is_required, placeholder, helper_text, display_order) VALUES
    ('EXAM_DATE_POSTPONED', 'previous_exam_date', 'Previous Scheduled Date', 'date', FALSE, 'YYYY-MM-DD', 'The original date that was postponed.', 10),
    ('EXAM_DATE_POSTPONED', 'new_date_available', 'Has a New Date Been Announced?', 'boolean', TRUE, NULL, 'Select YES if revised date is confirmed, NO if TBD.', 20),
    ('EXAM_DATE_POSTPONED', 'new_exam_date', 'Revised Examination Date', 'date', FALSE, 'YYYY-MM-DD', 'Populate only if new date is announced.', 30),
    ('EXAM_DATE_POSTPONED', 'postponement_reason', 'Reason for Postponement', 'textarea', FALSE, 'e.g., Administrative exigencies, election clash, natural calamity', 'Official reason cited by commission.', 40),
    ('EXAM_DATE_POSTPONED', 'official_pdf_url', 'Official Postponement Notice PDF', 'url', TRUE, 'https://...', 'Official signed notice.', 50)
ON CONFLICT (notification_type_code, field_name) DO NOTHING;

-- Syllabus Revised Fields
INSERT INTO public.notification_type_fields (notification_type_code, field_name, field_label, field_type, is_required, placeholder, helper_text, display_order) VALUES
    ('SYLLABUS_REVISED', 'effective_cycle_year', 'Effective Cycle / Year', 'number', TRUE, 'e.g., 2026', 'The examination cycle from which new syllabus takes effect.', 10),
    ('SYLLABUS_REVISED', 'change_summary', 'Summary of Changes', 'textarea', TRUE, 'Key topics added, deleted, or pattern revisions...', 'Plain-language bullet points for candidates.', 20),
    ('SYLLABUS_REVISED', 'previous_syllabus_summary', 'Previous Syllabus Reference', 'textarea', FALSE, 'Summary of legacy curriculum for comparison.', 'Historical reference.', 30),
    ('SYLLABUS_REVISED', 'official_pdf_url', 'Revised Syllabus Document PDF', 'url', TRUE, 'https://...', 'Comprehensive official syllabus brochure.', 40)
ON CONFLICT (notification_type_code, field_name) DO NOTHING;

-- Result Released Fields
INSERT INTO public.notification_type_fields (notification_type_code, field_name, field_label, field_type, is_required, placeholder, helper_text, display_order) VALUES
    ('RESULT_RELEASED', 'result_type', 'Result Classification', 'select', TRUE, 'Select Result Type', 'Written Exam, Interview Shortlist, or Final.', 10),
    ('RESULT_RELEASED', 'result_date', 'Result Declaration Date', 'date', TRUE, 'YYYY-MM-DD', 'Official date of result publication.', 20),
    ('RESULT_RELEASED', 'total_candidates_qualified', 'Total Candidates Qualified', 'number', FALSE, 'e.g., 14620', 'Total roll numbers in the write-up.', 30),
    ('RESULT_RELEASED', 'cut_off_available', 'Are Cut-off Marks Published?', 'boolean', TRUE, NULL, 'YES if cut-off table is in this document or released.', 40),
    ('RESULT_RELEASED', 'result_pdf_url', 'Result Merit List PDF URL', 'url', TRUE, 'https://...', 'Direct link to list of selected roll numbers.', 50),
    ('RESULT_RELEASED', 'cut_off_pdf_url', 'Cut-off Marks Document URL', 'url', FALSE, 'https://...', 'Optional separate cut-off document link.', 60),
    ('RESULT_RELEASED', 'next_stage_instructions', 'Next Stage Schedule / DAF Notice', 'textarea', FALSE, 'Instructions for qualified candidates (DAF-I submission, etc.)', 'Guidance for next round.', 70)
ON CONFLICT (notification_type_code, field_name) DO NOTHING;

-- Corrigendum Multi-Topic Fields
INSERT INTO public.notification_type_fields (notification_type_code, field_name, field_label, field_type, is_required, placeholder, helper_text, display_order) VALUES
    ('CORRIGENDUM', 'corrigendum_number', 'Corrigendum Number / Reference', 'text', TRUE, 'e.g., Corrigendum No. 1, Addendum-II', 'Official designation of amendment.', 10),
    ('CORRIGENDUM', 'affected_sections', 'What Is Being Changed? (Multi-select)', 'select', TRUE, 'Select Affected Areas', 'Vacancy, Application Date, Age, Exam Date, Syllabus, etc.', 20),
    ('CORRIGENDUM', 'amendment_summary', 'Detailed Amendment Summary', 'textarea', TRUE, 'State exactly what is modified in the original advertisement.', 'Verbatim or clear summary of changes.', 30),
    ('CORRIGENDUM', 'official_pdf_url', 'Official Corrigendum PDF URL', 'url', TRUE, 'https://...', 'Link to the signed gazette/corrigendum notice.', 40)
ON CONFLICT (notification_type_code, field_name) DO NOTHING;
