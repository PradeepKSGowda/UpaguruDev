# OpenAPI 3.0 Specification & Interactive Documentation Architecture

## 1. Executive Summary & Context
In accordance with **ADR-001 (Frontend)**, **ADR-002 (Database)**, **ADR-010 (Caching & Rate Limiting)**, **ADR-013 (Security)**, and **ADR-014 (API Design)**, external developers and partner services require comprehensive, interactive, and machine-readable API documentation.

Executing **TASK-08020101** (`SUB-0802010101`):
1. Establishes the authoritative OpenAPI 3.0.3 specification (`public/openapi.yaml` and `public/openapi.json`) covering all `/api/v1/*` endpoints (`/notifications`, `/exams`, `/search`), parameters, request/response models, and RFC 7807 error structures.
2. Delivers an interactive Swagger UI documentation portal at `/api/docs` (`app/api/docs/page.tsx`) with real-time test execution ("Try it out"), spec download shortcuts, and developer reference cards.
3. Successfully achieves **100% completion of EPIC-08 (Public REST API & OpenAPI Documentation)**.

---

## 2. Documentation Architecture Flow

```
                                  Client Browser
                                         │
                                         ▼
                         ┌───────────────────────────────┐
                         │ Route: GET /api/docs          │
                         │ (app/api/docs/page.tsx)       │
                         └───────────────┬───────────────┘
                                         │
                                         ▼
                         ┌───────────────────────────────┐
                         │ Loads Static OpenAPI Spec     │
                         │ - /openapi.json               │
                         │ - /openapi.yaml               │
                         └───────────────┬───────────────┘
                                         │
                                         ▼
                         ┌───────────────────────────────┐
                         │ Swagger UI Component          │
                         │ - Endpoint Discovery          │
                         │ - Schema Inspector            │
                         │ - In-browser "Try it out"     │
                         │ - Response Code Matrix        │
                         └───────────────┬───────────────┘
                                         │
                                         ▼
                         ┌───────────────────────────────┐
                         │ Live API Invocations          │
                         │ -> /api/v1/notifications      │
                         │ -> /api/v1/exams              │
                         │ -> /api/v1/search             │
                         └───────────────────────────────┘
```

---

## 3. OpenAPI 3.0.3 Endpoints Coverage Matrix

| Endpoint | Method | Path | Summary | Caching Header | Rate Limit |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **Notifications** | `GET` | `/api/v1/notifications` | Paginated published notices with category, state, and deadline filters | `s-maxage=300` | 60 req/min |
| **Exams** | `GET` | `/api/v1/exams` | Canonical exam catalog with conducting commissions and active notice counts | `s-maxage=600` | 60 req/min |
| **Search** | `GET` | `/api/v1/search` | GIN full-text keyword search across published notices with ILIKE fallback | `s-maxage=60` | 60 req/min |

---

## 4. Components & Schema Contracts

### Models Documented
- `PaginationMetadata`: `{ total, limit, offset, has_more }`
- `ExamSummary`: Basic exam metadata attached to notification items
- `NotificationItem`: Full notification entity including syllabus, vacancies, eligibility, and dates
- `ExamItem`: Detailed exam entity including active notification count
- `ProblemDetails`: RFC 7807 standard error structure (`type`, `title`, `status`, `detail`, `instance`, `invalid_params`)
- `InvalidParam`: `{ name, reason }`

---

## 5. Component Inventory & Source Files

| Component | File Path | Scope & Responsibility |
| :--- | :--- | :--- |
| **OpenAPI Spec (YAML)** | `public/openapi.yaml` | Canonical OpenAPI 3.0.3 specification in YAML format for tooling and SDK generators. |
| **OpenAPI Spec (JSON)** | `public/openapi.json` | Pre-parsed JSON variant for rapid Swagger UI and browser consumption. |
| **Interactive Docs Page** | `app/api/docs/page.tsx` | Next.js 15 App Router page rendering Swagger UI, metrics badges, and download triggers. |
| **DB Migration** | `.agents/knowledge/database/openapi-docs-telemetry-schema-v1.sql` | `public.api_docs_access_logs` audit table with mandatory RLS. |
| **Execution Record** | `.agents/task-executions/TASK-08020101.md` | Formal task completion audit log with multi-agent sign-offs. |
