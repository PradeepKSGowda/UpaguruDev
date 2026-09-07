# ADR-002: PostgreSQL & Supabase Database Architecture

## Status
Accepted

## Date
2026-09-02

## Context & Problem Statement
UPA-GURU requires a reliable, scalable, relational database to store government exam notifications, organization master data, automated scraper draft extractions, candidate subscriptions, and administrative audit logs.

Key database requirements:
- Relational integrity between exams and notifications.
- Granular security through Row Level Security (RLS).
- High-performance indexing for category, state, and application deadline queries.
- JSONB support for flexible syllabus structure and AI extraction metadata.
- Immutable audit logging for Human-In-The-Loop (HITL) actions.

## Decision Outcome
Adopt **PostgreSQL 15+** hosted on **Supabase Cloud**, governed by strict migrations (`schema-v1.sql`) and mandatory Row Level Security (RLS) policies across all tables.

## Database Schema Overview (`schema-v1.sql`)

### 1. Core Tables & Enums
- **`exams`**: Master exam metadata (`id`, `slug`, `title`, `conducting_body`, `category`, `state_or_central`, `official_website`, `logo_url`).
- **`notifications`**: Published notification records (`id`, `exam_id`, `slug`, `title`, `total_vacancies`, `application_start_date`, `application_end_date`, `qualification_required`, `syllabus_summary` JSONB, `status`).
- **`draft_notifications`**: Raw scraper output and AI extraction pipeline queue (`id`, `source_url`, `raw_extracted_text`, `parsed_json` JSONB, `extraction_confidence_score`, `status`).
- **`user_subscriptions`**: Candidate alert preferences (`id`, `user_id`, `preferred_channels`, `telegram_chat_id`, `subscribed_exam_ids`, `subscribed_categories`, `subscribed_states`).
- **`audit_logs`**: Security & HITL admin audit records (`id`, `admin_id`, `action`, `target_entity`, `target_id`, `metadata` JSONB).

### 2. Mandatory Row Level Security (RLS) Policies
All tables must have RLS enabled (`ENABLE ROW LEVEL SECURITY`).
- **`exams`**: Public read enabled (`Public Read Published Exams`); Admin full access via `auth.jwt() ->> 'role' = 'admin'`.
- **`notifications`**: Public read restricted to `status = 'published'`; Admin full CRUD access.
- **`draft_notifications`**: Strict Admin-only access for HITL verification.
- **`user_subscriptions`**: User self-service access via `auth.uid() = user_id`.
- **`audit_logs`**: Admin read/insert access only.

### 3. Performance Indexing Strategy
- `idx_notifications_status` on `notifications(status)`
- `idx_notifications_exam_id` on `notifications(exam_id)`
- `idx_notifications_dates` on `notifications(application_end_date)`
- `idx_exams_category` on `exams(category)`
- `idx_exams_state` on `exams(state_or_central)`
- `idx_draft_status` on `draft_notifications(status)`

## Connection Pooling & Scaling
- Connection pooling managed via Supabase **Supavisor** to support high concurrent Serverless & Edge API connections.
- Migration files stored version-controlled in `.agents/knowledge/database/`.

## Consequences

### Positive
- Strict ACID compliance for transactional application state.
- Strong security isolation at the database tier via RLS.
- JSONB flexibility for non-uniform exam syllabus and AI prompt response payloads.

### Negative
- Schema migrations require careful planning and lock management during production deploys.

## Compliance & Guardrails
- Complies strictly with `.agents/rules/AGENTS.md` Rule 3 (Mandatory RLS, RBAC, Audit Trail) and database contract `schema-v1.sql`.