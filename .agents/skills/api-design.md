# Skill: API Design & Validation (`api-design.md`)

## Input
- **Endpoint Route Path**: e.g., `/api/v1/notifications`, `/api/v1/search`, or Server Action name (e.g., `publishNotificationAction`).
- **HTTP Method / Execution Mode**: `GET`, `POST`, `PUT`, `DELETE` or Next.js Server Action (`"use server"`).
- **Target Role / Authorization**: `Guest`, `Candidate`, `Moderator`, `Admin`, `Super Admin`.
- **Request Parameters**: Query parameters, URL route parameters, and JSON request body fields.
- **Data Entity Contract**: Associated database schema (`notifications`, `exams`, `user_subscriptions`, `draft_notifications`).

---

## Output
- **TypeScript Route Handler or Server Action**: Fully typed function with Zod validation, error handling, and transactional database interaction.
- **Zod Validation Schema**: Exported schema for runtime input validation and TypeScript type inference (`z.infer<typeof Schema>`).
- **RFC 7807 Error Responses**: Standardized JSON problem details for all client errors (400, 401, 403, 404, 429).
- **Audit Log Insertion**: Synchronous `public.audit_logs` record for all administrative mutations.
- **OpenAPI 3.0 Documentation Snippet**: Path, parameters, request body, and response status definitions.

---

## Checklist
- [ ] All request payloads and query parameters validate strictly through a Zod schema (`AGENTS.md` Rule 1).
- [ ] No hardcoded secrets; API keys, connection strings, and service roles read from `process.env` (`AGENTS.md` Rule 1).
- [ ] Role-based authorization verified using `auth.jwt() ->> 'role'` or session claims (`AGENTS.md` Rule 3).
- [ ] Administrative mutations (publish, update, archive, delete) write an entry to `public.audit_logs` (`AGENTS.md` Rule 3).
- [ ] Public endpoints incorporate Upstash Redis sliding window rate limiting (max 60 req/min).
- [ ] ISR cache purge (`revalidatePath`, `revalidateTag`) triggered upon mutation of published resources (`AGENTS.md` Rule 4).
- [ ] Errors never caught and silenced in empty `try/catch` blocks (`AGENTS.md` Rule 2).
- [ ] Return types are explicitly typed with TypeScript interfaces or Zod inference.

---

## Prompt Template
```markdown
You are the Backend Engineer Agent for UPA-GURU.
Design and implement the API handler for: [ENDPOINT_OR_ACTION_NAME]

Target: [HTTP_METHOD_OR_SERVER_ACTION]
Role Authorization: [GUEST | CANDIDATE | MODERATOR | ADMIN]
Entity: [TARGET_ENTITY]
Parameters: [LIST_OF_INPUT_PARAMETERS]

Requirements:
1. Define a strict Zod schema validating every parameter with descriptive error messages.
2. Verify role authorization via Supabase Auth session/JWT claims.
3. Execute database operations adhering to Row Level Security (RLS).
4. If an Admin mutation: insert an audit record into public.audit_logs.
5. Invalidate relevant caches using revalidatePath / revalidateTag.
6. Return RFC 7807 formatted error responses on failure.
7. Provide complete TypeScript code with docstrings detailing intent, inputs, and outputs.
```

---

## Examples

### Example 1: Server Action for Admin HITL Approval
```typescript
/**
 * Server Action: Approve and publish draft notification to live portal
 * Intent: Validates parsed draft data, inserts into notifications table, updates draft status, and writes audit log.
 * Inputs: draftId (UUID string), parsedData (NotificationInputSchema)
 * Outputs: { success: boolean; notificationId?: string; error?: string }
 */
"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";

const PublishNotificationSchema = z.object({
  draftId: z.string().uuid("Invalid draft ID format"),
  title: z.string().min(5, "Title must be at least 5 characters").max(255),
  examId: z.string().uuid("Invalid exam ID format"),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
  notificationNumber: z.string().optional(),
  totalVacancies: z.number().int().nonnegative().default(0),
  applicationStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  applicationEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  qualificationRequired: z.array(z.string()).min(1, "At least one qualification required"),
  ageLimitMin: z.number().int().min(18).max(65).optional().nullable(),
  ageLimitMax: z.number().int().min(18).max(65).optional().nullable(),
  officialPdfUrl: z.string().url("Must be valid PDF URL"),
  applyOnlineUrl: z.string().url("Must be valid application URL").optional().nullable(),
  syllabusSummary: z.record(z.unknown()).default({}),
  selectionProcess: z.array(z.string()).default([])
});

export type PublishNotificationInput = z.infer<typeof PublishNotificationSchema>;

export async function publishNotificationAction(input: PublishNotificationInput) {
  // 1. Zod Validation
  const validated = PublishNotificationSchema.parse(input);
  const supabase = await createServerClient();

  // 2. Auth & RBAC Verification
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized: Authentication required");
  }

  const { data: { session } } = await supabase.auth.getSession();
  const role = session?.user?.app_metadata?.role;
  if (role !== "admin" && role !== "super_admin") {
    throw new Error("Forbidden: Admin privileges required");
  }

  // 3. Insert Published Notification
  const { data: notification, error: insertError } = await supabase
    .from("notifications")
    .insert({
      exam_id: validated.examId,
      slug: validated.slug,
      title: validated.title,
      notification_number: validated.notificationNumber,
      total_vacancies: validated.totalVacancies,
      application_start_date: validated.applicationStartDate,
      application_end_date: validated.applicationEndDate,
      exam_date: validated.examDate,
      qualification_required: validated.qualificationRequired,
      age_limit_min: validated.ageLimitMin,
      age_limit_max: validated.ageLimitMax,
      official_pdf_url: validated.officialPdfUrl,
      apply_online_url: validated.applyOnlineUrl,
      syllabus_summary: validated.syllabusSummary,
      selection_process: validated.selectionProcess,
      status: "published",
      verified_by: user.id,
      published_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Database Insert Failed: ${insertError.message}`);
  }

  // 4. Update Draft Status
  await supabase
    .from("draft_notifications")
    .update({ status: "approved", reviewed_by: user.id })
    .eq("id", validated.draftId);

  // 5. Mandatory Audit Logging
  await supabase.from("audit_logs").insert({
    admin_id: user.id,
    action: "PUBLISH_NOTIFICATION",
    target_entity: "notifications",
    target_id: notification.id,
    metadata: {
      draft_id: validated.draftId,
      slug: validated.slug,
      vacancies: validated.totalVacancies
    }
  });

  // 6. Cache Invalidation
  revalidatePath("/");
  revalidatePath(`/notification/${validated.slug}`);
  revalidateTag("notifications");

  return { success: true, notificationId: notification.id };
}
```

---

## Failure Conditions
- **Validation Bypass**: Calling database operations directly without `schema.parse(input)`.
- **Missing Audit Record**: Executing an Admin or Moderator mutation without inserting into `public.audit_logs`.
- **Privilege Escalation**: Omitting role check and relying purely on authentication presence.
- **Silent Error Swallowing**: Wrapping database calls in empty `catch {}` blocks instead of propagating typed errors.
- **Unbounded Queries**: Endpoints returning unpaginated database records exceeding 100 items.
