# Admin Scraper Management & Manual Extraction Architecture

## Overview
The Admin Scraper Management system provides real-time operational visibility into all automated recruitment crawlers (KPSC, UPSC, RRB, SSC, IBPS, etc.) and gives administrators the ability to trigger on-demand manual extractions directly from the Admin Portal.

## Components & Contracts

### 1. Extensible Portal Registry (`lib/scrapers/registry.ts`)
- Defines known recruitment portals (`KPSC`, `UPSC`, `RRB`, `SSC`, `IBPS`).
- Includes a fallback resolver `getKnownPortalConfig(portalCode)` that guarantees dynamic discovery: if any new scraper or database row introduces a new portal code (e.g. `MPSC`, `BPSC`), the UI dynamically adapts and renders it without requiring a code release or downtime.
- Exports date evaluation helper `isDateOngoing(dateStr)` used to classify notifications as "Ongoing" vs "Expired".

### 2. Aggregation Layer (`lib/data/scrapers.ts`)
- Queries `public.crawl_runs`, `public.draft_notifications`, and `public.notifications` using the server-side Supabase client.
- Maps crawl runs and draft counts per organization.
- Computes:
  - `discoveredAt`: Most recent crawl or draft timestamp.
  - `totalNotifications`: Total drafts + published notifications.
  - `expiredCount`: Notifications whose application deadline has elapsed.
  - `ongoingCount`: Notifications whose application deadline is active/future.
  - `pendingDraftsCount`: Drafts awaiting human review in the HITL queue.

### 3. Server Action (`app/admin/scrapers/actions.ts`)
- Enforces RBAC: verifies user is authenticated and possesses `admin` or `super_admin` role.
- Validates input using Zod (`portalTriggerSchema`).
- Logs a pending record in `public.crawl_runs`.
- Calls the scraper microservice (`POST /api/trigger/{portal_code}`) with fallbacks for local runner scripts.
- Revalidates `/admin` and `/admin/scrapers` cache paths.

### 4. Admin UI Components
- `components/admin/ScraperTable.tsx`: Client component matching the required user layout:
  - Blue header styling (`bg-blue-700 font-heading`).
  - Columns: `Organisation`, `DISCOVERED AT`, `Total Notifications`, `Expired`, `Ongoing`, `Status / Queue`, and `Actions`.
  - Live button state for `Manual Extract` with loading spinner and alert feedback banner.
- `app/admin/scrapers/page.tsx`: Dedicated management dashboard with KPI cards and pipeline overview.
- `app/admin/page.tsx`: Embedded overview section in the primary HITL Cockpit.
