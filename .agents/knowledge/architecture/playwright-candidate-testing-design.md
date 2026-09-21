# Playwright E2E Candidate Flow Testing Architecture & Specification

## 1. Executive Summary & Context
In accordance with **ADR-001 (Frontend RSC)**, **ADR-002 (Database)**, **ADR-008 (Programmatic SEO)**, and **AGENTS.md (Rule 2: Testing & Execution Safety Guardrails - Standalone Playwright Test Generation)**, user journeys spanning multiple interconnected Next.js Server & Client components require automated browser validation across varied device viewports and rendering engines.

Executing **TASK-09020101** (`SUB-0902010101`):
1. Establishes the master Playwright configuration in `playwright.config.ts` with multi-browser coverage (Chromium, Firefox, WebKit, Mobile Chrome) and Next.js dev/start `webServer` integration.
2. Implements the complete Candidate User Journey in `tests/e2e/candidate-flow.spec.ts` covering:
   - **Homepage Discovery**: Validating `pageTitle`, `notification-filter-bar`, and `notification-feed-grid`.
   - **Interactive Filtering**: Selecting category pills and state dropdowns, verifying URL searchParam synchronization, and filter reset.
   - **Full-Text Search Flow**: Entering queries in `search-bar-input`, navigating to `/search?q=...`, and verifying `search-results-page`.
   - **Notification Detail & CTA Actions**: Opening individual notification pages, verifying `notification-detail`, `detail-apply-online-btn`, `detail-download-pdf-btn`, and embedded Schema.org JSON-LD scripts.
   - **Mobile Layout Integrity**: Testing viewport adaptability at 375x667, confirming zero horizontal overflow.
3. Updates `package.json` with Playwright dependencies and CLI scripts (`test:e2e`, `test:e2e:ui`).
4. Deploys database telemetry migration `playwright-candidate-telemetry-schema-v1.sql` with mandatory Row Level Security (RLS).

---

## 2. End-to-End Candidate Journey Topology

```
                  ┌─────────────────────────────────────────┐
                  │ 1. Homepage Discovery (/)               │
                  │    - Title: UPA-GURU                    │
                  │    - notification-filter-bar            │
                  │    - notification-feed-grid / cards     │
                  └───────────────────┬─────────────────────┘
                                      │
                 ┌────────────────────┴────────────────────┐
                 │                                         │
                 ▼                                         ▼
   ┌───────────────────────────┐             ┌───────────────────────────┐
   │ 2. Interactive Filtering  │             │ 3. Full-Text Search       │
   │    - Click Category Pill  │             │    - Fill search-bar-input│
   │    - URL: ?category=...   │             │    - Press 'Enter'        │
   │    - Reset Filters        │             │    - Nav: /search?q=...   │
   └─────────────┬─────────────┘             └─────────────┬─────────────┘
                 │                                         │
                 └────────────────────┬────────────────────┘
                                      │
                                      ▼
                  ┌─────────────────────────────────────────┐
                  │ 4. Notification Detail View             │
                  │    - Slug: /notification/[slug]         │
                  │    - Landmark: notification-detail      │
                  │    - CTAs: Apply Online / Download PDF  │
                  │    - Schema.org: JobPosting JSON-LD     │
                  └───────────────────┬─────────────────────┘
                                      │
                                      ▼
                  ┌─────────────────────────────────────────┐
                  │ 5. Mobile Viewport Adaptability         │
                  │    - Width: 375px (Pixel / iPhone)      │
                  │    - Zero horizontal overflow           │
                  └─────────────────────────────────────────┘
```

---

## 3. Configuration & Multi-Browser Matrix

| Project Engine | Device Profile | Viewport | Scope & Target |
| :--- | :--- | :--- | :--- |
| **`chromium`** | Desktop Chrome | $1280 \times 720$ | Primary candidate desktop portal journey. |
| **`firefox`** | Desktop Firefox | $1280 \times 720$ | Gecko rendering engine compatibility. |
| **`webkit`** | Desktop Safari | $1280 \times 720$ | WebKit engine styling and font layout verification. |
| **`Mobile Chrome`** | Pixel 5 | $393 \times 851$ | Mobile candidate touch navigation and responsiveness. |

### Artifact & Failure Telemetry Settings
- `trace`: `"on-first-retry"` (Collects timeline and DOM snapshot upon failure).
- `screenshot`: `"only-on-failure"` (Saves image capture on unexpected assertion failures).
- `video`: `"retain-on-failure"` (Records WebM video of failing sessions).
- `webServer`: Automated bootstrap of Next.js server on `http://localhost:3000` with reuse toggle.

---

## 4. Component Inventory & Source Files

| Component | File Path | Scope & Responsibility |
| :--- | :--- | :--- |
| **Playwright Config** | `playwright.config.ts` | Multi-browser runner configuration, timeouts, webServer, and reporters. |
| **Candidate E2E Spec** | `tests/e2e/candidate-flow.spec.ts` | 5 comprehensive end-to-end user journey tests across candidate portal. |
| **Package Manifest** | `package.json` | Adds `@playwright/test` devDependency and `test:e2e`, `test:e2e:ui` scripts. |
| **DB Telemetry Migration** | `.agents/knowledge/database/playwright-candidate-telemetry-schema-v1.sql` | `public.qa_playwright_test_runs` with mandatory RLS. |
| **Design Specification** | `.agents/knowledge/architecture/playwright-candidate-testing-design.md` | E2E test architecture and multi-browser topology design. |
| **Execution Record** | `.agents/task-executions/TASK-09020101.md` | Formal task execution log and multi-agent review sign-off. |
