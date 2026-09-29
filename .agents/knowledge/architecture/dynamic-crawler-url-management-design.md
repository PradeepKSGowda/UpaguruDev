# Dynamic Recruitment Crawler URL Management & Audit Cockpit

## Overview & Motivation
Government examination bodies (such as UPSC, KPSC, SSC, RRB, and IBPS) periodically restructure, rename, or redirect their web pages. For example, UPSC previously hosted active examination circulars under `/examinations/active-examinations`, but subsequently changed it to `/examinations/active-exams`, returning an HTTP redirect back to the root homepage (`https://www.upsc.gov.in/`). When crawlers target hardcoded URLs that redirect away from the examination table, extractions fail to detect notification items.

This enhancement establishes a permanent, resilient solution:
1. Extraction target URLs are decoupled from hardcoded source code into a managed database layer.
2. Administrative users can view, test, verify, and update extraction URLs directly from the Web Admin Cockpit (`/admin/scrapers`).
3. Complete historical URL transitions are permanently recorded with reasons and timestamps for documentation and compliance.
4. Python crawlers dynamically load active URLs from Supabase on startup, while retaining offline YAML configuration fallbacks.

---

## Architectural Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Web Admin Cockpit                        │
│                 (/admin/scrapers UI)                        │
└──────────────┬──────────────────────────────▲───────────────┘
               │ 1. Verify / Edit URL         │ 4. Revalidate
               ▼                              │    Display
┌─────────────────────────────────────────────┴───────────────┐
│                    Server Actions                           │
│  (verifyPortalUrlAction, updatePortalTargetUrlAction)       │
└──────────────┬──────────────────────────────▲───────────────┘
               │ 2. Ping / Verify             │ 3. Upsert & Log
               ▼                              │
