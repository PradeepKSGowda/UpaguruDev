# ADR-013: Application Security, Access Control & Data Protection

## Status
Accepted

## Date
2026-09-02

## Context & Problem Statement
As an public exam portal serving job seekers across India and hosting an internal HITL administration backend, UPA-GURU must enforce strict security controls to prevent unauthorized content publishing, SQL injection, cross-site scripting (XSS), secret leaks, and data tampering.

Security requirements:
- Zero tolerance for hardcoded API keys, database connection strings, or service roles.
- Mandatory database-level Row Level Security (RLS) policies.
- Strict input validation on all client and API inputs.
- Mandatory administrative audit trail (`audit_logs`) for HITL actions.
- OWASP-compliant security headers and CORS policies.

## Decision Outcome
Adopt a **Multi-Layer Defense-in-Depth Security Framework**.

## Core Security Controls

### 1. No Hardcoded Secrets Guardrail
Secrets, private keys, database connection strings, and service roles must never be committed to source code repositories.
- Local Environment: Configured exclusively via `.env.local` (included in `.gitignore`).
- Production: Injected via platform environment variables (Vercel, Supabase, AWS Secrets Manager).

### 2. Mandatory Row Level Security (RLS)
PostgreSQL table security is enforced at the database layer using explicit RLS policies:
- Public candidate read access limited strictly to `status = 'published'`.
- Write/update access restricted to users with `auth.jwt() ->> 'role' = 'admin'`.

### 3. Strict Input Validation (Zod & Pydantic)
- Frontend & Node.js API handlers validate 100% of incoming payloads using **Zod** schemas.
- Python scraper services validate API response payloads using **Pydantic** models.
- All HTML output is sanitized to eliminate XSS vectors.

### 4. Administrative Audit Trail
All approval, edit, rejection, or deletion actions performed by Admins or Moderators in the HITL verification portal must write an immutable log entry to the `audit_logs` table:
```sql
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    target_entity TEXT NOT NULL,
    target_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. HTTP Security Headers
Configured in `next.config.js`:
- `Content-Security-Policy`: Restricts script/style execution sources.
- `X-Frame-Options: DENY`: Prevents clickjacking framing attacks.
- `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing.
- `Referrer-Policy: strict-origin-when-cross-origin`.

## Consequences

### Positive
- Robust protection against OWASP Top 10 vulnerabilities (SQLi, XSS, SSRF, Broken Access Control).
- Complete accountability for administrative actions via `audit_logs`.
- Prevents catastrophic security breaches caused by credential leaks in git history.

### Negative
- Developers must maintain Zod schemas and RLS policies for every new table or column added.

## Compliance & Guardrails
- Complies strictly with `.agents/rules/AGENTS.md` Rule 1 (No Hardcoded Secrets), Rule 2 (No symptom masking), and Rule 3 (Mandatory RLS, RBAC, Audit Trail).
