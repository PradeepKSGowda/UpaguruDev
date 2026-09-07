# Skill: Security Review & Guardrail Auditing (`security-review.md`)

## Input
- **Target Code / Artifact**: Source code file (`.tsx`, `.ts`, `.py`, `.sql`), pull request diff, or configuration file (`next.config.js`, `Dockerfile`).
- **Review Scope**: Authentication/authorization flows, database migrations, API endpoints, file uploads, or third-party webhooks.
- **Security Policy Context**: `AGENTS.md` rules (no hardcoded secrets, mandatory RLS, RBAC, audit logs).

---

## Output
- **Security Audit Report**: Structured evaluation of the code against the OWASP Top 10 and UPA-GURU security policies.
- **Vulnerability Matrix**: Findings categorized by severity (`Critical`, `High`, `Medium`, `Low`, `Informational`).
- **Remediation Code Diffs**: Exact unified diff blocks showing required security fixes.
- **Pass / Fail Gate Decision**: Unambiguous binary verdict on whether the code is approved for production deployment.

---

## Checklist
- [ ] No hardcoded secrets, API keys, service roles, or connection strings found in source code (`AGENTS.md` Rule 1).
- [ ] All environment variables read via `process.env` (Next.js) or `os.environ` (Python).
- [ ] Every PostgreSQL table has Row Level Security enabled (`ENABLE ROW LEVEL SECURITY`) (`AGENTS.md` Rule 3).
- [ ] All client inputs parsed and sanitized using strict Zod or Pydantic schemas (preventing SQLi, XSS, prototype pollution).
- [ ] Admin actions enforce role verification (`auth.jwt() ->> 'role' = 'admin'`) and log to `audit_logs` (`AGENTS.md` Rule 3).
- [ ] User self-service endpoints enforce strict ownership (`auth.uid() = user_id`).
- [ ] No empty `try/catch` blocks suppressing errors or hiding failures (`AGENTS.md` Rule 2).
- [ ] File uploads validate MIME type, file extension, and enforce size limits (≤ 50MB).
- [ ] HTTP response headers include CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff.
- [ ] Public API routes enforce Upstash Redis rate limiting to mitigate denial of service.

---

## Prompt Template
```markdown
You are the Security Specialist Agent for UPA-GURU.
Perform a security audit of the following code against UPA-GURU guardrails:

Target File / PR: [FILE_PATH]
Code Under Review:
"""
[PASTE_CODE_OR_DIFF]
"""

Review Priorities:
1. Scan for hardcoded secrets, credentials, or service role keys.
2. Check Row Level Security (RLS) policies and RBAC role gating.
3. Inspect input validation (Zod/Pydantic) for injection vulnerabilities.
4. Verify audit log creation for administrative mutations.
5. Check error handling for silent swallowing or information leaks.

Output:
- Findings table with Severity, Location, Description.
- Unified remediation diffs.
- Final Gate: PASS or FAIL.
```

---

## Examples

### Example 1: Security Audit Finding & Remediation
#### Finding (CRITICAL): Hardcoded Supabase Service Key in Client Component
```diff
--- a/components/AdminDraftReview.tsx
+++ b/components/AdminDraftReview.tsx
@@ -1,8 +1,6 @@
 "use client";
-import { createClient } from "@supabase/supabase-js";
-const supabase = createClient("https://xyz.supabase.co", "eyJhbGciOi...SERVICE_ROLE_KEY...");
+import { approveDraftAction } from "@/app/actions/drafts";

 export function AdminDraftReview({ draftId }: { draftId: string }) {
   async function handleApprove() {
-    await supabase.from("notifications").insert(...);
+    await approveDraftAction(draftId);
   }
```
*Rationale*: The Supabase Service Role Key bypasses all RLS policies. Exposing it in a client component (`"use client"`) exposes full database write access to anyone inspecting browser network bundles. Remediated by moving the mutation into a secure Server Action with role validation.

---

## Failure Conditions
- **Hardcoded Credentials**: Any API key, token, or connection string committed in plaintext.
- **RLS Disabled**: Any database table created without explicit RLS policies.
- **Role Bypass**: Executing administrative actions without validating the JWT role claim.
- **Unchecked File Uploads**: Uploading attachments directly to public buckets without validating file extensions or MIME types.
- **Symptom Masking**: Catching exceptions and returning HTTP 200 without logging or resolving the root vulnerability.
