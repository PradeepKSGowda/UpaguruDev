# Skill: PostgreSQL & Supabase Database Design (`postgres-design.md`)

## Input
- **Entity Definition & Purpose**: Name, description, relationships (1:1, 1:N, N:M), and lifecycle.
- **Field Attributes**: Data types, nullability, defaults, unique constraints, and foreign key cascades.
- **Access Control Matrix**: Read/Write permissions categorized by roles (`Guest`, `Candidate`, `Moderator`, `Admin`, `Super Admin`).
- **Query Patterns**: Filter combinations, sorting fields, search predicates, and aggregation volume.

---

## Output
- **PostgreSQL DDL Script (`.sql`)**: Production-ready migration file with idempotent commands (`CREATE TABLE IF NOT EXISTS`).
- **Row Level Security (RLS) Policies**: Explicit `FOR SELECT`, `FOR INSERT`, `FOR UPDATE`, `FOR DELETE` policies with JWT claim expressions.
- **Index Definitions**: B-tree indexes for foreign keys/dates, GIN indexes for JSONB/FTS/trigram columns.
- **PostgreSQL Enum Types & Triggers**: Enumerated types and automated timestamp update triggers.
- **Audit Logging Triggers (if applicable)**: Trigger-based or procedure-based audit record creation.

---

## Checklist
- [ ] Every table enables Row Level Security (`ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY;`) (`AGENTS.md` Rule 3).
- [ ] Explicit RLS policies created for every permissible action; default deny enforced.
- [ ] Admin policies check `auth.jwt() ->> 'role' = 'admin'` or custom claim (`AGENTS.md` Rule 3).
- [ ] Candidate ownership policies verify `auth.uid() = user_id`.
- [ ] Primary keys use `UUID DEFAULT uuid_generate_v4()`.
- [ ] Foreign keys explicitly define `ON DELETE CASCADE` or `ON DELETE SET NULL`.
- [ ] B-tree indexes placed on all foreign keys, status columns, and date range filters.
- [ ] Full-text search columns use GIN indexes with `tsvector` or `pg_trgm`.
- [ ] Migrations are idempotent and safely rerunnable.

---

## Prompt Template
```markdown
You are the Solution Architect Agent for UPA-GURU.
Design the PostgreSQL schema and security policies for: [ENTITY_NAME]

Context & Purpose: [DESCRIBE_PURPOSE]
Fields & Types: [LIST_FIELDS_AND_TYPES]
Relationships: [DESCRIBE_FOREIGN_KEYS]
Access Matrix:
- Public/Candidate: [ALLOWED_OPERATIONS]
- Admin/Moderator: [ALLOWED_OPERATIONS]

Requirements:
1. Write PostgreSQL 15+ compatible DDL with UUID primary keys.
2. Enable Row Level Security (RLS) immediately after table definition.
3. Write separate explicit policies for SELECT, INSERT, UPDATE, DELETE.
4. Add indexes optimized for query filters and foreign key lookups.
5. Include rollback commands and inline documentation comments.
```

---

## Examples

### Example 1: `exam_alerts` Table with RLS & Trigram Indexing
```sql
-- Migration: Create exam_alerts table with complete RLS and indexing
-- Purpose: Stores custom alert triggers configured by candidates for specific exams.

-- 1. Table DDL
CREATE TABLE IF NOT EXISTS public.exam_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL DEFAULT 'deadline_reminder', -- 'deadline_reminder', 'admit_card', 'result'
    days_before_deadline INT DEFAULT 3,
    is_active BOOLEAN NOT NULL DEFAULT true,
    triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_user_exam_alert UNIQUE (user_id, exam_id, alert_type)
);

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_exam_alerts_user_id ON public.exam_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_alerts_exam_id ON public.exam_alerts(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_alerts_active ON public.exam_alerts(is_active) WHERE is_active = true;

-- 3. Mandatory Row Level Security Enablement
ALTER TABLE public.exam_alerts ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Candidates can view only their own alerts
CREATE POLICY "Candidates Select Own Alerts" ON public.exam_alerts
    FOR SELECT
    USING (auth.uid() = user_id);

-- Candidates can create alerts only for themselves
CREATE POLICY "Candidates Insert Own Alerts" ON public.exam_alerts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Candidates can update only their own alerts
CREATE POLICY "Candidates Update Own Alerts" ON public.exam_alerts
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Candidates can delete only their own alerts
CREATE POLICY "Candidates Delete Own Alerts" ON public.exam_alerts
    FOR DELETE
    USING (auth.uid() = user_id);

-- Admins have full read access for platform metrics
CREATE POLICY "Admins Full Access Alerts" ON public.exam_alerts
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin');
```

---

## Failure Conditions
- **Missing RLS**: Creating a table without `ENABLE ROW LEVEL SECURITY`.
- **Permissive Wildcard Policy**: Using `USING (true)` for `INSERT`, `UPDATE`, or `DELETE` without auth restrictions.
- **Unindexed Foreign Keys**: Creating `REFERENCES` foreign keys without corresponding indexes, degrading cascade deletes.
- **Plain Text Secrets**: Storing tokens, passwords, or credentials in unencrypted columns.
- **Destructive Migrations**: Using `DROP TABLE` or `ALTER COLUMN DROP` without safe deprecation paths.
