-- UPA-GURU Database Migration Schema (v1.0.0)
-- PostgreSQL 15+ / Supabase Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE exam_category_enum AS ENUM (
    'civil_services',
    'banking',
    'railways',
    'defense',
    'state_psc',
    'teaching',
    'police',
    'other'
);

CREATE TYPE notification_status_enum AS ENUM (
    'draft',
    'under_review',
    'published',
    'archived'
);

CREATE TYPE draft_status_enum AS ENUM (
    'pending_review',
    'approved',
    'rejected'
);

-- 1. Exams Master Table
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    conducting_body TEXT NOT NULL, -- e.g. KPSC, UPSC, SSC, RRB
    category exam_category_enum NOT NULL DEFAULT 'other',
    state_or_central TEXT NOT NULL DEFAULT 'Central', -- 'Central', 'Karnataka', etc.
    official_website TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    notification_number TEXT,
    total_vacancies INT DEFAULT 0,
    application_start_date DATE,
    application_end_date DATE,
    exam_date DATE,
    qualification_required TEXT[],
    age_limit_min INT,
    age_limit_max INT,
    official_pdf_url TEXT,
    apply_online_url TEXT,
    syllabus_summary JSONB DEFAULT '{}'::jsonb,
    selection_process TEXT[],
    status notification_status_enum DEFAULT 'draft',
    verified_by UUID REFERENCES auth.users(id),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Draft Notifications Table (For AI Scraper & HITL Review)
CREATE TABLE IF NOT EXISTS public.draft_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_url TEXT NOT NULL,
    source_name TEXT NOT NULL,
    raw_extracted_text TEXT,
    parsed_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    extraction_confidence_score NUMERIC(5,2) DEFAULT 0.00,
    status draft_status_enum DEFAULT 'pending_review',
    reviewed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. User Subscriptions Table (Phase 3 Omnichannel Alerts)
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    preferred_channels TEXT[] DEFAULT ARRAY['web_push'], -- 'telegram', 'whatsapp', 'web_push'
    telegram_chat_id TEXT,
    whatsapp_phone_number TEXT,
    fcm_device_token TEXT,
    subscribed_exam_ids UUID[],
    subscribed_categories exam_category_enum[],
    subscribed_states TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    target_entity TEXT NOT NULL,
    target_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ultra-fast query performance
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_exam_id ON public.notifications(exam_id);
CREATE INDEX IF NOT EXISTS idx_notifications_dates ON public.notifications(application_end_date);
CREATE INDEX IF NOT EXISTS idx_exams_category ON public.exams(category);
CREATE INDEX IF NOT EXISTS idx_exams_state ON public.exams(state_or_central);
CREATE INDEX IF NOT EXISTS idx_draft_status ON public.draft_notifications(status);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Public Read access for published notifications and exams
CREATE POLICY "Public Read Published Exams" ON public.exams
    FOR SELECT USING (true);

CREATE POLICY "Public Read Published Notifications" ON public.notifications
    FOR SELECT USING (status = 'published');

-- Admin full access policy (using auth.jwt() claims for admin role)
CREATE POLICY "Admin Full Access Exams" ON public.exams
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin Full Access Notifications" ON public.notifications
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin Full Access Drafts" ON public.draft_notifications
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin Full Access Audit Logs" ON public.audit_logs
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- User Subscriptions policy (Users manage their own subscription preferences)
CREATE POLICY "User Subscriptions Own Access" ON public.user_subscriptions
    FOR ALL USING (auth.uid() = user_id);
