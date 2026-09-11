# System Design: Notifications Data Access Layer (`getPublishedNotifications`)

## 1. Overview & Context
- **Task ID**: `TASK-02020101` (Subtasks: `SUB-0202010101`, `SUB-0202010102`)
- **Epic**: `EPIC-02` (Candidate Portal: Notification Feed, Detail Pages & Search)
- **Feature**: `FEAT-0202` (Homepage Notification Feed with Filters & Pagination)
- **User Story**: `STORY-020201` (Candidate browsing exam notifications with filters)
- **Target Files**:
  - `types/notifications.ts` (Domain interfaces and types)
  - `lib/schemas/notifications.ts` (Zod parameter validation schema)
  - `lib/data/notifications.ts` (Supabase query builder data access functions)
  - `lib/data/index.ts` (Barrel export)

---

## 2. Architectural Design & RSC Flow

```mermaid
flowchart TD
    subgraph ClientBrowser [Client Viewport / URL State]
        URLParams["URLSearchParams (?category=banking&state=Central&page=1&sortBy=deadline_soonest)"]
    end

    subgraph ServerRuntime [Next.js 15 App Router Server Component]
        RSC["app/page.tsx / NotificationsFeed (RSC)"]
        ZodValidator["lib/schemas/notifications.ts (notificationFilterSchema)"]
        DataAccess["lib/data/notifications.ts (getPublishedNotifications)"]
        SupabaseClient["lib/supabase/server.ts (createServerClient with async cookies)"]
    end

    subgraph SupabaseDB [Supabase PostgreSQL 15+]
        RLS["Row Level Security ('Public Read Published Notifications')"]
        NotifTable["public.notifications (status = 'published')"]
        ExamsTable["public.exams (JOIN on exam_id)"]
        Indexes["idx_notifications_status_end_date / idx_exams_category"]
    end

    URLParams -->|Search Query & Filters| RSC
    RSC -->|Parse & Sanitize Input| ZodValidator
    ZodValidator -->|Validated Filters| DataAccess
    DataAccess -->|Acquire Authenticated Client| SupabaseClient
    SupabaseClient -->|PostgREST Query with Exact Count| RLS
    RLS --> NotifTable
    NotifTable -->|Inner Join| ExamsTable
    ExamsTable --> Indexes
    Indexes -->|Paginated Result + Total Count| DataAccess
    DataAccess -->|Transform to NotificationListItem[]| RSC
```

---

## 3. Data Flow & Security Guardrails
1. **Input Validation**: All incoming query parameters from URL state (`category`, `state`, `search`, `sortBy`, `page`, `pageSize`) are strictly parsed and sanitized by `notificationFilterSchema` via Zod before reaching PostgREST.
2. **Mandatory Row Level Security**: Queries leverage the anonymous Supabase client which strictly evaluates `public.notifications.status = 'published'`, preventing leakage of draft or archived notifications.
3. **No N+1 Database Roundtrips**: The query uses PostgREST inner joins (`exams!inner(...)`) to fetch the conducting body and category metadata in a single network roundtrip.
4. **Resilient Error Recovery**: Any network or database connection anomalies return graceful empty state payloads (`data: []`, `total: 0`, `totalPages: 0`) rather than throwing unhandled runtime exceptions.

---

## 4. Sorting & Index Strategy

| Sort Option | Column Target | Direction | Supporting Composite Index |
|---|---|---|---|
| `deadline_soonest` | `application_end_date` | `ASC NULLS LAST` | `idx_notifications_feed_deadline (status, application_end_date ASC)` |
| `deadline_latest` | `application_end_date` | `DESC NULLS LAST` | `idx_notifications_status_end_date (status, application_end_date DESC)` |
| `recently_published`| `published_at` | `DESC NULLS LAST` | `idx_notifications_status_published (status, published_at DESC)` |
| `vacancies_high_low`| `total_vacancies` | `DESC` | `idx_notifications_vacancies (status, total_vacancies DESC)` |
| `title_asc` | `title` | `ASC` | `idx_notifications_title (status, title ASC)` |
