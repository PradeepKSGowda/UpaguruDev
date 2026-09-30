"use server";

/**
 * @file app/admin/exams/lifecycle-actions.ts
 * @description Next.js 15 Server Actions for the Multi-Exam Complete Lifecycle Engine.
 * Supports cascading Organization -> Exam Master -> Exam Cycle -> Stage selectors,
 * dynamic field validation, non-destructive event versioning, document relationship linking,
 * and immutable forensic audit logging.
 * 
 * Rules: AGENTS.md Rule 1 (Server Actions, strict TS), Rule 3 (RLS, RBAC, Audit Trail)
 */

import { revalidatePath } from "next/cache";
import { createServerClient, createAdminClient, type ServerClient } from "@/lib/supabase/server";
import {
  validateDynamicLifecycleForm,
  FormValidationContext,
} from "@/lib/lifecycle/dynamic-form-engine";
import { getNotificationTypeMeta } from "@/lib/lifecycle/taxonomy";
import { Json } from "@/types/database.types";

export interface LifecycleActionResponse<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  data?: T;
}

export interface OrganizationOption {
  id: string;
  code: string;
  name: string;
  short_name: string;
}

export interface ExamMasterOption {
  id: string;
  exam_code: string;
  name: string;
  short_name: string | null;
  category: string | null;
  organization_id: string;
}

export interface ExamCycleOption {
  id: string;
  cycle_year: number | null;
  cycle_code: string;
  cycle_label: string;
  status: string;
  current_stage: string | null;
  start_date: string | null;
  end_date: string | null;
  total_vacancies_current: number | null;
  latest_update_summary: string | null;
  primary_reference_no: string | null;
}

/**
 * Helper to authenticate administrative session.
 */
async function requireAdminSession(): Promise<{ dbClient: ServerClient; user: { id: string; email?: string } }> {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized: Please log in as an administrator to perform lifecycle operations.");
  }

  const role = user.app_metadata?.role;
  if (role !== "admin" && role !== "super_admin") {
    throw new Error("Forbidden: Administrator privileges required.");
  }

  let dbClient: ServerClient = supabase;
  try {
    dbClient = createAdminClient();
  } catch {
    dbClient = supabase;
  }

  return { dbClient, user };
}

/**
 * 1. Fetch all active organizations.
 */
export async function getOrganizationsAction(): Promise<LifecycleActionResponse<OrganizationOption[]>> {
  try {
    const { dbClient } = await requireAdminSession();
    const { data, error } = await dbClient
      .from("organizations")
      .select("id, code, name, short_name")
      .eq("active", true)
      .order("code", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []) as OrganizationOption[] };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to load organizations" };
  }
}

/**
 * 2. Fetch Exam Masters strictly filtered by Organization ID.
 * Backend enforcement of Organization Isolation (Section 28).
 */
export async function getExamsByOrganizationAction(
  organizationId: string
): Promise<LifecycleActionResponse<ExamMasterOption[]>> {
  try {
    if (!organizationId) {
      return { success: true, data: [] };
    }
    const { dbClient } = await requireAdminSession();
    const { data, error } = await dbClient
      .from("exam_master")
      .select("id, exam_code, name, short_name, category, organization_id")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("name", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []) as ExamMasterOption[] };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to load exams" };
  }
}

/**
 * 3. Fetch Exam Cycles strictly filtered by Exam Master ID.
 */
export async function getCyclesByExamAction(
  examMasterId: string
): Promise<LifecycleActionResponse<ExamCycleOption[]>> {
  try {
    if (!examMasterId) {
      return { success: true, data: [] };
    }
    const { dbClient } = await requireAdminSession();
    const { data, error } = await dbClient
      .from("exam_cycle")
      .select(
        "id, cycle_year, cycle_code, cycle_label, status, current_stage, start_date, end_date, total_vacancies_current, latest_update_summary, primary_reference_no"
      )
      .eq("exam_master_id", examMasterId)
      .order("cycle_year", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []) as ExamCycleOption[] };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to load cycles" };
  }
}

/**
 * 4. Fetch Existing Events for an Exam Cycle (for event rescheduling / update).
 */
export async function getEventsByCycleAction(
  examCycleId: string
): Promise<LifecycleActionResponse<Array<{ id: string; event_type: string; stage: string | null; event_name: string; date_text_original: string; status: string }>>> {
  try {
    if (!examCycleId) return { success: true, data: [] };
    const { dbClient } = await requireAdminSession();
    const { data, error } = await dbClient
      .from("exam_event")
      .select("id, event_type, stage, event_name, date_text_original, status")
      .eq("exam_cycle_id", examCycleId)
      .eq("is_current", true)
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to load events" };
  }
}

export interface PublishLifecycleUpdatePayload {
  notificationTypeCode: string;
  organizationId: string;
  examMasterId: string;
  examCycleId: string;
  stageCode?: string | null;
  targetEventId?: string | null; // If modifying an existing event
  values: Record<string, unknown>;
  remarks?: string;
}

