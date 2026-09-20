# Cache Tags & On-Demand ISR Revalidation Strategy

## 1. Executive Summary & Problem Context
UPA-GURU operates in a high-concurrency public service recruitment domain where government job announcements trigger massive traffic surges. Candidates require sub-50ms page load speeds, while platform administrators require immediate cache purging whenever exam details, vacancy counts, or application deadlines are modified.

Executing **TASK-06020101** (`SUB-0602010101`) completes **EPIC-06 (File Storage, Caching & CDN Infrastructure)** by integrating a centralized cache revalidation engine (`lib/cache/revalidate.ts`) and canonical tag registry (`lib/cache/tags.ts`) across all Next.js 15 Server Actions.

---

## 2. Multi-Layer Caching Architecture (ADR-010)

```
                            Candidate Web / Mobile Request
                                          │
                                          ▼
                ┌──────────────────────────────────────────────────┐
                │          Tier 1: Edge CDN Invalidation           │
                │   - Vercel Edge Network global caching           │
                │   - Sub-50ms responses on pre-rendered HTML      │
                └─────────────────────────┬────────────────────────┘
                                          │ Cache Miss / Tag Purge
                                          ▼
                ┌──────────────────────────────────────────────────┐
                │          Tier 2: Upstash Redis Layer             │
                │   - Distributed sliding-window rate limiting     │
                │   - Crawler deduplication mutex locks            │
                └─────────────────────────┬────────────────────────┘
                                          │ Data Query
                                          ▼
                ┌──────────────────────────────────────────────────┐
                │          Tier 3: Supabase PostgreSQL DB          │
                │   - Indexed relational persistence with RLS      │
                │   - Audit & ISR revalidation telemetry queue     │
                └──────────────────────────────────────────────────┘
```

---

## 3. Canonical Cache Tag Hierarchy

| Cache Tag | Target Resource | Invalidation Triggers |
| :--- | :--- | :--- |
| **`notifications`** | All notification feeds, homepage feed, and directory | Publish, update, archive, delete notification |
| **`notification-[slug]`** | Specific notification detail page (`/notification/[slug]`) | Metadata update, deadline change, PDF link update |
| **`exams`** | Master examinations feed and directory (`/exams`) | Create, update, delete master exam |
| **`exam-[slug]`** | Master examination detail page (`/exam/[slug]`) | Exam title, conducting body, syllabus summary update |
| **`category-[category]`** | Programmatic category route (`/category/[category]`) | Notification assigned or modified in category |
| **`state-[state]`** | Programmatic state route (`/state/[state]`) | State PSC or Central notification updated |
| **`drafts`** | Admin draft verification dashboard (`/admin/drafts`) | Scraper ingestion, draft approval, draft rejection |
| **`sitemap`** | XML Sitemap & Robots (`/sitemap.xml`) | Publication, archiving, or deletion of any entity |
| **`feeds`** | RSS and Atom feeds (`/feed.xml`) | Publication or status transition to live |
| **`preferences`** | Candidate subscription center (`/preferences`) | Alert categories, states, or channels saved |

---

## 4. Server Action Invalidation Matrix

All platform mutations call centralized revalidation helpers, ensuring zero stale content:

| Action File | Mutation Action | Invalidation Calls |
| :--- | :--- | :--- |
| **`app/admin/drafts/actions.ts`** | `publishNotificationAction` | `revalidateNotification(slug, cat, state)`, `revalidateDraft(draftId)` |
| **`app/admin/drafts/actions.ts`** | `rejectDraftAction` | `revalidateDraft(draftId)` |
| **`app/admin/notifications/actions.ts`** | `createNotificationAction` | `revalidateNotification(slug, cat)` |
| **`app/admin/notifications/actions.ts`** | `updateNotificationAction` | `revalidateNotification(slug, previousSlug, cat)` |
| **`app/admin/notifications/actions.ts`** | `archiveNotificationAction` | `revalidateNotification(slug, reason: 'status_change')` |
| **`app/admin/notifications/actions.ts`** | `deleteNotificationAction` | `revalidateNotification(slug, reason: 'status_change')` |
| **`app/admin/exams/actions.ts`** | `createExamAction` | `revalidateExam(slug, cat, state)` |
| **`app/admin/exams/actions.ts`** | `updateExamAction` | `revalidateExam(slug, previousSlug, cat, state)` |
| **`app/admin/exams/actions.ts`** | `deleteExamAction` | `revalidateExam(slug)` |
| **`app/preferences/actions.ts`** | `updateSubscriptionPreferences` | `revalidateCandidatePreferences(userId)` |

---

## 5. Telemetry & Observability
Every invocation of `revalidateNotification()` and `revalidateExam()` logs an entry to `public.isr_revalidation_queue` with timestamp, route path, slug, and status, providing auditability for CDN cache purges and edge revalidations.
