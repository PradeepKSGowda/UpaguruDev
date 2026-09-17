# Admin Dashboard Stats Overview Architecture Design

## 1. Document Metadata
* **Document ID**: DESIGN-ADMIN-DASHBOARD-001
* **Task Reference**: TASK-03010102 (Subtask: SUB-0301010201)
* **Epic Reference**: EPIC-03 (Admin HITL Verification Portal & Audit System)
* **Feature Reference**: FEAT-0301 (Admin Dashboard Layout & Navigation Shell)
* **User Story**: STORY-030101 (As an admin, I want a dedicated dashboard layout so I can efficiently manage the verification pipeline)
* **Assigned Role**: Frontend Engineer
* **Architecture References**: ADR-001 (Frontend Architecture), ADR-002 (Database), ADR-003 (Authentication & RBAC), ADR-013 (Security)
* **Status**: APPROVED

---

## 2. Objective & System Architecture
The Admin Dashboard Stats Overview (`app/admin/page.tsx`) serves as the primary cockpit for administrative operators and verification personnel upon entering the UPA-GURU Human-In-The-Loop portal.

Key responsibilities:
1. **Real-Time Operational Metrics**: Displays high-level counters via modular `StatsCard` components:
   - **Pending Review Drafts**: AI-extracted draft notifications awaiting human verification (`status = 'pending_review'`). Highlights urgency with amber warning state when backlog $> 0$.
   - **Published Today**: Live notifications approved and published since 00:00 UTC today.
   - **Total Published Notifications**: Aggregate active notifications live on the public candidate portal (`status = 'published'`).
   - **Total Exam Series**: Master competitive examination entities tracked across central and state recruiting bodies.
2. **Actionable Quick Triggers**: Instant shortcut buttons routing operators directly to high-priority verification queues and entity creation:
   - "Review Pending Drafts" $\to$ `/admin/drafts`
   - "Manage Exams Master" $\to$ `/admin/exams`
   - "Manage Notifications" $\to$ `/admin/notifications`
   - "Inspect Audit Logs" $\to$ `/admin/audit-logs`
3. **Recent Draft Queue Sneak-Peek**: An embedded overview table displaying the 5 most recent pending drafts with confidence score badges and 1-click links directly to their verification workspace.
4. **Resilient Data Access (`lib/data/admin-dashboard.ts`)**: Server-side data fetcher leveraging `createServerClient()` executing parallel Supabase queries (`Promise.all`) for zero-waterfall latency.
5. **Testing Landmarks**: Every interactive component, metric card, and quick link incorporates deterministic HTML `id` attributes compliant with Playwright E2E automation.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Admin Dashboard (app/admin/page.tsx)               │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │  Header Banner: "HITL Verification Cockpit"                             │ │
│ │  System Health: [Operational] | Last Refreshed: UTC Timestamp           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │  Quick Action Bar:                                                      │ │
│ │  [Review Drafts (Queue)] [Manage Exams] [Manage Notifications] [Audits] │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────┐ │
│ │ Pending Drafts   │ │ Published Today  │ │ Total Published  │ │ Exams    │ │
│ │ [Count: Amber]   │ │ [Count: Emerald] │ │ [Count: Blue]    │ │ [Purple] │ │
│ └──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │  Recent Drafts Awaiting Verification (Top 5 Pending Review)             │ │
│ │  [Source URL] [Confidence Badge] [Extracted Date] [Verify Action ➔]     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Breakdown & Specifications

### 3.1 `StatsCard.tsx` (`components/admin/StatsCard.tsx`)
* **Visual States**:
  - `blue`: Standard informational aggregate.
  - `amber`: High-priority operational queue warning (e.g. pending drafts).
  - `emerald`: Successful progression (e.g. published today).
  - `purple`: Master taxonomy volume (e.g. registered exams).
* **Properties (`StatsCardProps`)**:
  - `title`: Metric label (e.g., "Pending Review Drafts").
  - `value`: Numerical or string display count.
  - `description`: Contextual helper text.
  - `icon`: Lucide icon component.
  - `href` *(optional)*: Direct link destination when card is clicked.
  - `colorScheme`: `"blue" | "amber" | "emerald" | "purple"`.
  - `testId`: Landmark HTML ID for automated testing.

### 3.2 Data Access Function (`lib/data/admin-dashboard.ts`)
* **Execution Boundary**: React Server Component (RSC).
* **Query Optimization**: Leverages parallel `Promise.all` count queries with exact head-only selectivity where possible to minimize network payload:
  1. `draft_notifications.select("*", { count: "exact", head: true }).eq("status", "pending_review")`
  2. `notifications.select("*", { count: "exact", head: true }).eq("status", "published").gte("published_at", startOfDayUtc)`
  3. `notifications.select("*", { count: "exact", head: true }).eq("status", "published")`
  4. `exams.select("*", { count: "exact", head: true })`
  5. `draft_notifications.select("id, source_url, extraction_confidence_score, status, created_at").eq("status", "pending_review").order("created_at", { ascending: false }).limit(5)`

---

## 4. Security & Compliance Guardrails
1. **Server-Side Execution**: Data fetching strictly executed on the server via `createServerClient()`.
2. **Access Control**: Relies on `app/admin/layout.tsx` server verification; queries respect PostgreSQL RLS policies.
3. **Telemetry & Audit**: Ingests analytical impressions into `admin_dashboard_metrics` with mandatory RLS.
4. **Execution Safety**: Complies with "Do not test. Do not deploy." during code generation.