/**
 * 5. Primary Complete Exam Lifecycle Publisher Action.
 * Handles Step 11: verification, event creation, versioning, document relationship graph,
 * cycle status updating, and forensic audit logging.
 */
export async function publishLifecycleUpdateAction(
  payload: PublishLifecycleUpdatePayload
): Promise<LifecycleActionResponse<{ eventId: string; cycleId: string; documentId: string }>> {
  try {
    const { dbClient, user } = await requireAdminSession();
    const now = new Date().toISOString();

    // 1. Fetch current Exam Cycle to validate existence and organization isolation
    const { data: cycleData, error: cycleErr } = await dbClient
      .from("exam_cycle")
      .select(`
        id,
        exam_master_id,
        cycle_year,
        cycle_code,
        cycle_label,
        status,
        end_date,
        start_date,
        total_vacancies_current,
        exam_master:exam_master_id (
          id,
          organization_id,
          name,
          exam_code
        )
      `)
      .eq("id", payload.examCycleId)
      .single();

    if (cycleErr || !cycleData) {
      return { success: false, error: "The targeted Examination Cycle was not found in the database." };
    }

    // Backend validation of Organization Isolation (Section 28)
    const examMaster = Array.isArray(cycleData.exam_master)
      ? cycleData.exam_master[0]
      : cycleData.exam_master;

    if (!examMaster || examMaster.organization_id !== payload.organizationId) {
      return {
        success: false,
        error: "Organization Isolation Violation: Selected Examination does not belong to the selected Organization.",
      };
    }

    // 2. Validate using Dynamic Form Engine
    const validationCtx: FormValidationContext = {
      notificationTypeCode: payload.notificationTypeCode,
      organizationCode: payload.organizationId,
      examMasterId: payload.examMasterId,
      examCycleId: payload.examCycleId,
      stageCode: payload.stageCode,
      values: payload.values,
      originalCycleData: {
        application_end_date: cycleData.end_date,
        exam_date: cycleData.start_date,
        total_vacancies: cycleData.total_vacancies_current,
      },
    };

    const validation = validateDynamicLifecycleForm(validationCtx);
    if (!validation.isValid) {
      return {
        success: false,
        error: "Validation failed. Please review the highlighted fields.",
        fieldErrors: validation.errors,
      };
    }

    const meta = getNotificationTypeMeta(payload.notificationTypeCode);
    const v = payload.values;
    const officialPdfUrl = (v.official_pdf_url as string) || (v.result_pdf_url as string) || "";
    const docTitle =
      (v.title as string) ||
      `${examMaster.name} (${cycleData.cycle_year || cycleData.cycle_code}) - ${meta.label}`;

    // 3. Insert or reference official document in exam_document
    const { data: insertedDoc, error: docErr } = await dbClient
      .from("exam_document")
      .insert({
        organization_id: payload.organizationId,
        exam_master_id: payload.examMasterId,
        exam_cycle_id: payload.examCycleId,
        document_type: payload.notificationTypeCode,
        title: docTitle,
        normalized_title: docTitle.toLowerCase().trim(),
        source_url: officialPdfUrl || "https://official.gov.in",
        canonical_url: officialPdfUrl || "https://official.gov.in",
        status: "PUBLISHED",
        verification_status: "HUMAN_VERIFIED",
        reference_number: (v.reference_number as string) || (v.corrigendum_number as string) || null,
        publication_date: (v.release_date as string) || (v.result_date as string) || now.slice(0, 10),
        raw_metadata_json: v as unknown as Json,
      })
      .select("id")
      .single();

    if (docErr || !insertedDoc) {
      console.error("[publishLifecycleUpdateAction] Document insert failed:", docErr);
      return { success: false, error: `Failed to record official document: ${docErr?.message}` };
    }

    const documentId = insertedDoc.id;

    // 4. Link Document to Exam Cycle via document_exam_cycle (many-to-many link)
    await dbClient.from("document_exam_cycle").insert({
      document_id: documentId,
      exam_master_id: payload.examMasterId,
      exam_cycle_id: payload.examCycleId,
      relationship_role: (meta.relationshipType as any) || "CORRIGENDUM",
      confidence: 100.0,
      decision: "MANUAL_LINK",
      verified: true,
      verified_by: user.id,
      verified_at: now,
    });

    // 5. Handle Event Creation / Supersession
    let supersededEventId: string | null = null;
    let newVersionNumber = 1;

    // If an existing event is targeted for revision, mark previous as superseded
    if (payload.targetEventId) {
      supersededEventId = payload.targetEventId;
      const { data: prevEvent } = await dbClient
        .from("exam_event")
        .select("version_number")
        .eq("id", payload.targetEventId)
        .single();

      if (prevEvent) {
        newVersionNumber = (prevEvent.version_number || 1) + 1;
      }

      await dbClient
        .from("exam_event")
        .update({
          is_current: false,
          status: "SUPERSEDED",
          updated_at: now,
        })
        .eq("id", payload.targetEventId);
    }

    // Determine event date text & datetime
    const eventDateText =
      (v.new_closing_date as string) ||
      (v.exam_date as string) ||
      (v.release_date as string) ||
      (v.result_date as string) ||
      (v.new_exam_date as string) ||
      "Announced";

    const { data: insertedEvent, error: eventErr } = await dbClient
      .from("exam_event")
      .insert({
        exam_cycle_id: payload.examCycleId,
        source_document_id: documentId,
        event_type: payload.notificationTypeCode,
        stage: payload.stageCode || null,
        event_name: meta.defaultEventName || meta.label,
        date_text_original: eventDateText,
        start_datetime: (v.new_closing_date as string) || (v.new_exam_date as string) || (v.release_date as string) || null,
        status: payload.notificationTypeCode === "EXAM_DATE_POSTPONED" ? "POSTPONED" : "COMPLETED",
        is_current: true,
        version_number: newVersionNumber,
        supersedes_event_id: supersededEventId,
        change_reason: (v.extension_reason as string) || (v.postponement_reason as string) || (v.change_summary as string) || null,
        verification_status: "HUMAN_VERIFIED",
        confidence: 100.0,
      })
      .select("id")
      .single();

    if (eventErr || !insertedEvent) {
      console.error("[publishLifecycleUpdateAction] Event insert failed:", eventErr);
      return { success: false, error: `Failed to insert lifecycle event: ${eventErr?.message}` };
    }

    // 6. Update Canonical Exam Cycle Status & Fields based on Notification Type
    const cycleUpdates: Record<string, unknown> = {
      latest_document_id: documentId,
      latest_update_at: now,
      latest_update_summary: `${meta.label}: ${eventDateText}`,
      updated_at: now,
    };

    if (payload.stageCode) {
      cycleUpdates.current_stage = payload.stageCode;
    }

    // Type-specific field updates
    if (payload.notificationTypeCode === "APPLICATION_EXTENSION" && v.new_closing_date) {
      cycleUpdates.end_date = v.new_closing_date;
      cycleUpdates.status = "APPLICATION_OPEN";

      // Record field version
      await dbClient.from("cycle_field_version").insert({
        exam_cycle_id: payload.examCycleId,
        field_name: "end_date",
        old_value_json: JSON.stringify(cycleData.end_date),
        new_value_json: JSON.stringify(v.new_closing_date),
        change_summary: `Application deadline extended to ${v.new_closing_date}`,
        source_document_id: documentId,
        effective_date: v.new_closing_date as string,
        is_current: true,
        verification_status: "VERIFIED",
      });
    } else if (payload.notificationTypeCode === "EXAM_DATE_POSTPONED") {
      cycleUpdates.status = "EXAM_SCHEDULED";
      if (v.new_date_available === true && v.new_exam_date) {
        cycleUpdates.start_date = v.new_exam_date;
      }
    } else if (payload.notificationTypeCode === "ADMIT_CARD_RELEASED") {
      cycleUpdates.status = "EXAM_SCHEDULED";
    } else if (payload.notificationTypeCode === "RESULT_RELEASED") {
      cycleUpdates.status = "RESULT_DECLARED";
    } else if (payload.notificationTypeCode === "FINAL_RESULT") {
      cycleUpdates.status = "FINAL_RESULT_DECLARED";
    } else if (payload.notificationTypeCode === "VACANCY_REVISED" && v.new_vacancies) {
      cycleUpdates.total_vacancies_current = Number(v.new_vacancies);
      await dbClient.from("cycle_field_version").insert({
        exam_cycle_id: payload.examCycleId,
        field_name: "total_vacancies_current",
        old_value_json: JSON.stringify(cycleData.total_vacancies_current),
        new_value_json: JSON.stringify(v.new_vacancies),
        change_summary: `Vacancies updated to ${v.new_vacancies} (${v.revision_type || "revised"})`,
        source_document_id: documentId,
        is_current: true,
        verification_status: "VERIFIED",
      });
    }

    await dbClient.from("exam_cycle").update(cycleUpdates as any).eq("id", payload.examCycleId);

    // 7. Forensic Audit Logging (AGENTS.md Rule 3)
    await dbClient.from("audit_logs").insert({
      admin_id: user.id,
      action: "LIFECYCLE_UPDATE_PUBLISHED",
      target_entity: "exam_cycle",
      target_id: payload.examCycleId,
      metadata: {
        notification_type: payload.notificationTypeCode,
        event_id: insertedEvent.id,
        document_id: documentId,
        new_values: v,
        published_by_email: user.email,
        published_at: now,
      } as unknown as Json,
      created_at: now,
    });

    // 8. Multi-path cache invalidation
    revalidatePath("/admin/review-queue");
    revalidatePath("/admin/notifications");
    revalidatePath("/admin/exams");
    revalidatePath(`/notification/${payload.examCycleId}`);

    return {
      success: true,
      message: `${meta.label} has been published successfully and attached to ${examMaster.name} (${cycleData.cycle_year || cycleData.cycle_code}).`,
      data: {
        eventId: insertedEvent.id,
        cycleId: payload.examCycleId,
        documentId,
      },
    };
  } catch (err: unknown) {
    console.error("[publishLifecycleUpdateAction] Unhandled exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected server error occurred.",
    };
  }
}