┌───────────────────────────┐  ┌──────────────┴───────────────┐
│    Target Gov Portal      │  │     Supabase PostgreSQL      │
│ (Detect 301/302 Redirect) │  │  - crawler_portals           │
└───────────────────────────┘  │  - crawler_portal_url_history│
                               └──────────────▲───────────────┘
                                              │ 5. Dynamic Override
                               ┌──────────────┴───────────────┐
                               │     Python Web Crawlers      │
                               │   (scraper/crawlers/*.py)    │
                               │   via portal_loader.py       │
                               │   Fallback: portal.yaml      │
                               └──────────────────────────────┘
```

### 1. Database & Security Model (ADR-002, ADR-003)
* **`public.crawler_portals`**:
  * `portal_code` (TEXT UNIQUE PK/Ref): Identifier (e.g. `UPSC`, `KPSC`, `SSC`, `RRB`, `IBPS`).
  * `current_target_url` (TEXT): Active notification page URL scraped by the crawlers.
  * `wait_selector` (TEXT): CSS selector waited on by Playwright/Httpx.
  * `last_verified_at` (TIMESTAMPTZ): Timestamp of last administrative connectivity check.
  * `is_active` (BOOLEAN): Master toggle for the portal crawler.
* **`public.crawler_portal_url_history`**:
  * `portal_code` (FK `crawler_portals.portal_code` ON DELETE CASCADE).
  * `previous_url` (TEXT): The previous extraction endpoint.
  * `new_url` (TEXT): The newly assigned extraction endpoint.
  * `reason` (TEXT): Documented business or technical rationale for the change.
  * `changed_by` (UUID FK `auth.users(id)`).
  * `changed_by_email` (TEXT).
  * `created_at` (TIMESTAMPTZ DEFAULT NOW()).
* **Mandatory Row Level Security (RLS)**:
  * Public read-only access for data feeds.
  * Admin-only write access restricted by `has_permission(auth.uid(), 'notifications:write')`.

### 2. Dynamic Crawler Runtime Loader & Two-Tier Traversal (`scraper/crawlers/portal_loader.py` & `scraper/crawlers/upsc.py`)
* Automatically loads default YAML configuration from `scraper/config/portals/{portal_code}.yaml`.
* Queries `crawler_portals` in Supabase:
  * If a record exists and is active, dynamically overrides `notifications_url` and `wait_selector`.
* If database connection fails or during offline local development, catches exceptions and proceeds with static YAML configurations gracefully.
* **Two-Tier Traversal Engine**:
  * Indian government recruitment portals (specifically UPSC) organize scheduled examinations via landing subpages (e.g. `/examinations/Civil%20Services...`) rather than direct PDF download links on the index.
  * The crawler identifies whether a candidate link is a direct `.pdf` or an examination landing subpage.
  * If an exam landing page is detected, it traverses into the subpage, identifies the official notification/notice circular PDF, and extracts the document.

### 3. Registry & Validation Layer (`lib/scrapers/registry.ts`)
* Integrates `targetUrl` property into `PORTAL_REGISTRY` and `PortalConfig`.
* Exports `updatePortalUrlSchema` (Zod schema with preprocessing) supporting both `newUrl` and `targetUrl`.
* Exports `CrawlerParserTestResult` and `CrawlerParserTestItem` interfaces.

### 4. Server Actions (`app/admin/scrapers/actions.ts`)
* **`verifyPortalUrlAction(url: string)`**:
  * Pings the candidate URL via fetch with an 8-second timeout.
  * Detects 301/302 redirects by comparing `res.url` against the requested URL.
  * Measures roundtrip latency in milliseconds.
* **`testCrawlerParserAction(portalCode: string, customUrl?: string)`**:
  * In-portal dry-run test simulating crawler parser execution without writing to the database.
  * Inspects DOM structure and detects whether page has direct circulars, two-tier subpages, or unrecognized layouts.
  * Produces high-visibility diagnostic alerts:
    * `⚠️ Website Redirect Detected`: URL redirected away from exam listings.
    * `🚨 Website Structure Changed`: 0 circulars found (DOM structure or layout change).
    * `ℹ️ Two-Tier Examination Subpages Detected`: Exam landing pages found; informs admin of subpage traversal.
    * `✅ Direct Circulars Detected`: Direct circular PDFs ready for extraction.
  * Returns samples of candidate titles and URLs.
* **`updatePortalTargetUrlAction(input: UpdatePortalUrlInput)`**:
  * Authenticates caller and verifies administrative permissions.
  * Retrieves current URL and archives it to `crawler_portal_url_history`.
  * Upserts new target URL in `crawler_portals`.
  * Revalidates `/admin` and `/admin/scrapers`.
* **`getPortalUrlHistoryAction(portalCode: string)`**:
  * Fetches chronological audit history log for display in modal.

### 5. Admin UI Components
* **`components/admin/PortalUrlEditModal.tsx`**:
  * Three-tab interface: "Configure & Test URL", "Dry-Run Parser Preview", and "URL Change History".
  * Real-time URL pinging with latency badge and redirect banner ("Use Redirect URL" button).
  * Live parser dry-run preview displaying website change alerts and candidate circular items.
  * Mandatory audit reason field.
  * Historical log timeline displaying previous URL $\to$ new URL, editor email, reason, and date.
* **`components/admin/ScraperTable.tsx`**:
  * Displays the live target extraction URL directly under each recruitment organization.
  * Displays "Edit URL" button, "Dry Run" test button, and historical changes count badge.
  * Opens `PortalUrlEditModal` directly to configuration or dry-run preview tabs.

---

## Verification & Testing
* Unit test suite: `tests/unit/data/scrapers.test.ts`
  * Validates `updatePortalUrlSchema` validation (rejects invalid protocols, trims URLs).
  * Validates default registry extraction URLs including UPSC active exams.
* Migration reference: `supabase/migrations/20260928_crawler_portals.sql`
* DDL reference: `.agents/knowledge/database/crawler-portals-schema-v1.sql`
