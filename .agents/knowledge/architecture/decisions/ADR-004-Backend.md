# ADR-004: Hybrid Serverless & Python Microservice Backend Architecture

## Status
Accepted

## Date
2026-09-02

## Context & Problem Statement
UPA-GURU operates two specialized backend processing domains:
1. **Candidate Portal & HITL API Domain**: High-speed HTML rendering, Server Actions for candidate forms/filters, admin review workflows, and instant database querying.
2. **Crawler & AI Extraction Microservice Domain**: Daily automated web crawling of official government portals (KPSC, UPSC, SSC, RRB), PDF document downloading, optical character recognition (OCR), and structured LLM extraction via Google Gemini API.

A pure single-monolith backend (either 100% Node.js or 100% Python) creates friction: Node.js excels at edge web serving and Next.js integration, whereas Python possesses superior scraping (Playwright, BeautifulSoup) and data processing libraries.

## Decision Outcome
Adopt a **Hybrid Backend Architecture**:
- **Primary Web API & UI Backend**: Next.js 15 App Router Server Actions & Route Handlers (Node.js / Edge runtime).
- **Background Worker & Crawler Microservice**: Python (FastAPI + Playwright + Celery/APScheduler).

## Architecture Blueprint

```
                     ┌──────────────────────────────────┐
                     │ Candidate Portal / Admin Dashboard│
                     │         (Next.js 15 SSR)         │
                     └────────────────┬─────────────────┘
                                      │ Supabase Client / Server Actions
                                      ▼
                     ┌──────────────────────────────────┐
                     │   Supabase PostgreSQL + Auth     │
                     └────────────────▲─────────────────┘
                                      │ REST / Direct DB Client
                                      │
                     ┌────────────────┴─────────────────┐
                     │ Python Crawler & AI Microservice │
                     │   (FastAPI / Playwright / LLM)   │
                     └──────────────────────────────────┘
```

### 1. Next.js 15 App Tier (Candidate & Admin)
- Handles dynamic routing (`/notification/[slug]`), RSS/Sitemap generation, user authentication, and admin verification actions.
- Uses Server Actions for internal mutations and Zod schema validation.

### 2. Python Crawler Microservice Tier
- Periodically crawls government portals for newly issued notification PDFs.
- Passes raw text and attachment buffers to Gemini API for structured JSON parsing.
- Inserts parsed records directly into `draft_notifications` table with status `pending_review`.

## Consequences

### Positive
- Leverage best tool for each domain: Next.js for high-speed edge web serving and SEO; Python for robust document scraping and AI pipelines.
- Independent scalability: Scrapers can run heavy batch jobs without impacting candidate web request latency.

### Negative
- Requires maintaining two runtime stacks (TypeScript/Node.js and Python).
- Shared type definitions must be kept in sync between Python Pydantic models and TypeScript Zod schemas.

## Compliance & Guardrails
- Complies with `.agents/rules/AGENTS.md` Rule 1 (Next.js 15 RSC & Zod) and Rule 2 (No symptom masking).