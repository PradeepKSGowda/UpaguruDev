# Gemini LLM Structured Extraction Engine & Confidence Scoring Architecture

## 1. Context & Architectural Mandates
* **Related Tasks**: `TASK-04020102` (Subtasks: `SUB-0402010201`, `SUB-0402010202`)
* **Related ADRs**: [ADR-002-Database.md](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/.agents/knowledge/architecture/decisions/ADR-002-Database.md), [ADR-013-Security.md](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/.agents/knowledge/architecture/decisions/ADR-013-Security.md), [ADR-015-AI-Integration.md](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/.agents/knowledge/architecture/decisions/ADR-015-AI-Integration.md)
* **Design Objectives**:
  1. Enable automated, structured conversion of raw PDF text into validated recruitment entities using the Google Gemini SDK with Structured Outputs.
  2. Enforce strict **Null Discipline** (zero hallucination or synthetic filler strings).
  3. Implement a deterministic, multi-factor confidence and completeness scoring algorithm that calculates `completeness_score`, flags `validation_warnings`, and triggers `priority_review` for the Admin HITL review pipeline in EPIC-03.

---

## 2. Gemini Extraction Pipeline Architecture

```
                       ┌─────────────────────────────────────────┐
                       │   Extracted PDF Document Plain Text     │
                       │   (pypdf / pdfplumber dual-engine)      │
                       └────────────────────┬────────────────────┘
                                            │
                                            ▼
                       ┌─────────────────────────────────────────┐
                       │            GeminiExtractor              │
                       │  - Model: gemini-1.5-pro / flash        │
                       │  - Temperature: 0.1 (low randomness)    │
                       │  - Response Schema: NotificationExtract │
                       │  - Strict Null Discipline Prompt        │
                       └────────────────────┬────────────────────┘
                                            │
                                            ▼
                       ┌─────────────────────────────────────────┐
                       │  Structured Output JSON Parsing         │
                       │  (Pydantic V2 Model Validation)         │
                       └────────────────────┬────────────────────┘
                                            │
                                            ▼
                       ┌─────────────────────────────────────────┐
                       │     calculate_confidence_score()        │
                       │  - Weighted completeness scoring (1.00) │
                       │  - Granular validation warning triage   │
                       │  - Priority review flag calculation     │
                       └────────────────────┬────────────────────┘
                                            │
                                            ▼
                       ┌─────────────────────────────────────────┐
                       │   Supabase `public.draft_notifications` │
                       │   (HITL Review Queue with parsed_json)  │
                       └─────────────────────────────────────────┘
```

---

## 3. Confidence & Completeness Scoring Algorithm

To provide platform admins with transparent quality indicators and power triage queues, each extracted notification is scored using a deterministic weighted completeness formula:

### Field Weights Breakdown

| Field Category | Weight | Evaluation Criteria |
| :--- | :--- | :--- |
| **`title`** | **0.15** | Non-empty job examination title with string length > 5 chars. |
| **`conducting_body`** | **0.10** | Non-empty government board / commission name (length >= 3 chars). |
| **`dates`** | **0.15** | `application_end` (0.08), `application_start` (0.04), `notification_date` (0.03). |
| **`vacancies`** | **0.15** | `total_vacancies > 0` (0.10) + post-wise breakdown present (0.05). |
| **`qualifications`** | **0.15** | At least one educational degree requirement specified. |
| **`age_limits`** | **0.10** | `min_age` or `max_age` present. |
| **`application_fee`** | **0.10** | Fee schedule or concession/exemption clause present. |
| **`selection_process`**| **0.10** | At least one selection stage / exam scheme present. |
| **Total Completeness** | **1.00** | **100% Core Completeness** |

### Priority Review Triggers (`priority_review = True`)
1. **Low Completeness Threshold**: `completeness_score < 0.70` (indicates potential extraction gaps or truncated notices).
2. **Corrigendum Detection**: `data.is_corrigendum == True` (amendment or cancellation notice requiring swift admin verification).
3. **Imminent Deadlines**: Application deadline closing within 14 calendar days.

### Non-Fatal Validation Warnings
The algorithm accumulates transparent, human-readable triage messages in `validation_warnings`:
- *"Application closing date (deadline) is missing."*
- *"Total vacancy count and post-wise breakdown missing."*
- *"Educational qualification criteria missing."*
- *"Low extraction completeness (< 70%): Flagged for priority manual review."*

---

## 4. Error Handling & Guardrails
1. **Context Window Safety**: The extractor caps raw text input at 120,000 characters to prevent accidental prompt overflows while accommodating long notifications.
2. **Missing SDK Protection**: Fallback handles environments where `google-generativeai` might not be installed, raising explicit `ExtractionError` with actionable diagnostic details.
3. **No Unsanctioned Execution**: Automated testing or extraction pipelines are executed only upon explicit user command.
