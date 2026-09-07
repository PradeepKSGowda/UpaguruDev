# UPA-GURU Development Rules & Behavioral Constraints

## 1. Code Generation Rules
* **Task-Scoped Generation**: Generate code strictly for the single assigned task ID. Do NOT refactor or touch unrelated files.
* **Architecture Compliance**: Adhere strictly to Next.js 15 App Router conventions, React Server Components (RSC), TypeScript strict mode, and Zod input validation.
* **No Hardcoded Secrets**: Secrets, API keys, database connection strings, and service roles must never be hardcoded into source code. Always use `process.env` / `.env.local`.
* **Documentation & Comments**: Every non-trivial file modification must include docstrings detailing intent, inputs, and outputs.

## 2. Testing & Execution Safety Guardrails
* **No Unsanctioned Execution**: Do NOT automatically execute builds, automated end-to-end tests, or deployment pipelines without explicit user approval.
* **Test Code Generation**: Create standalone Playwright / Vitest test files and output detailed step-by-step verification commands for the user.
* **No Symptom Masking**: Never solve errors by wrapping logic in empty `try/catch` blocks, suppressing linter rules, or commenting out failing assertions.

## 3. Database & Security Guardrails
* **Mandatory Row Level Security (RLS)**: Every PostgreSQL table created in Supabase MUST have RLS enabled with explicit `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies.
* **Role-Based Access Control (RBAC)**: Ensure strict segregation between public candidate access and Admin HITL verification access.
* **Audit Trail**: Every verification and publish action by an Admin must be logged in the `audit_logs` table.

## 4. SEO & Performance Rules
* **Lighthouse Target**: Mobile SEO & Performance score must meet or exceed 95.
* **Structured Data**: All public notification pages (`/notification/[slug]`) must include valid Google-compliant `JobPosting` and `Event` JSON-LD schema tags.
* **Edge Caching**: Static/ISR routes must define explicit cache headers and Redis revalidation logic.

## 5. Knowledge & Progress Management
* **Task Logging**: Update task completion status in `.agents/task-backlog.json` upon completion.
* **Knowledge Updates**: Update `.agents/knowledge/` documentation whenever architectural decisions or API contracts evolve.
