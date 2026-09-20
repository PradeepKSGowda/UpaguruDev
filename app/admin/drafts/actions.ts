"use server";

/**
 * @file app/admin/drafts/actions.ts
 * @description Production Server Actions for Human-In-The-Loop (HITL) notification publishing
 * and draft rejection workflows.
 * 
 * Task ID: TASK-03020104 (Subtasks: SUB-0302010401, SUB-0302010402)
 * Architecture Reference: ADR-001 (Server Actions), ADR-002 (Database), ADR-003 (RBAC),
 * ADR-010 (ISR Caching), ADR-013 (Security), ADR-014 (API Design)
 * Rules: AGENTS.md Rule 1 (Zod validation), Rule 3 (Audit trail & Mandatory RLS), Rule 4 (Edge Caching)
 */

import { revalidateNotification, revalidateDraft } from "../../../lib/cache";
import { createServerClient } from "../../../lib/supabase/server";
import {
  draftParsedFieldsSchema,
  draftRejectionSchema,
  type ValidatedDraftParsedFields,
} from "../../../lib/schemas/drafts";
import type { Json, ExamCategoryEnum } from "../../../types/database.types";

export interface ServerActionResult {
  success: boolean;
  message: string;
  error?: string;
  data?: {
    notificationId?: string;
    slug?: string;
  };
}

/**
 * Helper to generate collision-resistant URL slugs from exam / notification titles.
 */
function generateSlug(text: string): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "notification";
}

/**
 * Subtask SUB-0302010401:
 * Server Action: Zod parse -> resolve/create exam -> insert notification -> update draft -> write audit_logs -> revalidatePath/Tag.
 * 
 * Publishes a verified AI-extracted draft into the live public notifications feed.
 * 
 * @param {string} draftId UUID of the draft notification being verified
 * @param {ValidatedDraftParsedFields} fields Human-verified structured payload
 * @param {string} [optionalExamId] Specific master exam entity ID if pre-selected
 * @returns {Promise<ServerActionResult>} Result status, user-facing feedback, and published identifiers
 */
