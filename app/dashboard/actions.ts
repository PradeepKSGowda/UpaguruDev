"use server";

/**
 * @file app/dashboard/actions.ts
 * @description Next.js 15 Server Actions for Candidate Personal Workspace.
 * Handles profile retrieval and updates, bookmark toggling, personal notes management,
 * exam application milestone tracking, and contact OTP verification.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-002 (Database), ADR-003 (RBAC)
 */

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import {
  accountSettingsSchema,
  bookmarkToggleSchema,
  examNoteSchema,
  examTrackingSchema,
  type AccountSettingsInput,
  type BookmarkToggleInput,
  type ExamNoteInput,
  type ExamTrackingInput,
} from "@/lib/schemas/candidate-workspace";

// Helper to resolve current candidate or development fallback user
async function resolveCandidateUser() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return { supabase, user, isDevFallback: false };
  }

  // Fallback for development if no active session
  if (process.env.NODE_ENV === "development") {
    // Check if there is an existing profile in the database
    const { data: firstProfile } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .limit(1)
      .single();

    if (firstProfile) {
      return {
        supabase,
        user: {
          id: firstProfile.id,
          email: firstProfile.email,
          user_metadata: { full_name: firstProfile.full_name },
        },
        isDevFallback: true,
      };
    }
  }

  return { supabase, user: null, isDevFallback: false };
}

/**
 * Calculates candidate profile completion percentage based on non-empty fields.
 */
function computeCompletion(profile: any): number {
  if (!profile) return 15;
  const fields = [
    profile.first_name,
    profile.last_name,
    profile.phone,
    profile.is_phone_verified,
    profile.date_of_birth,
    profile.gender,
    profile.category,
    profile.state,
    profile.district,
    profile.pincode,
  ];
  const filled = fields.filter((f) => Boolean(f)).length;
  // Base 15% for having registered account
  return Math.min(100, Math.round(15 + (filled / fields.length) * 85));
}

/**
 * Fetches candidate profile and metadata.
 */
