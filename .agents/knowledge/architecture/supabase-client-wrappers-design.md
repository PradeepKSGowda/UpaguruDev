# Architecture & Design Specification: Supabase Auth Client Wrappers

**Task ID**: TASK-01020102  
**Epic / Feature**: EPIC-01 / FEAT-0102  
**Author**: Frontend Engineer Agent  
**Reviewers**: CodeReviewer, SecurityReviewer, ArchitectureReviewer  
**Status**: APPROVED  
**Target Platform**: Next.js 15 App Router, React 19, Supabase Cloud (@supabase/ssr)  

---

## 1. Executive Summary

Next.js 15 App Router utilizes a hybrid rendering paradigm spanning interactive client-side components (`"use client"`), React Server Components (RSC), asynchronous Server Actions, Route Handlers, and Edge Middleware.

To provide consistent, secure authentication state and zero-latency database Row Level Security (RLS) enforcement across these environments, three specialized client wrapper modules are implemented:
1. **Browser Client (`lib/supabase/client.ts`)**: Singleton client utilizing PKCE authentication flow for interactive client components.
2. **Server Client (`lib/supabase/server.ts`)**: Asynchronous cookie-aware client for RSC data fetching, Server Actions, and Route Handlers, plus an isolated `createAdminClient()` for service-role background jobs.
3. **Middleware Client (`lib/supabase/middleware.ts`)**: Edge middleware utility that intercepts every request, refreshes expiring access tokens via `supabase.auth.getUser()`, and synchronizes updated `Set-Cookie` headers between request and response.

---

## 2. Component Boundaries & Lifecycle

```
                                  [ Incoming Request ]
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │    Next.js Edge Middleware              │
                      │    lib/supabase/middleware.ts           │
                      │    - Reads request cookies              │
                      │    - Calls auth.getUser() (Revalidates) │
                      │    - Refreshes expired JWT tokens       │
                      │    - Copies cookies to Request & Resp   │
                      └────────────────────┬────────────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    │                                             │
                    ▼                                             ▼
     ┌─────────────────────────────┐               ┌─────────────────────────────┐
     │  React Server Component     │               │  Interactive Client         │
     │  lib/supabase/server.ts     │               │  lib/supabase/client.ts     │
     │  - Awaits cookies()         │               │  - Browser singleton        │
     │  - Read-only data queries   │               │  - Subscribes onAuthState   │
     │  - Direct DB access via RLS │               │  - Initiates PKCE OAuth     │
     └──────────────┬──────────────┘               └─────────────────────────────┘
                    │
                    ▼
     ┌─────────────────────────────┐
     │  Server Actions / Routes    │
     │  lib/supabase/server.ts     │
     │  - Awaits cookies()         │
     │  - Executes DB mutations    │
     │  - Writes Set-Cookie header │
     └─────────────────────────────┘
```

---

## 3. Detailed Client Specifications

