# ADR-015: Automated PDF Scraper & LLM Extraction Engine

## Status
Accepted

## Date
2026-09-02

## Context & Problem Statement
Government exam notifications in India are published across hundreds of official portals (KPSC, UPSC, SSC, RRB, State PSCs) as unstructured, multi-page PDF documents. Manually keying in notification titles, vacancy tables, eligibility rules, and application deadline dates is slow, error-prone, and unscalable.

Requirements:
- Automated extraction of structured JSON parameters from unstructured PDF files.
- High accuracy ($> 90\%$) on complex Indian government job notification formats.
- Confidence scoring for every extraction to flag uncertain extractions.
- Strict Human-In-The-Loop (HITL) admin verification workflow before publishing to public candidates.

## Decision Outcome
Adopt **Google Gemini API** (via `@google/genai` / `google-generativeai` SDK) combined with a **Human-In-The-Loop (HITL) Verification Workflow**.

## Architecture & Data Flow Blueprint

```
 ┌──────────────────────┐
 │ Python Web Scraper   │ (Downloads PDF from KPSC, UPSC, SSC, RRB)
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────┐
 │ Gemini API Engine    │ (Executes Structured JSON Prompt Parsing)
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────┐
 │ draft_notifications  │ (Saved with status = 'pending_review' & confidence score)
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────┐
 │ Admin HITL Dashboard │ (Side-by-side PDF preview & form edit)
 └──────────┬───────────┘
            │ Admin Approve & Publish
            ▼
 ┌──────────────────────┐
 │ public.notifications │ (Published live to Candidate Portal & Push Alerts)
 └──────────────────────┘
```

## Extraction Prompt Schema & Confidence Model

### 1. Structured Output Schema (Zod / JSON Schema)
Gemini is prompted using Structured Outputs to return a strict JSON object:
```json
{
  "title": "KPSC Gazetted Probationers 2026",
  "conducting_body": "KPSC",
  "total_vacancies": 384,
  "application_start_date": "2026-09-10",
  "application_end_date": "2026-10-15",
  "qualification_required": ["Bachelor Degree in any discipline"],
  "age_limit_min": 21,
  "age_limit_max": 38,
  "selection_process": ["Preliminary Exam", "Main Exam", "Interview"],
  "confidence_score": 0.95
}
```

### 2. Confidence Threshold Routing
- **High Confidence ($\ge 0.85$)**: Placed at top of Admin HITL review queue for fast 1-click verification.
- **Medium/Low Confidence ($< 0.85$)**: Highlighted with warning badges in HITL UI indicating specific fields needing manual verification.

### 3. Draft Queue Table (`draft_notifications`)
```sql
CREATE TABLE IF NOT EXISTS public.draft_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_url TEXT NOT NULL,
    source_name TEXT NOT NULL,
    raw_extracted_text TEXT,
    parsed_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    extraction_confidence_score NUMERIC(5,2) DEFAULT 0.00,
    status draft_status_enum DEFAULT 'pending_review',
    reviewed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Consequences

### Positive
- Reduces notification publishing time from 30+ minutes down to 30 seconds of admin review.
- Scales across hundreds of regional government notification formats without writing custom regex parser per site.
- HITL workflow guarantees 100% data accuracy for published candidate notifications.

### Negative
- PDF text extraction depends on LLM API availability and token budget.

## Compliance & Guardrails
- Complies strictly with `.agents/rules/AGENTS.md` Rule 1 (No Hardcoded Secrets), Rule 3 (HITL admin verification & `draft_notifications` table), and schema contract `schema-v1.sql`.
