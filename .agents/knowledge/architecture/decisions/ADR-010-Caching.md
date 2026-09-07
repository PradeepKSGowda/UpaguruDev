# ADR-010: Multi-Layer Caching & Revalidation Strategy

## Status
Accepted

## Date
2026-09-02

## Context & Problem Statement
UPA-GURU experiences sudden traffic spikes when major government notifications are released. Thousands of candidates simultaneously query the portal, search for active exams, and download notification details.

 caching requirements:
- Sub-50ms global content delivery for published notification pages.
- Minimal direct database load during peak traffic events.
- Real-time cache invalidation whenever an Admin edits or publishes a notification.
- Distributed rate limiting to prevent scraper abuse and DDoS attacks on search APIs.

## Decision Outcome
Adopt a **Three-Tier Caching & Invalidation Architecture**:
- **Tier 1 (Edge CDN Cache)**: Vercel Edge Network serving pre-rendered HTML and static assets.
- **Tier 2 (Distributed Key-Value Store)**: **Upstash Redis** for API rate limiting, crawler deduplication locks, and session caching.
- **Tier 3 (Next.js ISR & On-Demand Revalidation)**: Next.js Incremental Static Revalidation combined with `revalidatePath()` triggers.

## Architecture Blueprint

```
                      Candidate HTTP Request
                                │
                                ▼
                   ┌──────────────────────────┐
                   │  Tier 1: Vercel Edge CDN │ ◄── Cache Hit (sub-50ms)
                   └────────────┬─────────────┘
                                │ Cache Miss / Dynamic
                                ▼
                   ┌──────────────────────────┐
                   │ Tier 2: Upstash Redis    │ (Rate Limits & Locks)
                   └────────────┬─────────────┘
                                │ Data Fetch
                                ▼
                   ┌──────────────────────────┐
                   │ Tier 3: Supabase DB      │
                   └──────────────────────────┘
```

## Cache Invalidation Workflow
1. When an Admin publishes or edits a notification via the HITL Dashboard, Next.js calls `revalidatePath('/notification/[slug]')` and `revalidateTag('notifications')`.
2. Vercel Edge CDN automatically purges the stale cache entry for that specific URL.
3. The next candidate request triggers a background ISR update, regenerating the static HTML with zero downtime.

## Redis Usage (Upstash)
- **Rate Limiting**: Sliding window rate limiting on `/api/v1/search` (max 60 requests/minute per IP).
- **Scraper Deduplication**: Distributed lock keys (`lock:crawler:kpsc:pdf_123`) to prevent duplicate scraping runs across concurrent Python workers.

## Consequences

### Positive
- Sub-50ms page load times across India via Vercel CDN edge nodes.
- PostgreSQL database CPU load remains $< 10\%$ even during viral traffic spikes.
- Instant cache purging guarantees candidates always see accurate, updated application deadlines.

### Negative
- Requires careful handling of tag-based cache keys to prevent over-invalidation.

## Compliance & Guardrails
- Complies strictly with `.agents/rules/AGENTS.md` Rule 4 (Edge Caching & Redis revalidation logic).
