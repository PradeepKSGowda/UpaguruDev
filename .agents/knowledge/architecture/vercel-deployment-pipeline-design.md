# Vercel Deployment Pipeline & Environment Secrets Management Design

**Task ID**: `TASK-01030102`  
**Subtasks**: `SUB-0103010201`, `SUB-0103010202`  
**Epic / Feature**: `EPIC-01` / `FEAT-0103`  
**Architecture Reference**: [ADR-005-Hosting.md](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/.agents/knowledge/architecture/decisions/ADR-005-Hosting.md), [ADR-013-Security.md](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/.agents/knowledge/architecture/decisions/ADR-013-Security.md)

---

## 1. Objective & Scope

Establish the Git-integrated CI/CD deployment pipeline between GitHub and Vercel Edge Platform for UPA-GURU, ensuring:
1. **Production Branch Automation**: Every merge or push to `main` generates a zero-downtime production deployment on Vercel Edge.
2. **Preview Environments**: Every Pull Request automatically provisions an isolated preview URL for Human-In-The-Loop (HITL) testing.
3. **Environment Segregation**: Production vs. Preview secret isolation across Supabase, Upstash Redis, Google OAuth, and Sentry.
4. **Edge Regional Affinity**: Primary edge function execution pinned to Mumbai, India (`bom1`) for minimum latency.

---

## 2. Deployment Architecture

```
                  ┌───────────────────────────────┐
                  │      GitHub Repository        │
                  │   (PradeepKSGowda/UpaguruDev) │
                  └───────────────┬───────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  │ GitHub Actions (.github/ci)   │
                  │  - TypeScript typecheck       │
                  │  - ESLint static analysis     │
                  └───────────────┬───────────────┘
                                  │
                 ┌────────────────┴────────────────┐
                 ▼                                 ▼
   [Branch: main]                     [Pull Request: Any]
         │                                         │
         ▼                                         ▼
┌─────────────────────────┐             ┌─────────────────────────┐
│ Vercel Production Edge  │             │ Vercel Preview Sandbox  │
│ - Region: bom1 (Mumbai) │             │ - Ephemeral URL         │
│ - Live Supabase Prod DB │             │ - Branch isolation     │
│ - Prod Redis Cache      │             │ - Safe test database    │
└─────────────────────────┘             └─────────────────────────┘
```

---

## 3. Environment Variable Matrix

| Variable Name | Scope | Target Environments | Secret Classification |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public (Client + Server) | Production, Preview, Development | Public URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (Client + Server) | Production, Preview, Development | Public JWT Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Private (Server-Side Only) | Production, Preview | Critical Master Secret |
| `DATABASE_URL` | Private (Server-Side Only) | Production, Preview | Direct Database Credentials |
| `NEXT_PUBLIC_SITE_URL` | Public (Client + Server) | Production (`https://upaguru.in`), Preview (`https://*.vercel.app`) | Host Configuration |
| `NEXT_PUBLIC_AUTH_CALLBACK_URL` | Public (Client + Server) | Production, Preview | OAuth Return Endpoint |
| `GOOGLE_CLIENT_ID` | Private (Server-Side Only) | Production, Preview | OAuth Identity |
| `GOOGLE_CLIENT_SECRET` | Private (Server-Side Only) | Production, Preview | OAuth Secret |
| `UPSTASH_REDIS_REST_URL` | Private (Server-Side Only) | Production, Preview | Cache Endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Private (Server-Side Only) | Production, Preview | Cache Auth Token |
| `NEXT_PUBLIC_SENTRY_DSN` | Public (Client + Server) | Production, Preview | Telemetry DSN |

---

## 4. Edge Regional Optimization (`vercel.json`)

To minimize latency for government exam candidates across all Indian states:
- Configured `"regions": ["bom1"]` in [vercel.json](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/vercel.json) ensuring edge compute occurs physically in Mumbai.
- Clean URLs enabled to omit `.html` extensions and improve SEO crawler performance.
