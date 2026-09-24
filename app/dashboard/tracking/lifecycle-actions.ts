"use server";

/**
 * @file app/dashboard/tracking/lifecycle-actions.ts
 * @description Next.js 15 Server Actions for Exam Lifecycle Tracking
 * (Admit Card, Exam Dates, Answer Key & Objections, Results).
 *
 * Enhancement: ENH-0012 (Exam Lifecycle Automated Status Tracker)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-002 (Database), ADR-003 (RBAC)
 */

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import {
  buildExamLifecycleTimeline,
  type ExamLifecycleTimelineSummary,
  type RawLifecycleEvent,
} from "@/lib/lifecycle/lifecycle-service";
import {
  createLifecycleEventSchema,
  type CreateLifecycleEventInput,
} from "@/lib/schemas/exam-lifecycle";
import { checkUserPermission } from "@/lib/rbac/rbac-service";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function resolveCurrentUser() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return { supabase, user };
  }

  // Development auth fallback guarded by SEC-05
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

  return { supabase, user: null };
}

// ─── Server Actions ─────────────────────────────────────────────────────────

/**
 * Fetches the lifecycle timeline and milestones for a specific examination notification.
 */
export async function getExamLifecycleAction(notificationId: string): Promise<{
  success: boolean;
  data?: ExamLifecycleTimelineSummary;
  error?: string;
}> {
  try {
    const { supabase } = await resolveCurrentUser();

    // 1. Fetch notification
    const { data: notif, error: notifError } = await supabase
      .from("notifications")
      .select("id, title, application_start_date, application_end_date")
      .eq("id", notificationId)
      .single();

    if (notifError || !notif) {
      return { success: false, error: notifError?.message || "Notification not found" };
    }

    // 2. Fetch lifecycle events
    const { data: events, error: eventsError } = await supabase
      .from("exam_lifecycle_events")
      .select("*")
      .eq("notification_id", notificationId)
      .eq("status", "published")
      .order("release_date", { ascending: false });

    if (eventsError) {
      return { success: false, error: eventsError.message };
    }

    // 3. Build timeline
    const timeline = buildExamLifecycleTimeline(
      {
        id: notif.id,
        title: notif.title,
        applicationStartDate: notif.application_start_date,
        applicationEndDate: notif.application_end_date,
      },
      (events || []) as RawLifecycleEvent[]
    );

    return { success: true, data: timeline };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load lifecycle timeline" };
  }
}

/**
 * Publishes an official exam lifecycle event (Admit Card, Exam Date, Answer Key, Result).
 * Protected by RBAC: requires 'notifications:write' permission.
 */
export async function publishLifecycleEventAction(
  rawInput: CreateLifecycleEventInput
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const input = createLifecycleEventSchema.parse(rawInput);
    const { supabase, user } = await resolveCurrentUser();

    if (!user) {
      return { success: false, error: "Authentication required to publish events" };
    }

    // RBAC check
    const hasPerm = await checkUserPermission(user.id, "notifications:write");
    if (!hasPerm) {
      return { success: false, error: "Forbidden: insufficient permissions to publish lifecycle events" };
    }

    const { error } = await supabase.from("exam_lifecycle_events").insert({
      notification_id: input.notificationId,
      event_type: input.eventType,
      title: input.title,
      description: input.description,
      official_url: input.officialUrl || null,
      release_date: input.releaseDate,
      closing_date: input.closingDate,
      metadata: input.metadata,
      status: input.status,
      created_by: user.id,
    });

    if (error) throw error;

    revalidatePath(`/dashboard/tracking/${input.notificationId}`);
    revalidatePath("/dashboard/tracking");
    revalidatePath("/dashboard");

    return { success: true, message: `Lifecycle event '${input.eventType}' published successfully` };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to publish lifecycle event" };
  }
}

/**
 * Aggregates high-priority lifecycle alerts across all exams the candidate is tracking.
 */
export async function getCandidateLifecycleFeedAction(): Promise<{
  success: boolean;
  data: Array<{
    notificationId: string;
    notificationTitle: string;
    notificationSlug: string;
    eventType: string;
    title: string;
    officialUrl: string | null;
    closingDate: string | null;
    daysRemaining: number | null;
    isUrgent: boolean;
  }>;
  error?: string;
}> {
  try {
    const { supabase, user } = await resolveCurrentUser();
    if (!user) return { success: true, data: [] };

    // 1. Get candidate's tracked notification IDs
    const { data: trackedExams } = await supabase
      .from("user_exam_tracking")
      .select("notification_id, notifications(id, title, slug)")
      .eq("user_id", user.id);

    if (!trackedExams || trackedExams.length === 0) {
      return { success: true, data: [] };
    }

    const notifIds = trackedExams.map((t) => t.notification_id);

    // 2. Fetch published lifecycle events for these exams
    const { data: events, error } = await supabase
      .from("exam_lifecycle_events")
      .select(`
        id, notification_id, event_type, title, official_url, release_date, closing_date,
        notifications ( id, title, slug )
      `)
      .in("notification_id", notifIds)
      .eq("status", "published")
      .order("release_date", { ascending: false });

    if (error) throw error;

    const now = new Date();
    const feed = (events || []).map((e: any) => {
      const closingDays = e.closing_date
        ? Math.ceil((new Date(e.closing_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        notificationId: e.notification_id,
        notificationTitle: e.notifications?.title || "Exam",
        notificationSlug: e.notifications?.slug || "",
        eventType: e.event_type,
        title: e.title,
        officialUrl: e.official_url,
        closingDate: e.closing_date,
        daysRemaining: closingDays,
        isUrgent: closingDays !== null && closingDays >= 0 && closingDays <= 3,
      };
    });

    return { success: true, data: feed };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}
