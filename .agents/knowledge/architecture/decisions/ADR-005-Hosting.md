# ADR-005: Cloud Hosting & Multi-Tier Deployment Infrastructure

## Status
Accepted

## Date
2026-09-02

## Context & Problem Statement
UPA-GURU requires a resilient, multi-region deployment topology that balances cost, auto-scaling during traffic spikes (e.g. major exam result releases or urgent vacancy alerts), and zero-downtime background crawler execution.

Hosting requirements:
- Low-latency global CDN edge serving for candidate traffic across India.
- Managed serverless PostgreSQL database with automated backups and connection pooling.
- Background worker host capable of executing headless browsers (Playwright) and scheduled cron tasks.

## Decision Outcome
Adopt a **Multi-Tier Managed Cloud Architecture**:

| Service Tier | Hosting Provider | Deployment Strategy |
| :--- | :--- | :--- |
| **Frontend & Web API** | **Vercel** | Serverless / Edge Network (Next.js 15) |
| **Database & Auth & Storage** | **Supabase Cloud** | Managed PostgreSQL 15+, Supabase Auth & Storage |
| **Scraper Microservice** | **AWS ECS Fargate / Railway** | Docker Containerized Python Worker (Playwright + FastAPI) |
| **Cache & Rate Limiter** | **Upstash Redis** | Serverless Global Redis Cluster |

## Infrastructure Details

```
                              ┌────────────────────────┐
                              │     Vercel Edge CDN    │
                              │ (Next.js App Router)   │
                              └───────────┬────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
         ┌──────────────────┐   ┌──────────────────┐  ┌──────────────────┐
         │ Supabase DB & Auth│   │  Upstash Redis   │  │  AWS ECS Worker  │
         │   (PostgreSQL)   │   │ (Edge Rate Limit)│  │ (Python Crawler) │
         └──────────────────┘   └──────────────────┘  └──────────────────┘
```

1. **Vercel Edge Platform**: Houses Next.js Candidate Portal and Admin Dashboard. Provides instant global CDN deployment, dynamic ISR page revalidation, and automatic SSL.
2. **Supabase Cloud**: Dedicated PostgreSQL infrastructure with automated point-in-time recovery (PITR) backups and global connection pooling.
3. **Containerized Scraper Host (AWS ECS / Railway)**: Runs the Python crawler image containing Playwright headless Chromium dependencies and scheduled execution engines.

## Consequences

### Positive
- Operational simplicity: Fully managed platform-as-a-service (PaaS) minimizes infrastructure maintenance.
- Auto-scaling: Vercel and Supabase automatically handle traffic bursts without server provisioning.
- Cost efficiency: Free/low-cost tier usage during initial build phase, scaling linearly with candidate traffic.

### Negative
- Multi-provider architecture requires managing environment secrets across Vercel, Supabase, and AWS/Railway.

## Compliance & Guardrails
- Complies with `.agents/rules/AGENTS.md` Rule 1 (No hardcoded secrets; use `.env.local` / platform environment variables).
