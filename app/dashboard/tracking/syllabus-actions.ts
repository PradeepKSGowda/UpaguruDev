"use server";

/**
 * @file app/dashboard/tracking/syllabus-actions.ts
 * @description Server Actions for Interactive Exam Syllabus & Subject Mastery Tracker.
 * Manages topic progression, completion toggles, spaced-repetition revisions,
 * custom topic insertion, and syllabus progress resets.
 *
 * Enhancement: ENH-0011 (Interactive Exam Syllabus & Subject Mastery Tracker)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-002 (Database), ADR-003 (RBAC)
 */

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import {
  extractCanonicalSyllabus,
  mergeSyllabusWithProgress,
  calculateSyllabusMastery,
  type SyllabusMasterySummary,
  type RawSyllabusTopicRecord,
} from "@/lib/syllabus/syllabus-tracker";
import {
  updateTopicProgressSchema,
  addCustomTopicSchema,
  deleteCustomTopicSchema,
  resetSyllabusProgressSchema,
  type UpdateTopicProgressInput,
  type AddCustomTopicInput,
  type DeleteCustomTopicInput,
  type ResetSyllabusProgressInput,
} from "@/lib/schemas/syllabus-tracking";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function resolveAuthenticatedUser() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return { supabase, user };
  }

  // Safe development fallback guarded by SEC-05
  if (
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_DEV_AUTH_BYPASS === "true"
  ) {
    const { data: firstProfile } = await supabase
      .from("profiles")
      .select("id, email")
      .limit(1)
      .single();

    if (firstProfile) {
      return {
        supabase,
        user: { id: firstProfile.id, email: firstProfile.email },
      };
    }
  }

  throw new Error("Authentication required to access syllabus tracker.");
}

// ─── Server Actions ─────────────────────────────────────────────────────────

/**
 * Retrieves the complete merged syllabus structure and candidate mastery metrics
 * for a specific examination notification.
 */
export async function getSyllabusProgressAction(notificationId: string): Promise<{
  success: boolean;
  data?: {
    summary: SyllabusMasterySummary;
    examTitle: string;
    examCategory: string;
    notificationSlug: string;
    applicationEndDate: string | null;
  };
  error?: string;
}> {
  try {
    const { supabase, user } = await resolveAuthenticatedUser();

    // 1. Fetch notification metadata & syllabus summary
    const { data: notification, error: notifError } = await supabase
      .from("notifications")
      .select(`
        id, title, slug, application_end_date, syllabus_summary,
        exams ( category )
      `)
      .eq("id", notificationId)
      .single();

    if (notifError || !notification) {
      return {
        success: false,
        error: notifError?.message || "Notification not found",
      };
    }

    const examCategory = (notification.exams as any)?.category || "other";

    // 2. Fetch candidate's saved progress records for this notification
    const { data: progressRecords, error: progressError } = await supabase
      .from("candidate_syllabus_progress")
      .select("id, subject_key, topic_title, status, revision_count, confidence_level, last_reviewed_at, notes")
      .eq("user_id", user.id)
      .eq("notification_id", notificationId);

    if (progressError) {
      return { success: false, error: progressError.message };
    }

    // 3. Extract canonical syllabus and merge with persisted progress
    const canonical = extractCanonicalSyllabus(notification.syllabus_summary, examCategory);
    const mergedTopics = mergeSyllabusWithProgress(
      canonical,
      (progressRecords || []) as RawSyllabusTopicRecord[]
    );

    // 4. Calculate metrics
    const summary = calculateSyllabusMastery(mergedTopics, notification.application_end_date);

    return {
      success: true,
      data: {
        summary,
        examTitle: notification.title,
        examCategory,
        notificationSlug: notification.slug,
        applicationEndDate: notification.application_end_date,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to load syllabus progress",
    };
  }
}

/**
 * Updates a topic's completion status, confidence level, notes, or increments revision.
 */
export async function updateTopicProgressAction(
  rawInput: UpdateTopicProgressInput
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const input = updateTopicProgressSchema.parse(rawInput);
    const { supabase, user } = await resolveAuthenticatedUser();

    const now = new Date().toISOString();

    // Check if record exists to handle revision increment accurately
    const { data: existing } = await supabase
      .from("candidate_syllabus_progress")
      .select("id, revision_count")
      .eq("user_id", user.id)
      .eq("notification_id", input.notificationId)
      .eq("subject_key", input.subjectKey)
      .eq("topic_title", input.topicTitle)
      .maybeSingle();

    const currentRevisions = existing?.revision_count || 0;
    const newRevisions = input.revisionIncrement ? currentRevisions + 1 : currentRevisions;

    const { error } = await supabase.from("candidate_syllabus_progress").upsert(
      {
        user_id: user.id,
        notification_id: input.notificationId,
        subject_key: input.subjectKey,
        topic_title: input.topicTitle,
        status: input.status,
        confidence_level: input.confidenceLevel,
        revision_count: newRevisions,
        last_reviewed_at: now,
        notes: input.notes,
        updated_at: now,
      },
      { onConflict: "user_id,notification_id,subject_key,topic_title" }
    );

    if (error) throw error;

    revalidatePath(`/dashboard/tracking/${input.notificationId}`);
    revalidatePath("/dashboard/tracking");
    revalidatePath("/dashboard");

    return { success: true, message: "Topic progress updated" };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to update topic progress",
    };
  }
}

