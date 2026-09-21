# JSON-LD Schema Generator Testing Architecture & Structured Data Design

## 1. Executive Summary & Context
In accordance with **ADR-001 (Frontend RSC)**, **ADR-002 (Database)**, **ADR-008 (Programmatic SEO & Structured Data)**, and **AGENTS.md (Rule 4: SEO & Performance Rules - Structured Data & Rule 2: Testing Safety Guardrails)**, all public notification pages (`/notification/[slug]`) must output valid, Google-compliant Schema.org JSON-LD structured data.

Executing **TASK-09010103** (`SUB-0901010301`):
1. Establishes dedicated unit test suites in `tests/unit/seo/json-ld.test.ts` verifying all Schema.org structured data generators in `lib/seo/json-ld.ts`.
2. Validates Google Search Central compliance for:
   - **`JobPosting`**: Validating mandatory properties (`title`, `description`, `datePosted`, `validThrough`, `employmentType`, `hiringOrganization`, `jobLocation`) and optional enhancements (`totalJobOpenings`, `educationRequirements`, `directApply`).
   - **`Event`**: Validating scheduled exam dates, offline event attendance modes, and examination centres across India vs state jurisdictions.
   - **`BreadcrumbList`**: Validating 3-tier navigation hierarchy (`Home` $\rightarrow$ `Category` $\rightarrow$ `Notification Title`).
   - **`generateAllNotificationSchemas`**: Validating conditional compilation of multiple structured data script payloads on notification detail pages.
3. Exports standardized alias functions (`generateJobPostingJsonLd`, `generateEventJsonLd`, `generateBreadcrumbJsonLd`) matching technical task specifications.
4. Deploys structured data testing telemetry schema `public.qa_jsonld_validation_logs` with mandatory Row Level Security (RLS).

---

## 2. Structured Data Generation & Ingestion Pipeline

```
                     Notification Detail RSC (/notification/[slug])
                                        │
                                        ▼
                      ┌───────────────────────────────────┐
                      │ generateAllNotificationSchemas()  │
                      └─────────────────┬─────────────────┘
                                        │
         ┌──────────────────────────────┼──────────────────────────────┐
         │                              │                              │
         ▼                              ▼                              ▼
┌──────────────────┐          ┌───────────────────┐          ┌──────────────────┐
│ 1. JobPosting    │          │ 2. BreadcrumbList │          │ 3. Event         │
│ - title          │          │ - Position 1: Home│          │ - examDate != null
│ - vacancies      │          │ - Position 2: Cat │          │ - Offline Exam   │
│ - hiringOrg      │          │ - Position 3: Post│          │ - Venues across  │
│ - postalAddress  │          └───────────────────┘          │   State / India  │
└────────┬─────────┘                                         └────────┬─────────┘
         │                                                            │
         └──────────────────────────────┬─────────────────────────────┘
                                        │
                                        ▼
                      <script type="application/ld+json">
                                        │
                                        ▼
                     Google Search Central Rich Results Engine
```

---

## 3. Schema Specifications & Testing Matrix

| Generator Function | Target Schema | Key Schema.org Assertions | Edge Cases & Boundary Handling |
| :--- | :--- | :--- | :--- |
| `generateJobPostingSchema` / `generateJobPostingJsonLd` | `JobPosting` | `@context`, `@type`, `title`, `description`, `datePosted`, `validThrough`, `employmentType: 'FULL_TIME'`, `hiringOrganization`, `jobLocation`, `url` | - **Zero Vacancies**: Omits `totalJobOpenings` if $\le 0$.<br>- **Empty Qualifications**: Omits `educationRequirements` if empty.<br>- **Jurisdiction**: 'Central' maps to "India (All India Service)", state maps to specific state.<br>- **Logo**: Uses default fallback if exam logo is null.<br>- **Apply URL**: Sets `directApply: true` only if URL provided. |
| `generateEventSchema` / `generateEventJsonLd` | `Event` | `@context`, `@type: 'Event'`, `name`, `startDate`, `endDate`, `eventStatus: EventScheduled`, `eventAttendanceMode: OfflineEventAttendanceMode`, `location`, `organizer` | - **Null / Undefined `examDate`**: Returns `null` without throwing exceptions.<br>- **Central vs State Centers**: Differentiates national vs regional venue labels.<br>- **ISO Formatting**: Converted safely via `toIsoDateString()`. |
| `generateBreadcrumbSchema` / `generateBreadcrumbJsonLd` | `BreadcrumbList` | `@context`, `@type: 'BreadcrumbList'`, `itemListElement` with 3 items at positions 1, 2, 3 | - **Category Formatting**: Replaces underscores with spaces and capitalizes (e.g. `CIVIL SERVICES`).<br>- **Canonical URLs**: Links correctly to root, category feed, and detail slug. |
| `generateAllNotificationSchemas` | Array of Schemas | Returns consolidated array of all valid JSON-LD objects for the page | - **With Exam Date**: Returns 3 schemas (`JobPosting`, `BreadcrumbList`, `Event`).<br>- **Without Exam Date**: Returns 2 schemas (`JobPosting`, `BreadcrumbList`). |

---

## 4. Component Inventory & Source Files

| Component | File Path | Scope & Responsibility |
| :--- | :--- | :--- |
| **JSON-LD Generators** | `lib/seo/json-ld.ts` | Implementation of Schema.org generators with export aliases. |
| **Unit Test Suite** | `tests/unit/seo/json-ld.test.ts` | 15+ comprehensive unit test assertions validating Schema.org compliance. |
| **DB Telemetry Migration** | `.agents/knowledge/database/json-ld-test-telemetry-schema-v1.sql` | `public.qa_jsonld_validation_logs` with mandatory RLS. |
| **Design Specification** | `.agents/knowledge/architecture/json-ld-validation-testing-design.md` | Architecture and Google Rich Results conformance design. |
| **Execution Record** | `.agents/task-executions/TASK-09010103.md` | Task execution log and multi-agent review sign-off. |
