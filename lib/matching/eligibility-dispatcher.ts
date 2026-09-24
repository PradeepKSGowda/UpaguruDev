/**
 * @file lib/matching/eligibility-dispatcher.ts
 * @description Event-driven eligibility alert dispatcher.
 * When a government exam notification is approved and published, this service evaluates
 * candidate profiles, caches the match in public.eligibility_matches, and dispatches
 * personalized Telegram and omnichannel alerts to eligible candidates.
 *
 * Enhancement: ENH-0010 (Event-Driven Eligibility Alert Dispatch & Telegram One-Click Bridge)
 * Architecture Reference: ADR-004 (Backend), ADR-007 (Omnichannel Alerts), ADR-013 (Security)
 */

import { createAdminClient } from "@/lib/supabase";
import {
  matchCandidateToNotifications,
  type CandidateProfile,
  type NotificationEligibilityCriteria,
} from "@/lib/matching/eligibility-engine";
import { formatTelegramEligibilityAlert } from "@/lib/telegram/connect";
import { sendTelegramMessage } from "@/lib/telegram/bot";

export interface EligibilityDispatchReport {
  notificationId: string;
  totalCandidatesEvaluated: number;
  eligibleCandidatesCount: number;
  telegramAlertsSent: number;
  matchesCached: number;
  durationMs: number;
  error?: string;
}

/**
 * Evaluates all candidate profiles against a newly published notification,
 * stores cached matches in the database, and dispatches personalized Telegram alerts.
 *
 * @param notificationId - UUID of the newly published notification
 * @returns Dispatch telemetry report
 */
export async function dispatchEligibilityAlertsForNotification(
  notificationId: string
): Promise<EligibilityDispatchReport> {
  const startTime = Date.now();
  const supabase = createAdminClient();

  try {
    // 1. Fetch notification metadata with exam relations
    const { data: notif, error: notifErr } = await supabase
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
          category,
          conducting_body
        )
      `)
      .eq("id", notificationId)
      .single();

    if (notifErr || !notif) {
      return {
        notificationId,
        totalCandidatesEvaluated: 0,
        eligibleCandidatesCount: 0,
        telegramAlertsSent: 0,
        matchesCached: 0,
        durationMs: Date.now() - startTime,
        error: notifErr?.message || "Notification not found",
      };
    }

    if (notif.status !== "published") {
      return {
        notificationId,
        totalCandidatesEvaluated: 0,
        eligibleCandidatesCount: 0,
        telegramAlertsSent: 0,
        matchesCached: 0,
        durationMs: Date.now() - startTime,
        error: "Notification is not published",
      };
    }

    const examData = (notif.exams as any) || {};
    const criteria: NotificationEligibilityCriteria = {
      notificationId: notif.id,
      title: notif.title,
      slug: notif.slug,
      ageLimitMin: notif.age_limit_min,
      ageLimitMax: notif.age_limit_max,
      qualificationRequired: notif.qualification_required || [],
      applicationStartDate: notif.application_start_date,
      applicationEndDate: notif.application_end_date,
      examStateOrCentral: examData.state_or_central || "Central",
      examCategory: examData.category || "other",
      status: notif.status,
    };

    // 2. Fetch all candidates with profiles and preferences
    const [profilesRes, userProfilesRes, prefsRes, subsRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email"),
      supabase.from("user_profiles").select("id, date_of_birth, gender, category, state"),
      supabase.from("candidate_eligibility_preferences").select("user_id, qualifications"),
      supabase.from("user_subscriptions").select("user_id, preferred_channels, telegram_chat_id"),
    ]);

    const profiles = profilesRes.data || [];
    const userProfilesMap = new Map((userProfilesRes.data || []).map((p) => [p.id, p]));
    const prefsMap = new Map((prefsRes.data || []).map((pr) => [pr.user_id, pr]));
    const subsMap = new Map((subsRes.data || []).map((s) => [s.user_id, s]));

    let eligibleCount = 0;
    let telegramCount = 0;
    let matchesCached = 0;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://upaguru.in";

    // 3. Evaluate each candidate
    for (const profile of profiles) {
      const uProfile = userProfilesMap.get(profile.id);
      const uPrefs = prefsMap.get(profile.id);
      const uSub = subsMap.get(profile.id);

      const candidateProfile: CandidateProfile = {
        dateOfBirth: uProfile?.date_of_birth || null,
        gender: uProfile?.gender || null,
        category: uProfile?.category || null,
        state: uProfile?.state || null,
        qualifications: uPrefs?.qualifications || [],
      };

      const results = matchCandidateToNotifications(candidateProfile, [criteria]);
      if (results.length === 0) continue;

      const result = results[0];
      if (!result) continue;

      if (result.isEligible) {
        eligibleCount++;

        // 3.1 Cache match in database
        try {
          await supabase.from("eligibility_matches").upsert(
            {
              user_id: profile.id,
              notification_id: notif.id,
              overall_score: result.overallScore,
              is_eligible: result.isEligible,
              dimension_details: result.dimensions as any,
              matched_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            },
            { onConflict: "user_id,notification_id" }
          );
          matchesCached++;
        } catch (cacheErr) {
          console.warn("[EligibilityDispatcher] Cache match write warning:", cacheErr);
        }

        // 3.2 Dispatch Telegram alert if candidate has active Telegram binding
        if (
          uSub &&
          uSub.preferred_channels?.includes("telegram") &&
          uSub.telegram_chat_id
        ) {
          try {
            const messageHtml = formatTelegramEligibilityAlert(
              profile.full_name || "Candidate",
              result,
              siteUrl
            );

            const sendRes = await sendTelegramMessage({
              chat_id: uSub.telegram_chat_id,
              text: messageHtml,
              parse_mode: "HTML",
            });

            if (sendRes.ok) {
              telegramCount++;
            }
          } catch (tgErr) {
            console.error(`[EligibilityDispatcher] Telegram send failed for ${profile.id}:`, tgErr);
          }
        }
      }
    }

    return {
      notificationId,
      totalCandidatesEvaluated: profiles.length,
      eligibleCandidatesCount: eligibleCount,
      telegramAlertsSent: telegramCount,
      matchesCached,
      durationMs: Date.now() - startTime,
    };
  } catch (err: any) {
    console.error("[EligibilityDispatcher] Critical error during alert dispatch:", err);
    return {
      notificationId,
      totalCandidatesEvaluated: 0,
      eligibleCandidatesCount: 0,
      telegramAlertsSent: 0,
      matchesCached: 0,
      durationMs: Date.now() - startTime,
      error: err.message || "Unknown error",
    };
  }
}
