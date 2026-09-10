# Upstash Redis Provisioning & Integration Architecture Design

## 1. Document Metadata
* **Document ID**: DESIGN-REDIS-001
* **Task Reference**: TASK-01040101 (Subtask: SUB-0104010101)
* **Epic Reference**: EPIC-01 (Foundation: Database, Auth & Hosting Infrastructure)
* **Feature Reference**: FEAT-0104 (Upstash Redis Cache & Rate Limiter Setup)
* **Assigned Role**: DevOps Engineer
* **Architecture References**: ADR-001 (Frontend), ADR-004 (Backend), ADR-010 (Caching), ADR-013 (Security)
* **Status**: APPROVED

---

## 2. Objective & System Context
UPA-GURU operates as a high-traffic pan-India portal for central and state government exam notifications. During high-profile release events (such as UPSC Civil Services or SSC CGL results), traffic spikes can reach tens of thousands of concurrent candidate requests.

To protect the backend PostgreSQL database hosted on Supabase, maintain sub-50ms API responses, and prevent scraper abuse or Denial of Service (DoS) attacks on search endpoints, UPA-GURU implements **Upstash Redis** as its distributed Tier-2 caching and rate-limiting tier.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CANDIDATE REQUEST                               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TIER 1: VERCEL EDGE NETWORK & CDN                        │
│            (Edge middleware, SSL termination, static asset delivery)        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                     │
                    ▼                                     ▼
      ┌───────────────────────────┐         ┌───────────────────────────┐
      │  /api/v1/* (Public APIs)  │         │  /notification/[slug] ISR │
      └─────────────┬─────────────┘         └─────────────┬─────────────┘
                    │                                     │
                    ▼                                     │
┌──────────────────────────────────────────────┐          │
│         TIER 2: UPSTASH SERVERLESS REDIS     │          │
│  - Sliding window rate limiter (60 req/min)  │          │
│  - Distributed crawler locks (prevent dupes) │          │
│  - Cached search metadata queries            │          │
└──────────────────────┬───────────────────────┘          │
                       │                                  │
                       ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TIER 3: SUPABASE POSTGRESQL 15+                          │
│               (Mandatory Row Level Security, relational data)                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Upstash Architecture & Edge Protocol
Traditional Redis clients require persistent TCP socket pools (`net.Socket`). In serverless environments (Next.js Edge Middleware and Vercel Serverless Functions), TCP connection pooling suffers from cold-start latency, connection exhaustion, and runtime incompatibility.

### Key Architectural Decisions:
1. **HTTP REST Engine**:
   - Communication with Upstash is conducted strictly via **HTTP REST API** using `@upstash/redis`.
   - Payload serialization is JSON-based, and network transport uses the standard global `fetch()` API supported natively in Edge runtimes.
2. **Geographic Locality**:
   - Primary Redis region: `ap-south-1` (Mumbai, India) to maintain $< 15\text{ms}$ latency to Indian candidates and Vercel edge nodes in `bom1` (Mumbai).
3. **Resilience & Graceful Degradation**:
   - In local offline development where Redis credentials are unconfigured or placeholder strings, `lib/redis.ts` provides graceful fallbacks so local development and RSC rendering remain unblocked.

---

## 4. Environment Variables Specification

| Variable Name | Scope | Description | Secret Level | Example Value |
| :--- | :--- | :--- | :--- | :--- |
| `UPSTASH_REDIS_REST_URL` | Server-side / Edge | REST endpoint for the Upstash database | Sensitive | `https://upaguru-redis-ap-south.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Server-side / Edge | Bearer token for authenticating REST requests | Highly Confidential | `AXzQASQg...` |

### Storage & Injection Rules:
* **Local Machine**: Injected strictly via `.env.local` (enforced by `.gitignore`).
* **CI / GitHub Actions**: Injected via GitHub Actions repository secrets for automated integration pipelines.
* **Production**: Synchronized into Vercel project environment variables across `Production`, `Preview`, and `Development` environments.

---

## 5. Client Implementation & Health Check Design
The centralized client is encapsulated in `lib/redis.ts`:
* **`isRedisConfigured()`**: Validates configuration integrity, ensuring placeholder strings do not cause unhandled runtime exceptions.
* **`createRedisClient()`**: Instantiates the client with an exponential backoff retry strategy ($3$ retries, $\Delta t = e^{\text{retry}} \times 50\text{ms}$).
* **`pingRedis()`**: Executes a REST `PING` command, calculates roundtrip latency, and returns typed telemetry.
* **`scripts/verify-redis.ts`**: Provides operators with an idempotent, standalone CLI verification script.

---

## 6. Downstream Consumption Plan
1. **`TASK-01040102`**: Implement sliding window rate limiting via `@upstash/ratelimit` on `/api/v1/search` and `/api/v1/notifications` (60 requests/60 seconds per client IP).
2. **`EPIC-03` (Crawler Engine)**: Acquire distributed mutex locks (`lock:crawler:kpsc:<id>`, TTL 300s) to prevent concurrent scraping of duplicate government PDF circulars.
3. **`EPIC-08` (Public API Handlers)**: Enforce IP-based throttling and emit standard RFC 7807 rate-limit error responses when quotas are exceeded.
