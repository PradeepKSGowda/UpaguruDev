# Zod Validation Testing Architecture & Schema Verification Design

## 1. Executive Summary & Context
In accordance with **ADR-001 (Frontend)**, **ADR-002 (Database)**, **ADR-013 (Security)**, and **AGENTS.md (Rule 1: Code Generation Rules - Zod Input Validation & Rule 2: Testing & Execution Safety Guardrails)**, runtime validation schemas represent the primary defense perimeter across client forms, Server Actions, and public REST API endpoints.

Executing **TASK-09010102** (`SUB-0901010201`):
1. Establishes dedicated, comprehensive unit test suites in `tests/unit/schemas/` covering all Zod validation schemas.
2. Verifies $\ge 5$ test cases per schema covering:
   - **Valid Complete Payloads**: Canonical payloads with full typings.
   - **Invalid Formats**: Schema violations including invalid UUIDs, malformed emails/passwords, illegal slugs, and invalid dates.
   - **Boundary Conditions**: Maximum/minimum vacancy counts, page sizes, string length limits.
   - **Type Coercion & Preprocessing**: Preprocessing empty strings or nulls to defaults, coercing query strings to numbers, and transforming newline-delimited strings to arrays.
3. Validates error formatting compliance with **RFC 7807 Problem Details** specification.
4. Deploys telemetry tracking table `public.qa_schema_validation_logs` with mandatory Row Level Security (RLS).

---

## 2. Validation Testing Architecture

```
                  Client Form / REST API Request / Server Action
                                        │
                                        ▼
                      ┌───────────────────────────────────┐
                      │    Zod Runtime Schema Validation  │
                      │  - safeParse(input)               │
                      └─────────────────┬─────────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 │                                             │
                 ▼                                             ▼
       [ Validated Payload ]                       [ ZodError / Failure ]
  - Preprocessed / Coerced Values             - RFC 7807 Problem Details
  - Guaranteed TypeScript Types               - Granular Field Errors
  - Sanitized DB Parameters                   - User-Friendly Messages
                 │                                             │
                 ▼                                             ▼
     Next.js Action / Route Handler               400 Bad Request Response
```

---

## 3. Schema Coverage Matrix

| Test File | Schemas Tested | Target Modules | Primary Test Scenarios |
| :--- | :--- | :--- | :--- |
| `tests/unit/schemas/notifications.test.ts` | `notificationFilterSchema` | `lib/schemas/notifications.ts` | Search trimming, state/category validation, default pagination, page boundary checks, negative limits. |
| `tests/unit/schemas/api.test.ts` | `notificationQueryParamsSchema`, `examQueryParamsSchema`, `searchQueryParamsSchema`, `formatRfc7807ValidationError` | `lib/schemas/api.ts` | Query string coercion, enum sorting, cursor vs page pagination, RFC 7807 structure, field error mapping. |
| `tests/unit/schemas/subscriptions.test.ts` | `subscriptionPreferencesSchema` | `lib/schemas/subscriptions.ts` | WhatsApp phone validation (E.164), Telegram chat ID, digest frequencies, state/category array UUIDs. |
| `tests/unit/schemas/drafts.test.ts` | `draftFilterSchema`, `draftParsedFieldsSchema` | `lib/schemas/drafts.ts` | Scraper source enum, status filters, date range boundaries, JSON field parsing and defaults. |
| `tests/unit/schemas/auth.test.ts` | `loginSchema`, `registerSchema` | `lib/schemas/auth.ts` | Email normalization, password length requirements, password confirmation matching, full name trimming. |
| `tests/unit/schemas/admin-notifications.test.ts` | `adminNotificationInputSchema`, `adminNotificationFilterSchema` | `lib/schemas/admin-notifications.ts` | Exam UUID format, slug regex (`^[a-z0-9]+(?:-[a-z0-9]+)*$`), vacancy preprocessing, newline qualification splitting, URL validation. |

---

## 4. Test Case Classification & Boundary Rules

### 4.1. Coercion & Preprocessing Rules
- **Empty Strings & Nulls**: Numeric fields (`total_vacancies`, `age_limit_min`, `age_limit_max`) must preprocess empty strings and nulls to default integers or `null` without throwing type errors.
- **String Delimiters**: Text area inputs for qualifications must seamlessly accept newline-separated strings and split them into arrays while filtering out empty lines.
- **Query Parameter Coercion**: Express/Next.js URL parameters arrive as strings (`page="2"`, `pageSize="20"`); schemas must employ `z.coerce.number()` to automatically cast valid representations.

### 4.2. Boundary & Rejection Rules
- **Pagination Limits**: `pageSize` must be constrained to $[5, 100]$. Requests outside this range are rejected with specific error paths.
- **Slugs**: Slugs must be lowercase, alphanumeric, hyphen-separated strings without leading/trailing hyphens or double hyphens.
- **Dates**: Dates must match ISO format `YYYY-MM-DD`.

---

## 5. Component Inventory & Source Files

| Component | File Path | Scope & Responsibility |
| :--- | :--- | :--- |
| **Notification Schema Tests** | `tests/unit/schemas/notifications.test.ts` | Validates public notification search and filter schemas. |
| **Public API Schema Tests** | `tests/unit/schemas/api.test.ts` | Validates API query parameters and RFC 7807 error formatting. |
| **Subscription Schema Tests** | `tests/unit/schemas/subscriptions.test.ts` | Validates user channel preferences, E.164 numbers, and digests. |
| **Draft Schema Tests** | `tests/unit/schemas/drafts.test.ts` | Validates scraper ingestion drafts, field types, and filter ranges. |
| **Auth Schema Tests** | `tests/unit/schemas/auth.test.ts` | Validates login and registration credentials and confirmation logic. |
| **Admin Schema Tests** | `tests/unit/schemas/admin-notifications.test.ts` | Validates manual notification creation, edits, and admin filters. |
| **DB Migration** | `.agents/knowledge/database/zod-schema-test-telemetry-schema-v1.sql` | `public.qa_schema_validation_logs` table with mandatory RLS. |
| **Execution Record** | `.agents/task-executions/TASK-09010102.md` | Formal task completion audit log with QA Reviewer sign-off. |