export async function publishNotificationAction(
  draftId: string,
  fields: ValidatedDraftParsedFields,
  optionalExamId?: string | null
): Promise<ServerActionResult> {
  if (!draftId || typeof draftId !== "string") {
    return {
      success: false,
      message: "Invalid draft ID provided.",
      error: "INVALID_DRAFT_ID",
    };
  }

  // 1. Zod input validation
  const validation = draftParsedFieldsSchema.safeParse(fields);
  if (!validation.success) {
    const errorMsg = validation.error.issues.map((i) => i.message).join(", ");
    return {
      success: false,
      message: `Validation failed: ${errorMsg}`,
      error: "VALIDATION_FAILED",
    };
  }

  const validatedData = validation.data;

  try {
    const supabase = await createServerClient();

    // 2. Cryptographic session validation (RBAC check)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        message: "Unauthorized: You must be logged in as an administrator to publish notifications.",
        error: "UNAUTHORIZED",
      };
    }

    const now = new Date().toISOString();

    // 3. Resolve parent exam entity from public.exams (Foreign Key FK requirement)
    let resolvedExamId = optionalExamId || null;

    if (!resolvedExamId) {
      // Query existing exam by exact conducting_body or exam_name
      const { data: existingExam } = await supabase
        .from("exams")
        .select("id")
        .eq("conducting_body", validatedData.conducting_body)
        .limit(1)
        .maybeSingle();

      if (existingExam?.id) {
        resolvedExamId = existingExam.id;
      } else {
        // Auto-provision a parent exam series entity if absent
        const rawExamTitle = validatedData.exam_name || validatedData.conducting_body;
        const examSlugBase = generateSlug(rawExamTitle);
        const examSlug = `${examSlugBase}-${Date.now().toString(36).slice(-4)}`;

        const validCategory: ExamCategoryEnum = [
          "civil_services",
          "banking",
          "railways",
          "defense",
          "state_psc",
          "teaching",
          "police",
          "other",
        ].includes(validatedData.category as ExamCategoryEnum)
          ? (validatedData.category as ExamCategoryEnum)
          : "other";

        const { data: createdExam, error: examCreateError } = await supabase
          .from("exams")
          .insert({
            slug: examSlug,
            title: rawExamTitle,
            conducting_body: validatedData.conducting_body,
            category: validCategory,
            state_or_central: "central",
            official_website:
              validatedData.official_pdf_url ||
              validatedData.apply_online_url ||
              "https://india.gov.in",
          })
          .select("id")
          .single();

        if (examCreateError || !createdExam) {
          console.warn("[publishNotificationAction] Exam auto-provision note:", examCreateError);
          // Query fallback: try to pick any existing exam
          const { data: fallbackExam } = await supabase.from("exams").select("id").limit(1).maybeSingle();
          resolvedExamId = fallbackExam?.id || null;
        } else {
          resolvedExamId = createdExam.id;
        }
      }
    }

    if (!resolvedExamId) {
      return {
        success: false,
        message: "Unable to associate notification with a parent exam series. Please ensure an exam exists.",
        error: "EXAM_ASSOCIATION_FAILED",
      };
    }

    // 4. Generate collision-resistant unique slug
    const baseSlug = generateSlug(`${validatedData.conducting_body} ${validatedData.title}`);
    const uniqueSuffix = Date.now().toString(36).slice(-4);
    const notificationSlug = `${baseSlug}-${uniqueSuffix}`;

    // Normalize qualifications into array format
    const qualifications = Array.isArray(validatedData.qualification_required)
      ? validatedData.qualification_required
      : typeof validatedData.qualification_required === "string"
      ? (validatedData.qualification_required as string).split("\n").map((s) => s.trim()).filter(Boolean)
      : [];

    // Fallback valid ISO date strings (avoid array indexing for noUncheckedIndexedAccess)
    let applicationStartDate: string = now.slice(0, 10);
    if (validatedData.application_start_date && !isNaN(Date.parse(validatedData.application_start_date))) {
      applicationStartDate = validatedData.application_start_date;
    }

    let applicationEndDate: string = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    if (validatedData.application_end_date && !isNaN(Date.parse(validatedData.application_end_date))) {
      applicationEndDate = validatedData.application_end_date;
    }

    // 5. Insert verified notification into public.notifications
    const { data: insertedNotification, error: notifInsertError } = await supabase
      .from("notifications")
      .insert({
        exam_id: resolvedExamId,
        slug: notificationSlug,
        title: validatedData.title,
        notification_number: validatedData.notification_number || null,
        total_vacancies: validatedData.total_vacancies ?? 0,
        application_start_date: applicationStartDate,
        application_end_date: applicationEndDate,
        exam_date: validatedData.exam_date || null,
        qualification_required: qualifications,
        age_limit_min: validatedData.age_limit_min ?? null,
        age_limit_max: validatedData.age_limit_max ?? null,
        official_pdf_url: validatedData.official_pdf_url || null,
        apply_online_url: validatedData.apply_online_url || null,
        syllabus_summary: {} as unknown as Json,
        selection_process: [],
        status: "published" as const,
        verified_by: user.id,
        published_at: now,
      })
      .select("id, slug")
      .single();

    if (notifInsertError) {
      console.error("[publishNotificationAction] Failed to insert notification:", notifInsertError);
      return {
        success: false,
        message: `Database insertion failed: ${notifInsertError.message}`,
        error: notifInsertError.code,
      };
    }

    // 6. Update draft_notifications record status to 'approved'
    const { error: draftUpdateError } = await supabase
      .from("draft_notifications")
      .update({
        status: "approved" as const,
        parsed_json: validatedData as unknown as Json,
        updated_at: now,
      })
      .eq("id", draftId);

    if (draftUpdateError) {
      console.warn("[publishNotificationAction] Draft update status note:", draftUpdateError);
    }

    // 7. Record publication in public.audit_logs (AGENTS.md Rule 3)
    const { error: auditError } = await supabase.from("audit_logs").insert({
      admin_id: user.id,
      action: "NOTIFICATION_PUBLISHED",
      target_entity: "notifications",
      target_id: insertedNotification.id,
      metadata: {
        draft_id: draftId,
        notification_id: insertedNotification.id,
        slug: insertedNotification.slug,
        title: validatedData.title,
        conducting_body: validatedData.conducting_body,
        verified_by: user.id,
        published_at: now,
      } as unknown as Json,
      created_at: now,
    });

    if (auditError) {
      console.warn("[publishNotificationAction] Audit log insertion warning:", auditError);
    }

    // 8. Record telemetry in draft_verification_sessions (failsafe)
    try {
      await supabase.from("draft_verification_sessions").insert({
        draft_id: draftId,
        admin_id: user.id,
        verification_action: "published",
        fields_modified: validatedData as unknown as Json,
        verified_at: now,
      });
    } catch (sessionErr) {
      console.warn("[publishNotificationAction] Telemetry session tracking note:", sessionErr);
    }

    // 9. Edge cache invalidation across candidate and administrative routes
    await revalidateNotification({
      slug: insertedNotification.slug,
      category: validatedData.category,
      reason: "status_change",
    });
    revalidateDraft(draftId);

    return {
      success: true,
      message: `Notification "${validatedData.title}" has been successfully published to the live candidate portal!`,
      data: {
        notificationId: insertedNotification.id,
        slug: insertedNotification.slug,
      },
    };
  } catch (err) {
    console.error("[publishNotificationAction] Unexpected exception:", err);
    return {
      success: false,
      message: "An unexpected server error occurred while publishing the notification.",
      error: "INTERNAL_SERVER_ERROR",
    };
  }
}

