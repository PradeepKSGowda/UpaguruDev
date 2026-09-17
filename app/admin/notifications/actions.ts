"use server";

/**
 * @file app/admin/notifications/actions.ts
 * @description Next.js 15 Server Actions for administrative Notification CRUD operations.
 * Enforces RBAC authentication, Zod validation, parent exam referential integrity,
 * audit logging in public.audit_logs, and multi-path cache invalidation.
 * 
 * Task ID: TASK-03030102 (Subtask: SUB-0303010201)
 * Architecture Reference: ADR-001 (Server Actions), ADR-002 (Database), ADR-003 (RBAC)
 */

import { revalidatePath, revalidateTag } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { adminNotificationInputSchema } from "@/lib/schemas/admin-notifications";
import { Json } from "@/types/database.types";

export interface ActionResponse<T = unknown> {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: T;
}

/**
 * Helper to authenticate administrative session.
 */
async function requireAdminSession() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized: Please log in to perform this action");
  }

  const role = user.app_metadata?.role;
  if (role !== "admin" && role !== "super_admin") {
    throw new Error("Forbidden: Administrator privileges required");
  }

  return { supabase, user };
}

/**
 * Create a new notification record manually outside the automated scraper pipeline.
 */
export async function createNotificationAction(
  rawInput: unknown
): Promise<ActionResponse<{ id: string; slug: string }>> {
  try {
    const { supabase, user } = await requireAdminSession();

    // 1. Zod runtime validation
    const parsed = adminNotificationInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed. Please verify the entered fields.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const validatedData = parsed.data;

    // 2. Verify parent exam exists
    const { data: parentExam, error: examError } = await supabase
      .from("exams")
      .select("id, title")
      .eq("id", validatedData.exam_id)
      .single();

    if (examError || !parentExam) {
      return {
        success: false,
        error: "The selected parent examination series does not exist.",
        fieldErrors: { exam_id: ["Invalid examination series selected"] },
      };
    }

    // 3. Verify slug uniqueness
    const { data: existingSlug } = await supabase
      .from("notifications")
      .select("id")
      .eq("slug", validatedData.slug)
      .maybeSingle();

    if (existingSlug) {
      return {
        success: false,
        error: `A notification with the slug '${validatedData.slug}' already exists. Please customize the slug.`,
        fieldErrors: { slug: ["Slug already in use"] },
      };
    }

    const now = new Date().toISOString();
    const isPublished = validatedData.status === "published";

    // 4. Insert notification
    const { data: insertedNotification, error: insertError } = await supabase
      .from("notifications")
      .insert({
        exam_id: validatedData.exam_id,
        slug: validatedData.slug,
        title: validatedData.title,
        notification_number: validatedData.notification_number || null,
        total_vacancies: validatedData.total_vacancies,
        application_start_date: validatedData.application_start_date,
        application_end_date: validatedData.application_end_date,
        exam_date: validatedData.exam_date || null,
        qualification_required: Array.isArray(validatedData.qualification_required)
          ? validatedData.qualification_required
          : [],
        age_limit_min: validatedData.age_limit_min ?? null,
        age_limit_max: validatedData.age_limit_max ?? null,
        official_pdf_url: validatedData.official_pdf_url || null,
        apply_online_url: validatedData.apply_online_url || null,
        syllabus_summary: {} as unknown as Json,
        selection_process: [],
        status: validatedData.status,
        verified_by: isPublished ? user.id : null,
        published_at: isPublished ? now : null,
      })
      .select("id, slug")
      .single();

    if (insertError || !insertedNotification) {
      console.error("[createNotificationAction] Database insert error:", insertError);
      return {
        success: false,
        error: "Database error: Failed to create notification record. " + (insertError?.message || ""),
      };
    }

    // 5. Record forensic audit log
    const { error: auditError } = await supabase.from("audit_logs").insert({
      admin_id: user.id,
      action: "create_notification",
      target_entity: "notification",
      target_id: insertedNotification.id,
      metadata: {
        title: validatedData.title,
        slug: validatedData.slug,
        exam_id: validatedData.exam_id,
        status: validatedData.status,
        vacancies: validatedData.total_vacancies,
        application_end_date: validatedData.application_end_date,
      } as unknown as Json,
    });

    if (auditError) {
      console.warn("[createNotificationAction] Audit logging failed:", auditError);
    }

    // 6. Invalidate edge caches
    revalidatePath("/admin/notifications");
    revalidatePath("/notifications");
    revalidatePath(`/notification/${insertedNotification.slug}`);
    revalidatePath("/admin");
    revalidatePath("/");
    try {
      revalidateTag("notifications");
    } catch {
      // ignore in test or unsupported context
    }

    return {
      success: true,
      data: {
        id: insertedNotification.id,
        slug: insertedNotification.slug,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected internal server error";
    console.error("[createNotificationAction] Exception:", err);
    return { success: false, error: message };
  }
}

/**
 * Update an existing notification record.
 */
export async function updateNotificationAction(
  id: string,
  rawInput: unknown
): Promise<ActionResponse<{ id: string; slug: string }>> {
  try {
    const { supabase, user } = await requireAdminSession();

    if (!id || typeof id !== "string") {
      return { success: false, error: "Invalid notification identifier provided" };
    }

    // 1. Zod runtime validation
    const parsed = adminNotificationInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed. Please verify the entered fields.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const validatedData = parsed.data;

    // 2. Fetch current record for audit diff and state transition tracking
    const { data: currentNotif, error: fetchError } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !currentNotif) {
      return { success: false, error: "Target notification not found" };
    }

    // 3. Verify slug uniqueness excluding self
    const { data: conflictingSlug } = await supabase
      .from("notifications")
      .select("id")
      .eq("slug", validatedData.slug)
      .neq("id", id)
      .maybeSingle();

    if (conflictingSlug) {
      return {
        success: false,
        error: `The slug '${validatedData.slug}' is already taken by another notification.`,
        fieldErrors: { slug: ["Slug already in use by another notification"] },
      };
    }

    const now = new Date().toISOString();
    const isTransitioningToPublished =
      currentNotif.status !== "published" && validatedData.status === "published";

    // 4. Update notification
    const { data: updatedNotification, error: updateError } = await supabase
      .from("notifications")
      .update({
        exam_id: validatedData.exam_id,
        slug: validatedData.slug,
        title: validatedData.title,
        notification_number: validatedData.notification_number || null,
        total_vacancies: validatedData.total_vacancies,
        application_start_date: validatedData.application_start_date,
        application_end_date: validatedData.application_end_date,
        exam_date: validatedData.exam_date || null,
        qualification_required: Array.isArray(validatedData.qualification_required)
          ? validatedData.qualification_required
          : [],
        age_limit_min: validatedData.age_limit_min ?? null,
        age_limit_max: validatedData.age_limit_max ?? null,
        official_pdf_url: validatedData.official_pdf_url || null,
        apply_online_url: validatedData.apply_online_url || null,
        status: validatedData.status,
        verified_by: isTransitioningToPublished ? user.id : currentNotif.verified_by,
        published_at: isTransitioningToPublished ? now : currentNotif.published_at,
        updated_at: now,
      })
      .eq("id", id)
      .select("id, slug")
      .single();

    if (updateError || !updatedNotification) {
      console.error("[updateNotificationAction] Database update error:", updateError);
      return {
        success: false,
        error: "Database error: Failed to update notification. " + (updateError?.message || ""),
      };
    }

    // 5. Record audit diff
    const { error: auditError } = await supabase.from("audit_logs").insert({
      admin_id: user.id,
      action: "update_notification",
      target_entity: "notification",
      target_id: id,
      metadata: {
        before: {
          title: currentNotif.title,
          slug: currentNotif.slug,
          status: currentNotif.status,
          total_vacancies: currentNotif.total_vacancies,
          application_end_date: currentNotif.application_end_date,
        },
        after: {
          title: validatedData.title,
          slug: validatedData.slug,
          status: validatedData.status,
          total_vacancies: validatedData.total_vacancies,
          application_end_date: validatedData.application_end_date,
        },
      } as unknown as Json,
    });

    if (auditError) {
      console.warn("[updateNotificationAction] Audit logging failed:", auditError);
    }

    // 6. Invalidate caches
    revalidatePath("/admin/notifications");
    revalidatePath(`/admin/notifications/${id}/edit`);
    revalidatePath("/notifications");
    revalidatePath(`/notification/${validatedData.slug}`);
    if (currentNotif.slug !== validatedData.slug) {
      revalidatePath(`/notification/${currentNotif.slug}`);
    }
    revalidatePath("/admin");
    revalidatePath("/");
    try {
      revalidateTag("notifications");
    } catch {
      // ignore
    }

    return {
      success: true,
      data: {
        id: updatedNotification.id,
        slug: updatedNotification.slug,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected internal server error";
    console.error("[updateNotificationAction] Exception:", err);
    return { success: false, error: message };
  }
}

/**
 * Delete an existing notification record.
 */
export async function deleteNotificationAction(id: string): Promise<ActionResponse> {
  try {
    const { supabase, user } = await requireAdminSession();

    if (!id || typeof id !== "string") {
      return { success: false, error: "Invalid notification identifier provided" };
    }

    // 1. Fetch record for audit trail
    const { data: notifToDelete } = await supabase
      .from("notifications")
      .select("title, slug, status")
      .eq("id", id)
      .single();

    // 2. Delete notification
    const { error: deleteError } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("[deleteNotificationAction] Database delete error:", deleteError);
      return {
        success: false,
        error: "Failed to delete notification: " + deleteError.message,
      };
    }

    // 3. Record audit log
    const { error: auditError } = await supabase.from("audit_logs").insert({
      admin_id: user.id,
      action: "delete_notification",
      target_entity: "notification",
      target_id: id,
      metadata: {
        deletedNotification: notifToDelete || { id },
        deletedAt: new Date().toISOString(),
      } as unknown as Json,
    });

    if (auditError) {
      console.warn("[deleteNotificationAction] Audit logging failed:", auditError);
    }

    // 4. Invalidate caches
    revalidatePath("/admin/notifications");
    revalidatePath("/notifications");
    revalidatePath("/admin");
    revalidatePath("/");
    try {
      revalidateTag("notifications");
    } catch {
      // ignore
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected internal server error";
    console.error("[deleteNotificationAction] Exception:", err);
    return { success: false, error: message };
  }
}
