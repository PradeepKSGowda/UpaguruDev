# Public REST API v1: GET /api/v1/exams and GET /api/v1/search Architecture & Design

## 1. Executive Summary & Context
In accordance with **ADR-001 (Frontend)**, **ADR-002 (Database)**, **ADR-006 (Search)**, **ADR-010 (Caching & Rate Limiting)**, **ADR-013 (Security)**, and **ADR-014 (API Design)**, external consumers and client integrations require dedicated endpoints to:
1. Enumerate canonical competitive exam entities (`GET /api/v1/exams`) with category, conducting authority, jurisdiction, and active notification volume.
2. Query published notifications with full-text search (`GET /api/v1/search`) leveraging PostgreSQL GIN indexes, multi-token stemming, and relevance ranking.

Executing **TASK-08010102** (`SUB-0801010201`) establishes both route handlers with strict Zod validation, sliding window IP rate limiting, RFC 7807 problem details error handling, and Edge CDN caching headers.

---

## 2. API Contract & Flow Architecture

```
                                  Client Request
                                         │
                                         ▼
                         ┌───────────────────────────────┐
                         │ 1. Upstash Redis Rate Limiter │
                         │    60 req/min per IP sliding  │
                         └───────────────┬───────────────┘
                                         │
                       ┌─────────────────┴─────────────────┐
                 Limit Exceeded                      Under Limit
                       │                                   │
                       ▼                                   ▼
          ┌─────────────────────────┐         ┌─────────────────────────┐
          │ HTTP 429 RFC 7807       │         │ 2. Zod Query Validator  │
          │ application/problem+json│         │ (q, limit, offset, etc) │
          └─────────────────────────┘         └────────────┬────────────┘
                                                           │
                                         ┌─────────────────┴─────────────────┐
                                   Invalid Params                       Valid Params
                                         │                                   │
                                         ▼                                   ▼
                            ┌─────────────────────────┐         ┌─────────────────────────┐
                            │ HTTP 400 RFC 7807       │         │ 3. Database Execution   │
                            │ invalid_params payload  │         │    - Exams Master Query │
                            └─────────────────────────┘         │    - GIN Full-Text SRCH │
                                                                └────────────┬────────────┘
                                                                             │
                                                                             ▼
                                                                ┌─────────────────────────┐
                                                                │ 4. Edge Cache Headers   │
                                                                │    Exams: s-maxage=600  │
                                                                │    Search: s-maxage=60  │
                                                                │ HTTP 200 JSON Response  │
                                                                └─────────────────────────┘
```

---

## 3. Query Parameter Specifications

### 3.1 GET /api/v1/exams
| Parameter | Type | Default | Constraints | Description |
| :--- | :---: | :---: | :---: | :--- |
| `limit` | integer | `20` | Min `1`, Max `100` | Number of exam records per page. |
| `offset` | integer | `0` | Min `0` | Number of records to skip. |
| `category` | string | `all` | Enum: `all`, `civil_services`, `banking`, `railways`, `defense`, `state_psc`, `teaching`, `police`, `other` | Domain category filter. |
| `state` | string | `all` | Max `100` chars | State or Central jurisdiction filter. |
| `sort` | string | `title_asc` | Enum: `title_asc`, `title_desc`, `created_desc`, `created_asc` | Ordering strategy. |
| `search` | string | `""` | Max `100` chars | Free text search across title, conducting body, and slug. |

### 3.2 GET /api/v1/search
| Parameter | Type | Default | Constraints | Description |
| :--- | :---: | :---: | :---: | :--- |
| `q` | string | *(Required)* | Min `1`, Max `100` chars | Search keywords or acronyms. |
| `limit` | integer | `20` | Min `1`, Max `100` | Number of matching notifications per page. |
| `offset` | integer | `0` | Min `0` | Number of records to skip. |
| `category` | string | `all` | Enum: `all`, `civil_services`, etc. | Exam domain category filter. |
| `state` | string | `all` | Max `100` chars | Jurisdiction filter. |
| `sort` | string | `relevance` | Enum: `relevance`, `published_desc`, `deadline_asc`, `vacancies_desc` | Ranking and sort criteria. |

---

## 4. Response Envelopes (HTTP 200)

### 4.1 GET /api/v1/exams Example:
```json
{
  "data": [
    {
      "id": "4955b252-47ba-4b21-a1e4-39958ee42f21",
      "slug": "kpsc-gazetted-probationers",
      "title": "Karnataka Administrative Services (KAS)",
      "conducting_body": "Karnataka Public Service Commission",
      "category": "state_psc",
      "state_or_central": "Karnataka",
      "official_website": "https://kpsc.kar.nic.in",
      "logo_url": "https://upaguru.in/logos/kpsc.png",
      "active_notifications_count": 2,
      "created_at": "2026-03-01T00:00:00Z",
      "updated_at": "2026-03-01T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 20,
    "offset": 0,
    "has_more": false
  },
  "timestamp": "2026-09-20T12:54:00.000Z"
}
```

### 4.2 GET /api/v1/search Example:
```json
{
  "query": "civil services",
  "data": [
    {
      "id": "c1f10928-8d26-4fa2-938b-cf98b1eb7e10",
      "slug": "upsc-civil-services-2026",
      "title": "UPSC Civil Services Examination (IAS/IPS/IFS) 2026",
      "notification_number": "01/2026-CSP",
      "total_vacancies": 1056,
      "application_start_date": "2026-02-14T00:00:00Z",
      "application_end_date": "2026-03-05T18:00:00Z",
      "exam_date": "2026-05-25T00:00:00Z",
      "qualification_required": ["Graduate Degree"],
      "age_limit_min": 21,
      "age_limit_max": 32,
      "official_pdf_url": "https://upsc.gov.in/notif.pdf",
      "apply_online_url": "https://upsconline.nic.in",
      "syllabus_summary": {"prelims": "GS 1 & 2"},
      "selection_process": ["Prelims", "Mains", "Interview"],
      "published_at": "2026-02-14T06:00:00Z",
      "created_at": "2026-02-14T06:00:00Z",
      "updated_at": "2026-02-14T06:00:00Z",
      "exam": {
        "id": "11223344-5566-7788-9900-aabbccddeeff",
        "slug": "upsc-civil-services",
        "title": "Civil Services Examination",
        "conducting_body": "Union Public Service Commission",
        "category": "civil_services",
        "state_or_central": "Central",
        "official_website": "https://upsc.gov.in",
        "logo_url": "https://upaguru.in/logos/upsc.png"
      }
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 20,
    "offset": 0,
    "has_more": false
  },
  "timestamp": "2026-09-20T12:54:00.000Z"
}
```

---

## 5. Component Inventory & Source Files

| Component | File Path | Scope & Responsibility |
| :--- | :--- | :--- |
| **API Schema** | `lib/schemas/api.ts` | Zod validation schemas for exams and search query parameters, RFC 7807 error helper, and TypeScript response contracts. |
| **Exams Handler** | `app/api/v1/exams/route.ts` | Next.js 15 Route Handler for exams listing with exact count, active notification volume, and 10-minute CDN caching. |
| **Search Handler** | `app/api/v1/search/route.ts` | Next.js 15 Route Handler for full-text search with GIN index acceleration, ILIKE fallback, and 60-second CDN caching. |
| **DB Migration** | `.agents/knowledge/database/public-api-exams-search-schema-v1.sql` | Performance composite indexes on `exams` and `public.api_search_telemetry` audit table with mandatory RLS. |
| **Execution Record** | `.agents/task-executions/TASK-08010102.md` | Formal audit and verification log for task completion. |
