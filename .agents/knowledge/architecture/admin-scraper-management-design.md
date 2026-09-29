# Admin Scraper Management & Manual Extraction Architecture

## Overview
The Admin Scraper Management system provides real-time operational visibility into all automated recruitment crawlers (KPSC, UPSC, RRB, SSC, IBPS, etc.) and gives administrators the ability to trigger on-demand manual extractions directly from the Admin Portal.

## Components & Contracts

### 1. Extensible Portal Registry (`lib/scrapers/registry.ts`)
- Defines known recruitment portals (`KPSC`, `UPSC`, `RRB`, `SSC`, `IBPS`).
- Includes a fallback resolver `getKnownPortalConfig(portalCode)` that guarantees dynamic discovery: if any new scraper or database row introduces a new portal code (e.g. `MPSC`, `BPSC`), the UI dynamically adapts and renders it without requiring a code release or downtime.
- Exports date evaluation helper `isDateOngoing(dateStr)` used to classify notifications as "Ongoing" vs "Expired".

### 2. Aggregation Layer & Privileged RLS Boundary (`lib/data/scrapers.ts`)
- Queries `public.crawl_runs`, `public.draft_notifications`, `public.pdf_documents`, and `public.notifications`.
- **Privileged Administrative Client**: Utilizes `createAdminClient()` (falling back to `createServerClient()`). Because `crawl_runs`, `draft_notifications`, and `pdf_documents` enforce strict Row Level Security (`(auth.jwt() ->> 'role' = 'service_role') OR (auth.jwt() ->> 'role' = 'admin')`), unauthenticated or standard candidate cookie sessions return empty datasets (`[]`). Using `createAdminClient()` ensures administrative dashboard components reliably render accurate telemetry without silent zero-row omissions.
- Maps crawl runs, raw PDF circulars, and draft counts per organization.
- Computes:
  - `discoveredAt`: Most recent crawl timestamp (`crawl_runs.started_at`), draft timestamp, or raw document discovery timestamp.
  - `totalNotifications`: Total drafts + published notifications (or extracted circulars in `pdf_documents`).
  - `expiredCount`: Notifications whose application deadline has elapsed.
  - `ongoingCount`: Notifications whose application deadline is active/future (or newly discovered circulars).
  - `pendingDraftsCount`: Drafts awaiting human review in the HITL queue (`/admin/drafts`).

### 3. Server Action (`app/admin/scrapers/actions.ts`)
- Enforces RBAC: verifies user is authenticated and possesses `admin` or `super_admin` role.
- Validates input using Zod (`portalTriggerSchema`, `updatePortalUrlSchema`).
- Logs a pending record in `public.crawl_runs`.
- Calls the scraper microservice (`POST /api/trigger/{portal_code}`) with fallbacks for local runner scripts (`python -m scraper.run_crawler --portal {code}`).
- Revalidates `/admin` and `/admin/scrapers` cache paths.

### 4. Dynamic URL Management & Audit History
- `public.crawler_portals`: Stores the active target extraction URL per recruitment body.
- `public.crawler_portal_url_history`: Immutable audit trail recording previous URL, new URL, change reason, admin ID, and timestamp.
- `app/admin/scrapers/actions.ts`:
  - `verifyPortalUrlAction`: Live ping checking connectivity and detecting 301/302 redirects with latency benchmarks.
  - `testCrawlerParserAction`: In-portal live DOM inspection (dry-run parser preview) sampling discovered circulars and rendering diagnostic alerts.
  - `updatePortalTargetUrlAction`: Authenticated server action logging history and updating the active target URL.
  - `getPortalUrlHistoryAction`: Retrieves historical transitions for a given portal.
- `scraper/crawlers/portal_loader.py`: Checks `crawler_portals` dynamically on crawler execution, falling back to YAML if offline.

### 5. Automated Pipeline Ingestion (`scraper/crawlers/*.py`)
- When crawlers download a new notification PDF and persist it into `public.pdf_documents`, they immediately hand off the document to `process_crawled_item_async()`.
- A baseline draft notification is generated with `status: 'pending_review'` and persisted in `public.draft_notifications`, making newly crawled items immediately accessible in the Admin Verification Queue (`/admin/drafts`).

### 6. Admin UI Components
- `components/admin/ScraperTable.tsx`: Client component matching the required user layout:
  - Blue header styling (`bg-blue-700 font-heading`).
  - Columns: `Organisation` (with live extraction target URL, "Edit URL" button, "Dry Run" test button, and history badge), `DISCOVERED AT`, `Total Notifications`, `Expired`, `Ongoing`, `Status / Queue`, and `Actions`.
  - Live button state for `Manual Extract` with loading spinner and alert feedback banner.
- `components/admin/PortalUrlEditModal.tsx`: 3-tab modal:
  - **Configure & Test URL**: Live ping verification with latency check and redirect detection (one-click "Use Redirect URL" button).
  - **Dry-Run Parser Preview**: Live DOM parsing test showing detected items, structure classification (`direct_pdf`, `two_tier_subpages`, `unrecognized`), and website change diagnostic alerts.
  - **URL Change History**: Chronological history audit log showing past transitions and rationale.
- `app/admin/scrapers/page.tsx`: Dedicated management dashboard with KPI cards and pipeline overview.
- `app/admin/page.tsx`: Embedded overview section in the primary HITL Cockpit.