export async function getCandidateProfileData() {
  try {
    const { supabase, user } = await resolveCandidateUser();
    if (!user) {
      return { success: false, error: "Unauthenticated" };
    }

    // 1. Fetch user_profiles extension
    const { data: userProfile, error: profileErr } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // 2. Fetch base profile for full_name and email
    const { data: baseProfile } = await supabase
      .from("profiles")
      .select("full_name, email, role, avatar_url")
      .eq("id", user.id)
      .single();

    const completion = computeCompletion(userProfile);

    return {
      success: true,
      data: {
        userId: user.id,
        email: baseProfile?.email || user.email || "",
        fullName: baseProfile?.full_name || "",
        avatarUrl: baseProfile?.avatar_url || userProfile?.avatar_url || null,
        role: baseProfile?.role || "candidate",
        profile: userProfile || null,
        completionPercentage: completion,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load candidate profile" };
  }
}

/**
 * Updates candidate personal and contact details.
 */
export async function updateCandidateProfileAction(input: AccountSettingsInput) {
  try {
    const parsed = accountSettingsSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || "Invalid input data" };
    }

    const { supabase, user } = await resolveCandidateUser();
    if (!user) {
      return { success: false, error: "Unauthenticated" };
    }

    const val = parsed.data;
    const fullName = `${val.firstName} ${val.lastName || ""}`.trim();

    // 1. Upsert into user_profiles
    const { error: upsertErr } = await supabase
      .from("user_profiles")
      .upsert({
        id: user.id,
        first_name: val.firstName,
        last_name: val.lastName || null,
        alternate_email: val.alternateEmail || null,
        phone: val.phone || null,
        alternate_phone: val.alternatePhone || null,
        gender: val.gender || null,
        date_of_birth: val.dateOfBirth || null,
        category: val.category || "General",
        address_line: val.addressLine || null,
        state: val.state || null,
        district: val.district || null,
        pincode: val.pincode || null,
        language_preference: val.languagePreference,
        profile_completion_percentage: computeCompletion(val),
        updated_at: new Date().toISOString(),
      });

    if (upsertErr) {
      console.error("[CandidateActions] Update user_profiles error:", upsertErr);
      return { success: false, error: upsertErr.message };
    }

    // 2. Synchronize full_name to base profiles table
    await supabase
      .from("profiles")
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    // 3. Audit trail
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "CANDIDATE_PROFILE_UPDATED",
      entity_name: "user_profiles",
      entity_id: user.id,
      metadata: { fields_updated: Object.keys(val) },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/profile");

    return { success: true, message: "Profile updated successfully!" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update profile" };
  }
}

/**
 * Toggles a bookmark for an exam or notification.
 */
export async function toggleBookmarkAction(input: BookmarkToggleInput) {
  try {
    const parsed = bookmarkToggleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid bookmark input" };
    }

    const { supabase, user } = await resolveCandidateUser();
    if (!user) {
      return { success: false, error: "Unauthenticated" };
    }

    const { entityType, entityId } = parsed.data;

    // Check if already bookmarked
    const { data: existing } = await supabase
      .from("bookmarks")
      .select("id")
      .eq("user_id", user.id)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .maybeSingle();

    if (existing) {
      // Remove bookmark
      await supabase.from("bookmarks").delete().eq("id", existing.id);
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/bookmarks");
      return { success: true, isBookmarked: false, message: "Bookmark removed" };
    } else {
      // Add bookmark
      await supabase.from("bookmarks").insert({
        user_id: user.id,
        entity_type: entityType,
        entity_id: entityId,
      });
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/bookmarks");
      return { success: true, isBookmarked: true, message: "Saved to bookmarks" };
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to toggle bookmark" };
  }
}

/**
 * Fetches all bookmarks for the authenticated candidate.
 */
export async function getCandidateBookmarks() {
  try {
    const { supabase, user } = await resolveCandidateUser();
    if (!user) return { success: false, error: "Unauthenticated", data: [] };

    const { data: rawBookmarks, error } = await supabase
      .from("bookmarks")
      .select("id, entity_type, entity_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message, data: [] };
    }

    // Enrich notifications
    const notifIds = rawBookmarks.filter((b) => b.entity_type === "notification").map((b) => b.entity_id);
    let notifsMap = new Map<string, any>();

    if (notifIds.length > 0) {
      const { data: notifs } = await supabase
        .from("notifications")
        .select("id, slug, title, total_vacancies, application_end_date, official_pdf_url, category, state")
        .in("id", notifIds);
      notifs?.forEach((n) => notifsMap.set(n.id, n));
    }

    const enriched = rawBookmarks.map((b) => {
      const notif = notifsMap.get(b.entity_id);
      return {
        id: b.id,
        entityType: b.entity_type,
        entityId: b.entity_id,
        createdAt: b.created_at,
        details: notif || { title: `Saved Item (${b.entity_type})` },
      };
    });

    return { success: true, data: enriched };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch bookmarks", data: [] };
  }
}

/**
 * Fetches all personal exam notes for candidate.
 */
export async function getCandidateNotes() {
  try {
    const { supabase, user } = await resolveCandidateUser();
    if (!user) return { success: false, error: "Unauthenticated", data: [] };

    const { data, error } = await supabase
      .from("exam_notes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message, data: [] };
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Creates or updates a personal exam note.
 */
export async function saveExamNoteAction(input: ExamNoteInput) {
  try {
    const parsed = examNoteSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || "Invalid note data" };
    }

    const { supabase, user } = await resolveCandidateUser();
    if (!user) return { success: false, error: "Unauthenticated" };

    const val = parsed.data;

    if (val.noteId) {
      // Update
      const { error } = await supabase
        .from("exam_notes")
        .update({
          title: val.title,
          content: val.content,
          tags: val.tags,
          is_archived: val.isArchived,
          updated_at: new Date().toISOString(),
        })
        .eq("id", val.noteId)
        .eq("user_id", user.id);

      if (error) return { success: false, error: error.message };
    } else {
      // Insert
      const { error } = await supabase.from("exam_notes").insert({
        user_id: user.id,
        exam_id: val.examId || null,
        notification_id: val.notificationId || null,
        title: val.title,
        content: val.content,
        tags: val.tags,
        is_archived: val.isArchived,
      });

      if (error) return { success: false, error: error.message };
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/notes");

    return { success: true, message: "Exam note saved successfully!" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save note" };
  }
}

/**
 * Deletes a personal exam note.
 */
export async function deleteExamNoteAction(noteId: string) {
  try {
    const { supabase, user } = await resolveCandidateUser();
    if (!user) return { success: false, error: "Unauthenticated" };

    const { error } = await supabase
      .from("exam_notes")
      .delete()
      .eq("id", noteId)
      .eq("user_id", user.id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/notes");
    return { success: true, message: "Note deleted" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetches candidate application tracking records.
 */
export async function getCandidateTracking() {
  try {
    const { supabase, user } = await resolveCandidateUser();
    if (!user) return { success: false, error: "Unauthenticated", data: [] };

    const { data: tracking, error } = await supabase
      .from("user_exam_tracking")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) return { success: false, error: error.message, data: [] };

    // Fetch related notification details
    const notifIds = (tracking || []).map((t) => t.notification_id);
    let notifsMap = new Map<string, any>();
    if (notifIds.length > 0) {
      const { data: notifs } = await supabase
        .from("notifications")
        .select("id, title, slug, application_end_date, category, state")
        .in("id", notifIds);
      notifs?.forEach((n) => notifsMap.set(n.id, n));
    }

    const enriched = (tracking || []).map((t) => ({
      ...t,
      notification: notifsMap.get(t.notification_id) || { title: "Exam Application" },
    }));

    return { success: true, data: enriched };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Saves or updates exam tracking milestone data.
 */
export async function updateExamTrackingAction(input: ExamTrackingInput) {
  try {
    const parsed = examTrackingSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || "Invalid tracking data" };
    }

    const { supabase, user } = await resolveCandidateUser();
    if (!user) return { success: false, error: "Unauthenticated" };

    const val = parsed.data;

    const { error } = await supabase.from("user_exam_tracking").upsert(
      {
        user_id: user.id,
        notification_id: val.notificationId,
        application_submitted: val.applicationSubmitted,
        application_number: val.applicationNumber || null,
        fee_paid: val.feePaid,
        fee_amount: val.feeAmount || null,
        hall_ticket_downloaded: val.hallTicketDownloaded,
        exam_attended: val.examAttended,
        result_status: val.resultStatus,
        custom_notes: val.customNotes || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,notification_id" }
    );

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/tracking");
    return { success: true, message: "Tracking status updated!" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Sends a simulated verification OTP to candidate's mobile number.
 */
export async function sendContactOtpAction(phone: string) {
  try {
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return { success: false, error: "Invalid 10-digit Indian mobile number" };
    }

    const { supabase, user } = await resolveCandidateUser();
    if (!user) return { success: false, error: "Unauthenticated" };

    // Record verification request in database with 10-minute expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    // Default simulated test OTP hash (in production this delegates to SMS gateway like MSG91/Fast2SMS)
    const testOtp = "123456";

    await supabase.from("verification_requests").insert({
      user_id: user.id,
      target_type: "phone",
      target_value: phone,
      token_hash: testOtp,
      expires_at: expiresAt,
    });

    return {
      success: true,
      message: `OTP sent successfully to +91 ${phone} (Demo Code: 123456)`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Verifies mobile OTP and marks candidate phone as verified.
 */
export async function verifyContactOtpAction(phone: string, otp: string) {
  try {
    const { supabase, user } = await resolveCandidateUser();
    if (!user) return { success: false, error: "Unauthenticated" };

    // Verify against verification_requests or accept test OTP
    if (otp !== "123456") {
      const { data: request } = await supabase
        .from("verification_requests")
        .select("id, token_hash, expires_at")
        .eq("user_id", user.id)
        .eq("target_type", "phone")
        .eq("target_value", phone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!request || request.token_hash !== otp) {
        return { success: false, error: "Invalid or expired OTP code" };
      }
    }

    // Mark phone as verified in user_profiles
    await supabase
      .from("user_profiles")
      .update({
        phone,
        is_phone_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/profile");
    return { success: true, message: "Phone number verified successfully!" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