/**
 * Adds a custom topic to a candidate's syllabus for an exam.
 */
export async function addCustomTopicAction(
  rawInput: AddCustomTopicInput
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const input = addCustomTopicSchema.parse(rawInput);
    const { supabase, user } = await resolveAuthenticatedUser();

    const now = new Date().toISOString();

    const { error } = await supabase.from("candidate_syllabus_progress").insert({
      user_id: user.id,
      notification_id: input.notificationId,
      subject_key: input.subjectKey,
      topic_title: input.topicTitle,
      status: "not_started",
      confidence_level: 1,
      revision_count: 0,
      created_at: now,
      updated_at: now,
    });

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "This topic already exists in this subject." };
      }
      throw error;
    }

    revalidatePath(`/dashboard/tracking/${input.notificationId}`);
    return { success: true, message: "Custom topic added successfully" };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to add custom topic",
    };
  }
}

/**
 * Deletes a custom topic from candidate's syllabus.
 */
export async function deleteCustomTopicAction(
  rawInput: DeleteCustomTopicInput
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const input = deleteCustomTopicSchema.parse(rawInput);
    const { supabase, user } = await resolveAuthenticatedUser();

    const { error } = await supabase
      .from("candidate_syllabus_progress")
      .delete()
      .eq("user_id", user.id)
      .eq("notification_id", input.notificationId)
      .eq("subject_key", input.subjectKey)
      .eq("topic_title", input.topicTitle);

    if (error) throw error;

    revalidatePath(`/dashboard/tracking/${input.notificationId}`);
    return { success: true, message: "Topic removed" };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to delete topic",
    };
  }
}

/**
 * Resets candidate's syllabus progress for a specific examination (or subject).
 */
export async function resetSyllabusProgressAction(
  rawInput: ResetSyllabusProgressInput
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const input = resetSyllabusProgressSchema.parse(rawInput);
    const { supabase, user } = await resolveAuthenticatedUser();

    let query = supabase
      .from("candidate_syllabus_progress")
      .delete()
      .eq("user_id", user.id)
      .eq("notification_id", input.notificationId);

    if (input.subjectKey) {
      query = query.eq("subject_key", input.subjectKey);
    }

    const { error } = await query;
    if (error) throw error;

    revalidatePath(`/dashboard/tracking/${input.notificationId}`);
    return { success: true, message: "Syllabus progress reset successfully" };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to reset syllabus progress",
    };
  }
}
