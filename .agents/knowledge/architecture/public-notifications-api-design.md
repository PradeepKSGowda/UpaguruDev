# Public REST API v1: GET /api/v1/notifications Architecture & Design

## 1. Executive Summary & Context
Under **ADR-001 (Frontend)**, **ADR-002 (Database)**, **ADR-010 (Caching & Rate Limiting)**, **ADR-013 (Security)**, and **ADR-014 (API Design)**, third-party developers, career portals, and partner services require a secure, performant, and standardized REST API to access published government exam notifications programmatically.

Executing **TASK-08010101** (`SUB-0801010101`) builds the core route handler `GET /api/v1/notifications` alongside strong typing, Zod schema validation, sliding window IP rate limiting, edge caching, and RFC 7807 problem details error responses. This initiates **EPIC-08 (Public REST API & OpenAPI Documentation)**.

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
          │ application/problem+json│         │ (limit, offset, filters)│
          └─────────────────────────┘         └────────────┬────────────┘
                                                           │
                                         ┌─────────────────┴─────────────────┐
                                   Invalid Params                       Valid Params
                                         │                                   │
                                         ▼                                   ▼
                            ┌─────────────────────────┐         ┌─────────────────────────┐
                            │ HTTP 400 RFC 7807       │         │ 3. Supabase Server      │
                            │ invalid_params payload  │         │    PostgreSQL Query     │
                            └─────────────────────────┘         └────────────┬────────────┘
                                                                             │
                                                                             ▼
                                                                ┌─────────────────────────┐
                                                                │ 4. Cache-Control Header │
                                                                │    s-maxage=300         │
                                                                │    stale-while-rev=600  │
                                                                │ HTTP 200 JSON Response  │
                                                                └─────────────────────────┘
```

---

## 3. Query Parameter Specifications

| Parameter | Type | Default | Constraints | Description |
| :--- | :---: | :---: | :---: | :--- |
| `limit` | integer | `20` | Min `1`, Max `100` | Number of notifications per page. |
| `offset` | integer | `0` | Min `0` | Number of initial notifications to skip. |
| `category` | string | `all` | Enum: `all`, `civil_services`, `banking`, `railways`, `defense`, `state_psc`, `teaching`, `police`, `other` | Exam domain classification filter. |
| `state` | string | `all` | Max `100` chars | State or Central jurisdiction filter. |
| `sort` | string | `published_desc` | Enum: `published_desc`, `published_asc`, `deadline_asc`, `deadline_desc`, `vacancies_desc`, `title_asc` | Ordering strategy. |
| `search` | string | `""` | Max `100` chars | Case-insensitive substring search on title and notification number. |

---

## 4. RFC 7807 Problem Details Specifications

When request validation fails or unexpected runtime errors occur, the endpoint emits an RFC 7807 formatted response with `Content-Type: application/problem+json`:

### HTTP 400 Example:
```json
{
  "type": "https://upaguru.in/errors/invalid-parameters",
  "title": "Invalid Query Parameters",
  "status": 400,
  "detail": "The request query parameters failed validation: limit (Limit cannot exceed 100); category (Category must be one of: all, civil_services, ...)",
  "instance": "/api/v1/notifications",
  "invalid_params": [
    {
      "name": "limit",
      "reason": "Limit cannot exceed 100"
    },
    {
      "name": "category",
      "reason": "Category must be one of: all, civil_services, banking, railways, defense, state_psc, teaching, police, other"
    }
  ]
}
```

---

## 5. Successful Response Envelope (HTTP 200)

```json
{
  "data": [
    {
      "id": "c1f10928-8d26-4fa2-938b-cf98b1eb7e10",
      "slug": "kpsc-gazetted-probationers-2026",
      "title": "KPSC Gazetted Probationers Examination 2026 (Group A & B)",
      "notification_number": "PSC 01 E(A)/2026",
      "total_vacancies": 384,
      "application_start_date": "2026-03-01T00:00:00Z",
      "application_end_date": "2026-04-15T23:59:59Z",
      "exam_date": "2026-06-21T00:00:00Z",
      "qualification_required": ["Bachelor Degree from a recognized university"],
      "age_limit_min": 21,
      "age_limit_max": 38,
      "official_pdf_url": "https://kpsc.kar.nic.in/notif_2026.pdf",
      "apply_online_url": "https://kpsc.kar.nic.in/apply",
      "syllabus_summary": {
        "prelims": "General Studies Paper 1 & 2",
        "mains": "Compulsory Kannada, English, and 4 GS papers"
      },
      "selection_process": ["Preliminary Examination", "Main Examination", "Personality Test"],
      "published_at": "2026-03-01T06:00:00Z",
      "created_at": "2026-03-01T06:00:00Z",
      "updated_at": "2026-03-01T06:00:00Z",
      "exam": {
        "id": "4955b252-47ba-4b21-a1e4-39958ee42f21",
        "slug": "kpsc-gazetted-probationers",
        "title": "Karnataka Administrative Services (KAS)",
        "conducting_body": "Karnataka Public Service Commission",
        "category": "state_psc",
        "state_or_central": "Karnataka",
        "official_website": "https://kpsc.kar.nic.in",
        "logo_url": "https://upaguru.in/logos/kpsc.png"
      }
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 20,
    "offset": 0,
    "has_more": false
  },
  "timestamp": "2026-09-20T12:47:00.000Z"
}
```

---

## 6. Implementation Inventory

| Component | File Path | Scope & Responsibility |
| :--- | :--- | :--- |
| **API Schema** | `lib/schemas/api.ts` | Zod validation schemas for query parameters, RFC 7807 helper, and TypeScript response contracts. |
| **Route Handler** | `app/api/v1/notifications/route.ts` | Next.js 15 Route Handler enforcing rate limits, query validation, Supabase retrieval, and caching. |
| **DB Migration** | `.agents/knowledge/database/public-api-schema-v1.sql` | `public.api_request_logs` audit telemetry table and idempotent RLS policies. |
| **Execution Record** | `.agents/task-executions/TASK-08010101.md` | Audit and verification log for task completion. |
