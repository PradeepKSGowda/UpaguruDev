# Next.js 15 App Router Project Scaffolding Architecture Design

**Task ID**: `TASK-01030101`  
**Subtasks**: `SUB-0103010101`, `SUB-0103010102`, `SUB-0103010103`  
**Epic / Feature**: `EPIC-01` / `FEAT-0103`  
**Architectural ADR Reference**: [ADR-001-Frontend.md](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/.agents/knowledge/architecture/decisions/ADR-001-Frontend.md), [ADR-005-Hosting.md](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/.agents/knowledge/architecture/decisions/ADR-005-Hosting.md)

---

## 1. Executive Summary

`TASK-01030101` establishes the foundational web application scaffold for UPA-GURU using the **Next.js 15 App Router** paradigm, **TypeScript strict mode**, and **Tailwind CSS**. This setup provides the execution environment necessary for:
1. Server-Side Rendering (SSR) & React Server Components (RSC).
2. Clean type-safe imports with path alias `@/*` resolving to root directory.
3. Centralized environment configuration via `.env.local.example`.
4. Production-grade security header and remote image configuration via `next.config.mjs`.

---

## 2. Structural Topology

```
upaguru/
├── app/
│   ├── (portal)/               # Public candidate-facing routes (Feed, Detail, Search)
│   ├── admin/                  # Admin HITL verification dashboard
│   ├── auth/                   # Authentication flows (Login, Register, Callback)
│   ├── globals.css             # Tailwind baseline & CSS design tokens
│   ├── layout.tsx              # Root HTML & body shell with dynamic metadata
│   └── page.tsx                # Homepage hero & category navigation
├── lib/
│   ├── supabase/               # Supabase SSR clients (browser, server, middleware)
│   └── utils.ts                # Shared utilities (cn, formatting)
├── types/
│   └── database.types.ts       # PostgreSQL 15 schema definitions
├── .env.local.example          # Environment variable master schema
├── middleware.ts               # Edge session refresh & route protection
├── next.config.mjs             # Next.js 15 compiler configuration
├── package.json                # Project dependencies & scripts
├── postcss.config.mjs          # PostCSS Tailwind CSS processor
├── tailwind.config.ts          # Brand palette & typography tokens
└── tsconfig.json               # TypeScript compiler configuration (strict mode)
```

---

## 3. Configuration Details

### 3.1 TypeScript Compiler Specification (`tsconfig.json`)
- **Strict Checks**:
  - `strict: true`
  - `noImplicitAny: true`
  - `strictNullChecks: true`
  - `noUncheckedIndexedAccess: true`
  - `noUnusedLocals: true`, `noUnusedParameters: true`
- **Path Aliasing**:
  - `"paths": { "@/*": ["./*"] }` enables absolute path resolution across all modules (e.g. `import { createClient } from "@/lib/supabase/server"`).
- **Module Resolution**:
  - `"moduleResolution": "bundler"` optimizes resolution for modern bundlers (Next.js Turbopack / Webpack).

### 3.2 Next.js Compiler (`next.config.mjs`)
- `reactStrictMode: true`: Enforces component purity and surfaces side-effects early during local development.
- `poweredByHeader: false`: Removes the `x-powered-by: Next.js` HTTP response header for defense-in-depth against server fingerprinting.
- `images.remotePatterns`: Whitelists Supabase storage buckets and Google user profile avatars for optimized image delivery.

### 3.3 Design System & Tailwind CSS
- Extended brand color scale (`brand-50` to `brand-950`) centered on deep navy and vibrant blue.
- Accent emerald scale (`accent-50` to `accent-700`) for verified exam statuses and active application badges.
- Standard CSS variables in `globals.css` with automatic dark mode adjustments.

---

## 4. Verification & Testing Safety

In strict compliance with `AGENTS.md` Rule 2:
- Automated builds and external deployments were **not executed**.
- All configuration files, types, and imports are statically verified to ensure non-breaking integration with previously created components (`lib/supabase/`, `app/auth/`, and `middleware.ts`).
