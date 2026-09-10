# Sliding Window Rate Limiter Architecture Design

## 1. Document Metadata
* **Document ID**: DESIGN-RATELIMIT-001
* **Task Reference**: TASK-01040102 (Subtasks: SUB-0104010201, SUB-0104010202)
* **Epic Reference**: EPIC-01 (Foundation: Database, Auth & Hosting Infrastructure)
* **Feature Reference**: FEAT-0104 (Upstash Redis Cache & Rate Limiter Setup)
* **User Story**: STORY-010401 (Redis-backed rate limiting on public API endpoints)
* **Assigned Role**: Backend Engineer
* **Architecture References**: ADR-004 (Backend), ADR-010 (Caching), ADR-013 (Security), ADR-014 (API Design)
* **Status**: APPROVED

---

## 2. Objective & Problem Statement
Public endpoints on UPA-GURU (specifically `/api/v1/search` and `/api/v1/notifications`) provide real-time exam notification intelligence to job seekers across India. During peak recruitment cycles, aggressive web scrapers and unauthorized bots attempt rapid bulk scraping, risking database resource exhaustion, API latency spikes, and potential denial of service.

The platform requires a distributed, sub-millisecond rate limiter that:
1. Enforces a **sliding window** threshold of **60 requests per 60 seconds per client IP**.
2. Avoids boundary burst vulnerabilities inherent in fixed-window counters.
3. Responds with standardized **RFC 7807 Problem Details** (`application/problem+json`) with standard HTTP rate-limiting headers (`Retry-After`, `X-RateLimit-*`).
4. Bypasses verified administrative operators (`admin`, `super_admin`) to prevent obstruction of internal HITL workflows.
5. Provides an in-memory fallback for offline/local development when Redis credentials are not configured.

---

## 3. Algorithm: Sliding Window via `@upstash/ratelimit`
Unlike fixed-window counters (which reset on exact clock boundaries and allow $2 \times \text{limit}$ bursts across the boundary), the **Sliding Window** algorithm calculates usage dynamically:

$$\text{Estimated Requests} = \text{Requests in Current Window} + \left(\text{Requests in Previous Window} \times \left(1 - \frac{\Delta t_{\text{current}}}{\text{Window Duration}}\right)\right)$$

```
  Previous Window (60s)              Current Window (60s)
[  40 requests recorded  ]  ───►  [  15 requests recorded  ]
             ▲                                    ▲
             └─────────── Sliding Ratio ──────────┘
```

This mathematical smoothing guarantees that client traffic can never exceed 60 requests in *any* rolling 60-second span.

---

## 4. Architectural Components & Implementation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Incoming HTTP Request (Edge / Node)                   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    checkRateLimit(request) in lib/rate-limit.ts             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Check isAdminRequest(request):                                           │
│    - If role in ('admin', 'super_admin') ──► RETURN null (Bypass Limiter)   │
│                                                                             │
│ 2. Extract Client IP:                                                       │
│    - Evaluates x-forwarded-for -> x-real-ip -> localhost                    │
│                                                                             │
│ 3. Execute Sliding Window Evaluation:                                       │
│    - Upstash Redis configured? ──► Ratelimit.slidingWindow(60, "60 s")      │
│    - Upstash unconfigured/offline? ──► InMemorySlidingWindowLimiter         │
│                                                                             │
│ 4. Outcome Check:                                                           │
│    - success == true: RETURN null (Request Proceeds to Handler)             │
│    - success == false: RETURN 429 Too Many Requests (RFC 7807 JSON)         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                  ┌────────────────────┴────────────────────┐
                  │                                         │
        [Allowed: Return null]                    [Exceeded: Return 429]
                  │                                         │
                  ▼                                         ▼
   ┌───────────────────────────────┐        ┌───────────────────────────────┐
   │ Route Handler Execution       │        │ HTTP 429 Response             │
   │ - /api/v1/search              │        │ - Content-Type: problem+json  │
   │ - /api/v1/notifications       │        │ - Retry-After: <seconds>      │
   │                               │        │ - X-RateLimit-Limit: 60       │
   │ (Returns 200 OK + Data)       │        │ - X-RateLimit-Remaining: 0    │
   └───────────────────────────────┘        └───────────────────────────────┘
```

---

## 5. RFC 7807 Error Response Schema

When rate limits are exceeded, route handlers emit the following payload:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/problem+json
Retry-After: 42
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1789012384000
```

```json
{
  "type": "https://upaguru.in/errors/rate-limit-exceeded",
  "title": "Too Many Requests",
  "status": 429,
  "detail": "Rate limit exceeded: Maximum 60 requests per minute allowed. Please retry after 42 seconds.",
  "instance": "/api/v1/search",
  "retryAfterSeconds": 42
}
```

---

## 6. Route Handler Integration
Both target endpoints wrap their request lifecycle with `checkRateLimit`:
1. **`/api/v1/search`**: Sanitizes query (`q`), category filter, pagination, and validates rate quotas before processing queries.
2. **`/api/v1/notifications`**: Validates status and state filters with 120s Edge CDN caching and strict IP-based rate controls.