### 3.1 Browser Client (`lib/supabase/client.ts`)
* **Package**: `@supabase/ssr` (`createBrowserClient`)
* **Execution Environment**: Client-side browser only (`"use client"` components).
* **Pattern**: Singleton instance caching (`browserClientInstance`) to eliminate duplicate WebSocket connections and redundant auth listeners.
* **Auth Flow**: PKCE (`flowType: 'pkce'`) with automatic session persistence in cookies.
* **Security**: Uses public keys (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Never accesses private server secrets.

### 3.2 Server Client (`lib/supabase/server.ts`)
* **Package**: `@supabase/ssr` (`createServerClient`)
* **Execution Environment**: Node.js / Edge runtime in Next.js Server Components, Server Actions, and Route Handlers.
* **Next.js 15 Adaptation**: In Next.js 15, `cookies()` from `next/headers` returns a Promise and is invoked as `await cookies()`.
* **Cookie Write Handling**:
  - In React Server Components, attempting to call `cookieStore.set()` during rendering throws a Next.js framework exception. This exception is caught and ignored gracefully in `server.ts` because session tokens are refreshed upstream by the middleware.
  - In Server Actions and Route Handlers, cookie mutations are written directly to `cookieStore`.
* **Administrative Sub-Client (`createAdminClient`)**:
  - Uses `SUPABASE_SERVICE_ROLE_KEY` to bypass Row Level Security.
  - Guarded with `typeof window !== "undefined"` runtime assertion to guarantee zero exposure in client bundles.
  - Configured with `persistSession: false` to ensure admin jobs do not overwrite candidate session cookies.

### 3.3 Middleware Client (`lib/supabase/middleware.ts`)
* **Package**: `@supabase/ssr` (`createServerClient`)
* **Execution Environment**: Next.js Edge Middleware (`middleware.ts`).
* **Session Refresh Mechanics**:
  - Invokes `supabase.auth.getUser()`, which transmits the access token to the Supabase Auth server for cryptographic verification.
  - If the token is near expiration, Supabase issues refreshed tokens via the `setAll` callback.
  - The `setAll` handler updates both the `request.cookies` (forwarded to Server Components) and `response.cookies` (forwarded to the browser).
* **Security Rationale**: Using `supabase.auth.getUser()` rather than `supabase.auth.getSession()` ensures that tampered or revoked JWTs are rejected immediately at the edge.

---

## 4. Security & Compliance Matrix

| Rule / Requirement | Implementation Mechanism | Validation Status |
| :--- | :--- | :--- |
| **No Hardcoded Secrets** (`AGENTS.md` Rule 1) | All credentials mapped to `process.env`. Throws descriptive errors if unset. | PASSED |
| **No Symptom Masking** (`AGENTS.md` Rule 2) | No empty catch blocks. Expected Next.js 15 RSC cookie exceptions are explicitly documented and isolated. | PASSED |
| **Mandatory RLS & RBAC** (`AGENTS.md` Rule 3) | Clients pass authentic JWT claims (`auth.jwt() ->> 'role'`) directly to PostgreSQL RLS policies. | PASSED |
| **Edge Session Integrity** | Middleware executes `getUser()` on every matched request, preventing stale sessions. | PASSED |
| **Zero Client Secret Leakage** | `createAdminClient` asserts server runtime and requires non-public env vars. | PASSED |

---

## 5. Directory Mapping

```
lib/
└── supabase/
    ├── index.ts        # Central barrel export
    ├── client.ts       # Browser client (createBrowserClient)
    ├── server.ts       # Server client (createServerClient, createAdminClient)
    └── middleware.ts   # Edge session refresh (updateSession)
types/
└── database.types.ts   # Full PostgreSQL 15 schema TypeScript definitions
```

---

## 6. Supabase PostgREST Client TypeScript Contract Pattern

During `TASK-03020103`, a critical constraint in `@supabase/supabase-js` (v2.48+) and `@supabase/ssr` was analyzed and resolved:

### The Problem
When performing mutations (`.insert()` or `.update()`), Supabase PostgREST applies `RejectExcessProperties` against `Relation$1['Insert']` or `Relation$1['Update']`. If any foreign key relationship in `types/database.types.ts` omits `referencedColumns: string[]` or `isOneToOne: boolean`, the schema fails `GenericTable` validation. This causes `Schema` to evaluate to `never`, collapsing all `.insert()` and `.update()` argument types to `never` or `never[]`.

### The Resolution Pattern
1. **Strict GenericTable Contract**:
   Every table defined in `types/database.types.ts` must have complete `Relationships` adhering to `GenericRelationship`:
   ```ts
   Relationships: [
     {
       foreignKeyName: "table_fk_name";
       columns: ["local_col"];
       isOneToOne: boolean;
       referencedRelation: "foreign_table";
       referencedColumns: ["id"];
     }
   ];
   ```
2. **Explicit ServerClient Typing**:
   In `lib/supabase/server.ts`, export `type ServerClient = SupabaseClient<Database>`, and cast the return of `createSupabaseServerClient` to `as unknown as ServerClient`. This avoids generic parameter offset issues between `@supabase/ssr` (3 parameters) and `@supabase/supabase-js` (5 parameters).
3. **Literal Enum Precision**:
   Mutation payloads must declare literal enum values using `as const` (e.g. `status: "approved" as const`) to prevent widening to `string`.

