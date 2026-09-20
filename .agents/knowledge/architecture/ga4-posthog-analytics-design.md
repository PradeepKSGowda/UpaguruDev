# Google Analytics 4 (GA4) & PostHog Product Analytics Architecture

## 1. Executive Summary & Context
In accordance with **ADR-013 (Observability, Analytics & Error Tracking)**, UPA-GURU utilizes a dual-engine product analytics stack to measure candidate discovery, conversion funnels, and retention without impacting Core Web Vitals or compromising candidate privacy:

1. **Google Analytics 4 (GA4)**: Captures macroeconomic platform traffic, geographical distribution (Central vs. State candidates), organic search acquisition, and device categories.
2. **PostHog Product Analytics**: Captures high-resolution candidate behavior, search query intent, filter refinements, vacancy notification engagement, and bookmark conversion paths.

Executing **TASK-07020101** (`SUB-0702010101` and `SUB-0702010102`) integrates both analytics systems into Next.js 15 App Router.

---

## 2. Dual-Engine Analytics Architecture

```
                             Candidate Web Session
                                       │
                                       ▼
                   ┌───────────────────────────────────────┐
                   │           app/layout.tsx              │
                   │   - RootLayout mounts Provider        │
                   └───────────────────┬───────────────────┘
                                       │
                                       ▼
                   ┌───────────────────────────────────────┐
                   │    components/analytics/              │
                   │    AnalyticsProvider.tsx              │
                   │   - GA4 script (afterInteractive)     │
                   │   - PostHog SDK initialization        │
                   │   - Suspense-wrapped route tracker    │
                   └───────────────────┬───────────────────┘
                                       │
                      SPA Navigation & User Interactions
                                       │
                ┌──────────────────────┴──────────────────────┐
                │                                             │
                ▼                                             ▼
    ┌─────────────────────────┐                   ┌─────────────────────────┐
    │     GA4 Engine          │                   │     PostHog Engine      │
    │  - Page path tracking   │                   │  - search_performed     │
    │  - Acquisition funnels  │                   │  - notification_viewed  │
    │  - Ingest: google.com   │                   │  - filter_applied       │
    └─────────────────────────┘                   │  - outbound_click       │
                                                  │  - bookmark_toggled     │
                                                  │  - subscription_updated │
                                                  └─────────────────────────┘
                                                              │
                                                              ▼
                                                   Supabase analytics_event_logs
                                                    (Admin verification ledger)
```

---

## 3. Component Architecture & File Inventory

| Component | File Path | Scope & Responsibility |
| :--- | :--- | :--- |
| **Types & Contracts** | `lib/analytics/types.ts` | Strict TypeScript interface contracts defining payloads for all candidate action events. |
| **GA4 Client** | `lib/analytics/gtag.ts` | Dispatches `gtag('config')` and `gtag('event')` with window availability guards. |
| **PostHog Client** | `lib/analytics/posthog.ts` | Initializes PostHog with `capture_pageview: false`, `person_profiles: 'identified_only'`. |
| **Universal Hook** | `hooks/useAnalytics.ts` | Reusable React hook exposing `trackSearch()`, `trackNotificationView()`, `trackFilterApplied()`, `trackOutboundClick()`, `trackBookmark()`, and `trackSubscription()`. |
| **Analytics Provider** | `components/analytics/AnalyticsProvider.tsx` | Client component rendering Next.js `Script` tags and `<Suspense>` route change listener. |
| **Root Layout** | `app/layout.tsx` | Mounts `AnalyticsProvider` into the global DOM tree. |
| **Module Barrel** | `lib/analytics/index.ts` | Central barrel exporting types, clients, and hooks. |
| **Database Schema** | `analytics-events-schema-v1.sql` | Relational audit ledger in PostgreSQL with mandatory RLS. |

---

## 4. Standardized Event Taxonomy

| Event Name | Key Properties | Trigger / Placement |
| :--- | :--- | :--- |
| **`search_performed`** | `query`, `results_count`, `category`, `state`, `filter_count` | Candidate executes keyword search in `SearchBar` or `/search` page |
| **`notification_viewed`** | `notification_id`, `slug`, `title`, `category`, `state`, `total_vacancies` | Candidate mounts `/notification/[slug]` detail page |
| **`filter_applied`** | `filter_type`, `filter_value`, `active_filters_count` | Candidate selects Category, State, or Qualification in `FilterBar` |
| **`outbound_click`** | `url`, `target_type`, `notification_id`, `notification_slug` | Candidate clicks "Apply Online" or "Download Official PDF" |
| **`bookmark_toggled`** | `notification_id`, `action` (`added` \| `removed`), `title` | Candidate clicks bookmark star on notification card |
| **`subscription_updated`** | `channels`, `categories`, `states`, `exam_ids` | Candidate updates alert channels in `/preferences` |
| **`$pageview`** | `$current_url`, `path`, `query` | Automatic SPA client-side route transitions |

---

## 5. Privacy, Consent & Performance Guardrails
1. **Zero Render Blocking**: GA4 scripts load with `strategy="afterInteractive"`, ensuring the First Contentful Paint (FCP) of candidate UI is unaffected.
2. **Next.js Static Generation Safety**: `AnalyticsPageViewTracker` wraps `useSearchParams()` inside `<Suspense fallback={null}>`, preventing Next.js 15 from de-optimizing static page pre-rendering.
3. **Identified Only Profiles**: PostHog is configured with `person_profiles: 'identified_only'` to prevent creating bloat profiles for anonymous visitors.
4. **CSP Whitelisting**: `next.config.mjs` explicitly permits `connect-src https://*.posthog.com https://*.google-analytics.com` and `script-src https://*.googletagmanager.com https://*.posthog.com`.
