# ADR-001: Next.js 15 App Router Frontend Architecture

## Status
Accepted

## Date
2026-09-02

## Context & Problem Statement
UPA-GURU is a high-traffic government exam notification and candidate portal. The candidate-facing application requires exceptional page load speeds (Lighthouse Mobile SEO & Performance score $\ge 95$), seamless search engine indexing (Programmatic SEO), rich dynamic interactive filters (State, Category, Application Deadline), and a dedicated Admin HITL (Human-In-The-Loop) verification dashboard.

The frontend framework must support:
- Server-Side Rendering (SSR) and Incremental Static Revalidation (ISR) for fast dynamic pages.
- React Server Components (RSC) to minimize client-side JavaScript bundle sizes.
- Strict TypeScript type safety across component props, data fetching, and API bindings.
- Built-in schema validation (Zod) for user forms and candidate inputs.

## Options Considered

### Option 1: Single Page Application (SPA) with React + Vite
- **Pros**: Simple setup, rapid local development, lightweight client routing.
- **Cons**: Poor out-of-the-box SEO capability, client-side rendering delay, search crawler indexability challenges, and large initial bundle downloads.
- **Result**: Rejected.

### Option 2: Next.js 15 (App Router with React Server Components)
- **Pros**: Native SSR/ISR support, hybrid Server & Client components, built-in metadata API for programmatic SEO, automatic image/font optimization, low client JavaScript overhead.
- **Cons**: Requires server execution environment or edge runtime; stricter paradigm for state management.
- **Result**: **Accepted**.

### Option 3: Remix / TanStack Start
- **Pros**: Good data loading model and web standards focus.
- **Cons**: Smaller ecosystem for Google JSON-LD schema integrations and edge deployments compared to Next.js.
- **Result**: Rejected.

## Decision Outcome
Adopt **Next.js 15 App Router** with **React Server Components (RSC)**, **TypeScript (Strict Mode)**, **Vanilla CSS / Tailwind CSS**, and **Zod** schema validation.

### Key Architectural Guidelines
1. **Server Components by Default**: All notification feed lists, exam pages, and static metadata views use RSC for zero-bundle rendering.
2. **Client Components at Interactive Boundaries**: Used strictly for debounced search inputs, category filter pills, modal popups, and admin HITL interactive side-by-side verification tools (`"use client"`).
3. **Zod Validation**: All URL query parameters, form inputs, and API payload parsing must use strict Zod schemas.
4. **Performance & SEO Target**: Mobile SEO and Performance scores must reach $\ge 95$ on Google Lighthouse.

## Consequences

### Positive
- Exceptional SEO performance with instant server HTML rendering.
- Reduced time-to-interactive (TTI) and First Contentful Paint (FCP).
- Unified codebase for Candidate Portal and Admin Verification Dashboard.
- End-to-end type safety between data access layer and UI views.

### Negative
- Higher learning curve for RSC component boundary segregation.
- Careful handling required to avoid accidentally pulling client state into server components.

## Compliance & Guardrails
- Complies strictly with `.agents/rules/AGENTS.md` Rule 1 (Next.js 15 App Router & RSC) and Rule 4 (Lighthouse score $\ge 95$).