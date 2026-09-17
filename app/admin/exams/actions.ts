"use server";

/**
 * @file app/admin/exams/actions.ts
 * @description Next.js 15 Server Actions for administrative Exam CRUD operations.
 * Enforces RBAC verification, Zod input validation, foreign-key referential safeguards,
 * immutable audit trail logging, and multi-path cache invalidation.
 * 
 * Task ID: TASK-03030101 (Subtask: SUB-0303010102)
 * Architecture Reference: ADR-001 (Server Actions), ADR-002 (Database), ADR-003 (Auth/RBAC)
 */

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { examInputSchema } from "@/lib/schemas/exams";
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
 * Create a new master examination series.
 */
export async function createExamAction(
  rawInput: unknown
): Promise<ActionResponse<{ id: string; slug: string }>> {
  try {
    const { supabase, user } = await requireAdminSession();

    // 1. Zod runtime input validation
    const parsed = examInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed. Please verify the entered fields.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const validatedData = parsed.data;

    // 2. Check slug uniqueness
    const { data: existingExam } = await supabase
      .from("exams")
      .select("id")
      .eq("slug", validatedData.slug)
      .maybeSingle();

    if (existingExam) {
      return {
        success: false,
        error: `An exam with the slug '${validatedData.slug}' already exists. Please choose a unique slug.`,
        fieldErrors: { slug: ["Slug already in use"] },
      };
    }

    // 3. Insert new exam
    const { data: insertedExam, error: insertError } = await supabase
      .from("exams")
      .insert({
        title: validatedData.title,
        slug: validatedData.slug,
        conducting_body: validatedData.conducting_body,
        category: validatedData.category,
        state_or_central: validatedData.state_or_central,
        official_website: validatedData.official_website,
        logo_url: validatedData.logo_url || null,
      })
      .select("id, slug")
      .single();

    if (insertError || !insertedExam) {
      console.error("[createExamAction] Database insert error:", insertError);
      return {
        success: false,
        error: "Database error: Failed to create exam record. " + (insertError?.message || ""),
      };
    }

    // 4. Record audit log
    const { error: auditError } = await supabase.from("audit_logs").insert({
      admin_id: user.id,
      action: "create_exam",
      target_entity: "exam",
      target_id: insertedExam.id,
      metadata: {
        title: validatedData.title,
        slug: validatedData.slug,
        conducting_body: validatedData.conducting_body,
        category: validatedData.category,
        state_or_central: validatedData.state_or_central,
        official_website: validatedData.official_website,
      } as unknown as Json,
    });

    if (auditError) {
      console.warn("[createExamAction] Audit logging failed:", auditError);
    }

    // 5. Invalidate edge caches
    revalidatePath("/admin/exams");
    revalidatePath("/exams");
    revalidatePath("/");

    return {
      success: true,
      data: {
        id: insertedExam.id,
        slug: insertedExam.slug,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected internal server error";
    console.error("[createExamAction] Exception:", err);
    return { success: false, error: message };
  }
}

/**
 * Update an existing examination series.
 */
export async function updateExamAction(
  id: string,
  rawInput: unknown
): Promise<ActionResponse<{ id: string; slug: string }>> {
  try {
    const { supabase, user } = await requireAdminSession();

    if (!id || typeof id !== "string") {
      return { success: false, error: "Invalid exam identifier provided" };
    }

    // 1. Zod runtime input validation
    const parsed = examInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed. Please verify the entered fields.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const validatedData = parsed.data;

    // 2. Verify exam exists and fetch current values for audit diff
    const { data: currentExam, error: fetchError } = await supabase
      .from("exams")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !currentExam) {
      return { success: false, error: "Target exam not found" };
    }

    // 3. Verify slug uniqueness excluding this record
    const { data: conflictingExam } = await supabase
      .from("exams")
      .select("id")
      .eq("slug", validatedData.slug)
      .neq("id", id)
      .maybeSingle();

    if (conflictingExam) {
      return {
        success: false,
        error: `The slug '${validatedData.slug}' is already taken by another exam.`,
        fieldErrors: { slug: ["Slug already in use by another exam"] },
      };
    }

    // 4. Update exam
    const { data: updatedExam, error: updateError } = await supabase
      .from("exams")
      .update({
        title: validatedData.title,
        slug: validatedData.slug,
        conducting_body: validatedData.conducting_body,
        category: validatedData.category,
        state_or_central: validatedData.state_or_central,
        official_website: validatedData.official_website,
        logo_url: validatedData.logo_url || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, slug")
      .single();

    if (updateError || !updatedExam) {
      console.error("[updateExamAction] Database update error:", updateError);
      return {
        success: false,
        error: "Database error: Failed to update exam record. " + (updateError?.message || ""),
      };
    }

    // 5. Record audit log
    const { error: auditError } = await supabase.from("audit_logs").insert({
      admin_id: user.id,
      action: "update_exam",
      target_entity: "exam",
      target_id: id,
      metadata: {
        before: {
          title: currentExam.title,
          slug: currentExam.slug,
          conducting_body: currentExam.conducting_body,
          category: currentExam.category,
          state_or_central: currentExam.state_or_central,
          official_website: currentExam.official_website,
        },
        after: {
          title: validatedData.title,
          slug: validatedData.slug,
          conducting_body: validatedData.conducting_body,
          category: validatedData.category,
          state_or_central: validatedData.state_or_central,
          official_website: validatedData.official_website,
        },
      } as unknown as Json,
    });

    if (auditError) {
      console.warn("[updateExamAction] Audit logging failed:", auditError);
    }

    // 6. Invalidate caches
    revalidatePath("/admin/exams");
    revalidatePath(`/admin/exams/${id}/edit`);
    revalidatePath("/exams");
    revalidatePath(`/exams/${validatedData.slug}`);
    if (currentExam.slug !== validatedData.slug) {
      revalidatePath(`/exams/${currentExam.slug}`);
    }

    return {
      success: true,
      data: {
        id: updatedExam.id,
        slug: updatedExam.slug,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected internal server error";
    console.error("[updateExamAction] Exception:", err);
    return { success: false, error: message };
  }
}

/**
 * Delete an unreferenced examination series with foreign key protection.
 */
export async function deleteExamAction(id: string): Promise<ActionResponse> {
  try {
    const { supabase, user } = await requireAdminSession();

    if (!id || typeof id !== "string") {
      return { success: false, error: "Invalid exam identifier provided" };
    }

    // 1. Referential integrity safeguard: Check linked notifications
    const { count, error: countError } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", id);

    if (countError) {
      console.error("[deleteExamAction] Error verifying notifications count:", countError);
      return { success: false, error: "Failed to verify exam dependencies" };
    }

    if (count && count > 0) {
      return {
        success: false,
        error: `Cannot delete exam: There are ${count} active notification(s) linked to it. Please reassign or delete the notifications first.`,
      };
    }

    // 2. Fetch record to capture in audit log
    const { data: examToDelete } = await supabase
      .from("exams")
      .select("title, slug, conducting_body")
      .eq("id", id)
      .single();

    // 3. Delete exam record
    const { error: deleteError } = await supabase
      .from("exams")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("[deleteExamAction] Database delete error:", deleteError);
      return {
        success: false,
        error: "Failed to delete exam: " + deleteError.message,
      };
    }

    // 4. Record audit log
    const { error: auditError } = await supabase.from("audit_logs").insert({
      admin_id: user.id,
      action: "delete_exam",
      target_entity: "exam",
      target_id: id,
      metadata: {
        deletedExam: examToDelete || { id },
        deletedAt: new Date().toISOString(),
      } as unknown as Json,
    });

    if (auditError) {
      console.warn("[deleteExamAction] Audit logging failed:", auditError);
    }

    // 5. Invalidate caches
    revalidatePath("/admin/exams");
    revalidatePath("/exams");
    revalidatePath("/");

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected internal server error";
    console.error("[deleteExamAction] Exception:", err);
    return { success: false, error: message };
  }
}
