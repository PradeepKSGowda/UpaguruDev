"use server";

/**
 * @file app/dashboard/eligibility/actions.ts
 * @description Server Actions for Smart Eligibility Matching Engine.
 * Fetches candidate profile, runs matching engine against active notifications,
 * manages candidate qualification/eligibility preferences, and returns ranked results.
 *
 * Enhancement: ENH-0009 (Smart Eligibility Matching Engine)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-002 (Database)
 */

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import {
  matchCandidateToNotifications,
  type CandidateProfile,
  type NotificationEligibilityCriteria,
  type EligibilityResult,
} from "@/lib/matching/eligibility-engine";
import {
  eligibilityPreferencesSchema,
  eligibilityFilterSchema,
  type EligibilityPreferencesInput,
  type EligibilityFilterInput,
} from "@/lib/schemas/eligibility-matching";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolves the authenticated candidate or dev fallback user.
 */
async function resolveCandidateUser() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return { supabase, user, isDevFallback: false };
  }

  // Fallback for development if no active session and explicitly opted-in (SEC-05)
  if (
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_DEV_AUTH_BYPASS === "true"
  ) {
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

// ─── Server Actions ──────────────────────────────────────────────────────────

/**
 * Fetches real-time eligibility matches for the authenticated candidate.
 * Runs the matching engine on-demand against all active published notifications.
 *
 * @param rawFilters - Optional filter and pagination options
 * @returns Ranked eligibility matches with total eligible count and completeness score
 */
export async function getEligibilityMatches(
  rawFilters?: Partial<EligibilityFilterInput>
): Promise<{
  success: boolean;
  data: EligibilityResult[];
  totalEligible: number;
  profileCompleteness: number;
  error?: string;
}> {
  try {
    const filters = eligibilityFilterSchema.parse(rawFilters || {});
    const { supabase, user } = await resolveCandidateUser();

    if (!user) {
      return {
        success: false,
        data: [],
        totalEligible: 0,
        profileCompleteness: 0,
        error: "Authentication required to view eligibility matches",
      };
    }

    // 1. Fetch candidate profile data
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("date_of_birth, gender, category, state")
      .eq("id", user.id)
      .maybeSingle();

    // 2. Fetch eligibility preferences (qualifications)
    const { data: prefs } = await supabase
      .from("candidate_eligibility_preferences")
      .select("qualifications, include_all_india_exams, include_state_exams, preferred_categories")
      .eq("user_id", user.id)
      .maybeSingle();

    // 3. Build candidate profile
    const candidateProfile: CandidateProfile = {
      dateOfBirth: userProfile?.date_of_birth || null,
      gender: userProfile?.gender || null,
      category: userProfile?.category || null,
      state: userProfile?.state || null,
      qualifications: prefs?.qualifications || [],
    };

    // 4. Calculate profile completeness for matching quality
    const filledFields = [
      candidateProfile.dateOfBirth,
      candidateProfile.gender,
      candidateProfile.category,
      candidateProfile.state,
      candidateProfile.qualifications.length > 0,
    ].filter(Boolean).length;
    const profileCompleteness = Math.round((filledFields / 5) * 100);

    // 5. Fetch active published notifications with exam metadata
    const { data: notifications, error: notifError } = await supabase
      .from("notifications")
      .select(`
        id,
        title,
        slug,
        age_limit_min,
        age_limit_max,
        qualification_required,
        application_start_date,
        application_end_date,
        status,
        exams!inner (
          state_or_central,
          category
        )
      `)
      .eq("status", "published")
      .gte("application_end_date", new Date().toISOString());

    if (notifError) throw notifError;

    // 6. Transform to matching engine criteria input
    const criteria: NotificationEligibilityCriteria[] = (notifications || []).map((n: any) => ({
      notificationId: n.id,
      title: n.title,
      slug: n.slug,
      ageLimitMin: n.age_limit_min,
      ageLimitMax: n.age_limit_max,
      qualificationRequired: n.qualification_required || [],
      applicationStartDate: n.application_start_date,
      applicationEndDate: n.application_end_date,
      examStateOrCentral: n.exams?.state_or_central || "Central",
      examCategory: n.exams?.category || "other",
      status: n.status,
    }));

    // 7. Run matching engine
    const allResults = matchCandidateToNotifications(candidateProfile, criteria);

    // 8. Apply score filter
    const filtered = allResults.filter((r) => r.overallScore >= filters.minScore);

    // 9. Sort
    const sorted = [...filtered].sort((a, b) => {
      if (filters.sortBy === "deadline") return a.daysUntilDeadline - b.daysUntilDeadline;
      return b.overallScore - a.overallScore;
    });

    // 10. Paginate
    const start = (filters.page - 1) * filters.pageSize;
    const paginated = sorted.slice(start, start + filters.pageSize);

    return {
      success: true,
      data: paginated,
      totalEligible: filtered.filter((r) => r.isEligible).length,
      profileCompleteness,
    };
  } catch (err: any) {
    return {
      success: false,
      data: [],
      totalEligible: 0,
      profileCompleteness: 0,
      error: err.message || "Failed to compute eligibility matches",
    };
  }
}

/**
 * Retrieves candidate's current eligibility preferences.
 */
export async function getEligibilityPreferences(): Promise<{
  success: boolean;
  data?: EligibilityPreferencesInput;
  error?: string;
}> {
  try {
    const { supabase, user } = await resolveCandidateUser();
    if (!user) return { success: false, error: "Authentication required" };

    const { data: prefs, error } = await supabase
      .from("candidate_eligibility_preferences")
      .select("qualifications, include_all_india_exams, include_state_exams, preferred_categories")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    if (!prefs) {
      return {
        success: true,
        data: {
          qualifications: [],
          includeAllIndiaExams: true,
          includeStateExams: true,
          preferredCategories: [],
          showExpiringSoonOnly: false,
        } as any,
      };
    }

    return {
      success: true,
      data: {
        qualifications: (prefs.qualifications || []) as any,
        includeAllIndiaExams: prefs.include_all_india_exams ?? true,
        includeStateExams: prefs.include_state_exams ?? true,
        preferredCategories: (prefs.preferred_categories || []) as any,
        showExpiringSoonOnly: false,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch preferences" };
  }
}

/**
 * Saves or updates candidate's eligibility preferences (qualifications, exam type preferences).
 *
 * @param input - Validated eligibility preferences payload
 */
export async function saveEligibilityPreferences(
  input: EligibilityPreferencesInput
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const parsed = eligibilityPreferencesSchema.parse(input);
    const { supabase, user } = await resolveCandidateUser();

    if (!user) {
      return { success: false, error: "Authentication required" };
    }

    const { error } = await supabase.from("candidate_eligibility_preferences").upsert(
      {
        user_id: user.id,
        qualifications: parsed.qualifications,
        include_all_india_exams: parsed.includeAllIndiaExams,
        include_state_exams: parsed.includeStateExams,
        preferred_categories: parsed.preferredCategories,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) throw error;

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/eligibility");

    return { success: true, message: "Eligibility preferences saved successfully!" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save preferences" };
  }
}
