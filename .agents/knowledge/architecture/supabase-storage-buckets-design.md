# Supabase Storage Buckets & Access Policy Architecture

## 1. Executive Summary & Context
UPA-GURU processes official government recruitment notifications, syllabi attachments, and exam conducting body logos (e.g., KPSC, UPSC, SSC, IBPS, Railways). These media assets require high-throughput global CDN delivery for public candidates alongside strict security isolation for unverified scraper downloads prior to Human-in-the-Loop (HITL) admin approval.

This architectural specification details the configuration and security guardrails for three dedicated Supabase Storage buckets, executing **TASK-06010101** (`SUB-0601010101` and `SUB-0601010102`) in compliance with **ADR-011 (File Storage)**, **ADR-002 (Database)**, and **AGENTS.md Rule 3 (Mandatory Row Level Security)**.

---

## 2. Storage Bucket Topology & Configuration

| Parameter | `public-notifications` | `public-logos` | `draft-attachments` |
| :--- | :--- | :--- | :--- |
| **Bucket ID** | `public-notifications` | `public-logos` | `draft-attachments` |
| **Visibility** | **Public** (`public = true`) | **Public** (`public = true`) | **Private** (`public = false`) |
| **Subtask ID** | `SUB-0601010101` | `SUB-0601010102` | `SUB-0601010102` |
| **Target Content** | Official verified PDF notifications, gazettes, and syllabi | Exam authority & government agency logos (`logo_url`) | Raw crawler-downloaded PDFs awaiting HITL verification |
| **Max File Size** | **50 MB** (`52,428,800` bytes) | **5 MB** (`5,242,880` bytes) | **50 MB** (`52,428,800` bytes) |
| **Allowed MIME Types** | `application/pdf` | `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml` | `application/pdf` |
| **CDN Caching** | `public, max-age=31536000, immutable` (1 year) | `public, max-age=31536000, immutable` (1 year) | `private, no-cache, no-store` |
| **Access Model** | Public Read / Admin Write | Public Read / Admin Write | Admin & Service Role Only |
| **Delivery URL** | Global CDN Public URL | Global CDN Public URL | Time-limited Signed URLs (15-min TTL) |

---

## 3. End-to-End Asset Lifecycle & Pipeline

```
  [ Government Portal / KPSC / UPSC ]
                   │
                   ▼  (Python Scraper / Crawler)
   ┌──────────────────────────────────────────────┐
   │  1. Ingestion into 'draft-attachments'       │
   │     - Private bucket                         │
   │     - Service-role authentication            │
   │     - File integrity & SHA-256 check         │
   └──────────────────────┬───────────────────────┘
                          │
                          ▼
   ┌──────────────────────────────────────────────┐
   │  2. AI Structured Extraction Engine          │
   │     - Gemini 1.5 Flash reads draft PDF       │
   │     - Extracts posts, dates, qualifications   │
   └──────────────────────┬───────────────────────┘
                          │
                          ▼
   ┌──────────────────────────────────────────────┐
   │  3. Admin HITL Review Workspace              │
   │     - Admin views PDF via 15-min signed URL  │
   │     - Verifies metadata accuracy             │
   └──────────────────────┬───────────────────────┘
                          │ (Admin Approves & Publishes)
                          ▼
   ┌──────────────────────────────────────────────┐
   │  4. Promotion to 'public-notifications'      │
   │     - File copied to public bucket           │
   │     - Immutable CDN URL attached to record   │
   │     - Draft attachment pruned/archived       │
   └──────────────────────┬───────────────────────┘
                          │
                          ▼
   ┌──────────────────────────────────────────────┐
   │  5. Global Candidate Access                  │
   │     - Edge CDN delivers cached PDF           │
   │     - Zero compute load on application core  │
   └──────────────────────────────────────────────┘
```

---

## 4. Row Level Security & RBAC Enforcement

Storage security is governed by Supabase RLS on `storage.objects` adhering to the default-deny principle:

### 4.1. Public Buckets (`public-notifications` & `public-logos`)
1. **Public Read Access (`SELECT`)**:
   - Condition: `bucket_id = 'public-notifications'` (or `'public-logos'`).
   - Grants instantaneous public read without requiring session cookies or bearer tokens.
2. **Admin Mutation Access (`INSERT`, `UPDATE`, `DELETE`)**:
   - Condition: User must possess role `'admin'` or `'super_admin'` via either `auth.jwt() -> 'app_metadata' ->> 'role'` or verified membership in `public.profiles`.
   - Prevents unauthorized modification, file replacement, or deletion by unprivileged users.

### 4.2. Private Bucket (`draft-attachments`)
1. **Admin Read Access (`SELECT`)**:
   - Access restricted strictly to users with role `'admin'` or `'super_admin'`. Unauthenticated or candidate users receive HTTP 403 Forbidden.
2. **Scraper / Backend Insertion (`INSERT`)**:
   - Python crawlers connect via `SUPABASE_SERVICE_ROLE_KEY`, which automatically bypasses RLS on the server.
   - Admin console operators can also upload replacement attachments when manually resolving draft issues.
3. **Admin Cleanup (`DELETE`, `UPDATE`)**:
   - Restricted strictly to `'admin'` and `'super_admin'`.

---

## 5. Security & Idempotency Safeguards

1. **Policy Idempotency**:
   - Due to PostgreSQL error `ERROR: 42710` when invoking duplicate `CREATE POLICY` statements, all policies are explicitly preceded by `DROP POLICY IF EXISTS "policy_name" ON storage.objects;`.
2. **Strict File Size Bounds**:
   - Supabase storage server-level configuration blocks uploads exceeding 50 MB for PDF notifications and 5 MB for exam logos at the HTTP gateway layer.
3. **Strict MIME Filtering**:
   - Rejects executable files, scripts, or non-PDF/non-image binaries before storage allocation.
4. **Storage Table Ownership & Pre-enabled RLS**:
   - `storage.objects` is owned internally by `supabase_storage_admin` with RLS pre-enabled by default. DDL commands such as `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;` are blocked with `ERROR: 42501 (must be owner of table objects)`. Security policies can be directly added/dropped via standard SQL.
