# End-to-End Extraction & Draft Insertion Pipeline Architecture

## 1. Context & Architectural Invariants
* **Related Task**: `TASK-04020103` (`SUB-0402010301`)
* **Milestone**: Final Task of `FEAT-0402` and `EPIC-04` (AI Extraction Engine & Multi-Source Government Scrapers).
* **Core Mandates**:
  1. **Sacred HITL Invariant**: Scraper microservice and AI extraction pipelines are strictly forbidden from writing to public live tables (`public.notifications`). All extracted items write exclusively to `public.draft_notifications` with `status = 'pending_review'`.
  2. **Priority Review Triage**: Notifications with confidence/completeness scores below **0.85** or identified as **corrigenda** (`is_corrigendum = True`) are flagged `priority_review = True` for urgent manual human triage.
  3. **Strict Null Discipline**: All ambiguous, unspecified, or unverified attributes default to `null` without placeholder strings.

---

## 2. End-to-End Pipeline Orchestration Flow

```
   ┌─────────────────────────────────────────────────────────────┐
   │             Crawled Recruitment PDF Document                │
   └──────────────────────────────┬──────────────────────────────┘
                                  │
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │         PDF Text Extractor (pypdf + pdfplumber)             │
   └──────────────────────────────┬──────────────────────────────┘
                                  │ raw text
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │      GeminiExtractor (response_schema=NotificationExtr...)  │
   └──────────────────────────────┬──────────────────────────────┘
                                  │ validated Pydantic model
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                calculate_confidence_score()                 │
   │  - Evaluates completeness across 8 core fields (1.00 max)   │
   │  - If completeness < 0.85 or confidence < 0.85:             │
   │      priority_review = True                                 │
   │  - Appends actionable non-fatal validation warnings         │
   └──────────────────────────────┬──────────────────────────────┘
                                  │ ConfidenceResult
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │              insert_draft_notification()                    │
   │  - Sets status = 'pending_review'                           │
   │  - Maps parsed_json, raw_text, source_url, warnings         │
   │  - Stores foreign keys: pdf_document_id, run_id             │
   └──────────────────────────────┬──────────────────────────────┘
                                  │
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │        Supabase `public.draft_notifications` Table          │
   │        (Enables Admin HITL Verification in EPIC-03)         │
   └─────────────────────────────────────────────────────────────┘
```

---

## 3. Database Column & Payload Structure

The orchestration function [`process_extracted_document`](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/scraper/extraction/pipeline.py) populates the following schema in `public.draft_notifications`:

| Column | Type | Origin / Content |
| :--- | :--- | :--- |
| `source_url` | `TEXT` | Official portal PDF link. |
| `raw_text` | `TEXT` | Extracted plain text (bounded to 50k chars to conserve storage). |
| `parsed_json` | `JSONB` | Serialized `NotificationExtractedData` dictionary. |
| `extraction_confidence_score` | `NUMERIC(4,3)` | Blended confidence score (0.000 to 1.000). |
| `completeness_score` | `NUMERIC(5,4)` | Deterministic weighted completeness score across all 8 facets. |
| `validation_warnings` | `JSONB` | List of non-fatal extraction warnings. |
| `priority_review` | `BOOLEAN` | `TRUE` if confidence/completeness < 0.85 or corrigendum. |
| `is_corrigendum` | `BOOLEAN` | Extracted corrigendum/amendment flag. |
| `pdf_document_id` | `UUID` | Foreign key referencing `public.pdf_documents(id)`. |
| `run_id` | `UUID` | Foreign key referencing `public.crawl_runs(id)`. |
| `parent_draft_id` | `UUID` | Optional parent draft reference for corrigendum notices. |
| `extraction_model` | `TEXT` | LLM model identifier (e.g., `gemini-1.5-pro`). |
| `prompt_version` | `TEXT` | Extraction prompt version tracking (`v1.0`). |
| `status` | `TEXT` | Always `'pending_review'` (Sacred HITL Invariant). |

---

## 4. Operational Invariants
* **Admin Verification Hand-off**: Once inserted, drafts are immediately visible in the Admin HITL review portal (`/admin/drafts`), where human verifiers inspect `parsed_json`, resolve validation warnings, and approve for publishing into `public.notifications`.
* **Asynchronous Integration**: The pipeline provides [`process_crawled_item_async`](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/scraper/extraction/pipeline.py) allowing crawlers (KPSC, UPSC, SSC, RRB) to hand off downloaded documents directly into the extraction pipeline within async event loops.