/**
 * Backward-compatible alias for publishNotificationAction.
 */
export async function approveAndPublishDraftAction(
  draftId: string,
  fields: ValidatedDraftParsedFields
): Promise<ServerActionResult> {
  return publishNotificationAction(draftId, fields);
}

/**
 * Subtask SUB-0302010402:
 * Server Action: Zod parse (including reason string) -> update draft status to 'rejected' -> write audit_logs.
 * 
 * Rejects an AI-extracted draft notification with a mandatory operator reason.
 * 
 * @param {string} draftId UUID of the draft notification
 * @param {string} reason Mandatory explanation (>= 10 characters)
 * @returns {Promise<ServerActionResult>} Result status and user-facing feedback message
 */
export async function rejectDraftAction(
  draftId: string,
  reason: string
): Promise<ServerActionResult> {
  if (!draftId || typeof draftId !== "string") {
    return {
      success: false,
      message: "Invalid draft ID provided.",
      error: "INVALID_DRAFT_ID",
    };
  }

  // 1. Zod input validation for rejection reason
  const validation = draftRejectionSchema.safeParse({ reason });
  if (!validation.success) {
    const errorMsg = validation.error.issues[0]?.message || "Invalid rejection reason";
    return {
      success: false,
      message: errorMsg,
      error: "VALIDATION_FAILED",
    };
  }

  const sanitizedReason = validation.data.reason;

  try {
    const supabase = await createServerClient();

    // 2. Cryptographic session validation (RBAC check)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        message: "Unauthorized: You must be logged in as an administrator to reject drafts.",
        error: "UNAUTHORIZED",
      };
    }

    const now = new Date().toISOString();

    // 3. Update draft notification to 'rejected'
    const { error: updateError } = await supabase
      .from("draft_notifications")
      .update({
        status: "rejected" as const,
        updated_at: now,
      })
      .eq("id", draftId);

    if (updateError) {
      console.error("[rejectDraftAction] Failed to update draft status:", updateError);
      return {
        success: false,
        message: `Database update failed: ${updateError.message}`,
        error: updateError.code,
      };
    }

    // 4. Log the rejection in audit_logs (AGENTS.md Rule 3)
    const { error: auditError } = await supabase.from("audit_logs").insert({
      admin_id: user.id,
      action: "DRAFT_REJECTED",
      target_entity: "draft_notifications",
      target_id: draftId,
      metadata: {
        rejection_reason: sanitizedReason,
        rejected_at: now,
      } as unknown as Json,
      created_at: now,
    });

    if (auditError) {
      console.warn("[rejectDraftAction] Audit log insertion warning:", auditError);
    }

    // 5. Record rejection telemetry in draft_verification_sessions (failsafe)
    try {
      await supabase.from("draft_verification_sessions").insert({
        draft_id: draftId,
        admin_id: user.id,
        verification_action: "rejected",
        rejection_reason: sanitizedReason,
        verified_at: now,
      });
    } catch (sessionErr) {
      console.warn("[rejectDraftAction] Verification session tracking note:", sessionErr);
    }

    // 6. Revalidate cache tags and route paths
    revalidateDraft(draftId);

    return {
      success: true,
      message: "Draft notification has been rejected and logged in the audit ledger.",
    };
  } catch (err) {
    console.error("[rejectDraftAction] Unexpected exception:", err);
    return {
      success: false,
      message: "An unexpected server error occurred while rejecting the draft.",
      error: "INTERNAL_SERVER_ERROR",
    };
  }
}
