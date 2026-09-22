/**
 * @file lib/data/subscriptions.ts
 * @module SubscriptionsDataAccess
 * @description Strongly-typed server-side data access layer for reading candidate subscription
 * alert preferences from Supabase PostgreSQL public.user_subscriptions.
 * 
 * Task ID: TASK-05010101 (Subtask: SUB-0501010102)
 * Architecture Reference: ADR-001 (Frontend RSC), ADR-002 (Database), ADR-007 (Omnichannel Alerts), ADR-013 (Security)
 * 
 * Complies with:
 * - Next.js 15 React Server Component execution standards
 * - Strict TypeScript types (Zero `any`)
 * - Row Level Security (RLS) enforcement via authenticated user session
 * - Graceful fallback to default values for newly registered candidates
 */

import { createServerClient } from "../supabase/server";
import { createAdminClient } from "../supabase";
import type { Database, ExamCategoryEnum } from "../../types/database.types";
import type { UserSubscription, NotificationChannel } from "../../types/subscriptions";

type UserSubscriptionRow = Database["public"]["Tables"]["user_subscriptions"]["Row"];

export interface SubscriberMatchCriteria {
  examId?: string | null;
  category?: ExamCategoryEnum | string | null;
  stateOrCentral?: string | null;
}

export interface MatchedSubscribersByChannel {
  totalMatchedCandidates: number;
  fcmDeviceTokens: string[];
  telegramChatIds: string[];
  whatsappPhoneNumbers: string[];
  emailRecipients: Array<{ email: string; userId: string }>;
}

/**
 * Maps a raw Supabase PostgreSQL row to a client-friendly UserSubscription domain model
 */
export function mapRowToUserSubscription(row: UserSubscriptionRow): UserSubscription {
  return {
    id: row.id,
    userId: row.user_id,
    preferredChannels: (row.preferred_channels || ["web_push"]) as NotificationChannel[],
    telegramChatId: row.telegram_chat_id,
    whatsappPhoneNumber: row.whatsapp_phone_number,
    fcmDeviceToken: row.fcm_device_token,
    subscribedExamIds: (row.subscribed_exam_ids || []) as string[],
    subscribedCategories: (row.subscribed_categories || []) as ExamCategoryEnum[],
    subscribedStates: (row.subscribed_states || []) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetches the active subscription preferences for a given user ID.
 * Returns null if the user has not yet initialized subscription preferences.
 * 
 * @param {string} userId Supabase auth UUID of the candidate
 * @returns {Promise<UserSubscription | null>} The candidate's subscription preferences or null
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  if (!userId) return null;

  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[SubscriptionsDataAccess] Error fetching user subscription:", error.message);
      return null;
    }

    if (!data) return null;

    return mapRowToUserSubscription(data);
  } catch (err) {
    console.error("[SubscriptionsDataAccess] Unexpected error:", err);
    return null;
  }
}

/**
 * Subtask SUB-0505010102:
 * Queries public.user_subscriptions using GIN array containment and PostgreSQL RPC
 * to resolve all candidates matching a published notification's exam_id, category, or state.
 * Groups matching candidate identifiers by their opted delivery channel (FCM, Telegram, WhatsApp, Email).
 * 
 * @param {SubscriberMatchCriteria} criteria Notification parameters for matching
 * @returns {Promise<MatchedSubscribersByChannel>} Grouped arrays of recipient identifiers
 */
export async function findMatchingSubscribersForNotification(
  criteria: SubscriberMatchCriteria
): Promise<MatchedSubscribersByChannel> {
  const result: MatchedSubscribersByChannel = {
    totalMatchedCandidates: 0,
    fcmDeviceTokens: [],
    telegramChatIds: [],
    whatsappPhoneNumbers: [],
    emailRecipients: [],
  };

  try {
    const supabaseAdmin = createAdminClient();

    // 1. Try PostgreSQL RPC match_notification_subscribers first
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
      "match_notification_subscribers",
      {
        p_exam_id: criteria.examId || null,
        p_category: criteria.category || null,
        p_state: criteria.stateOrCentral || null,
      }
    );

    if (!rpcError && Array.isArray(rpcData)) {
      const seenUsers = new Set<string>();
      const seenFcm = new Set<string>();
      const seenTelegram = new Set<string>();
      const seenWhatsapp = new Set<string>();
      const seenEmail = new Set<string>();

      for (const row of rpcData) {
        if (row.user_id) seenUsers.add(row.user_id);
        const channels = (row.preferred_channels || []) as string[];

        // Web Push (FCM)
        if (channels.includes("web_push") && row.fcm_device_token) {
          if (!seenFcm.has(row.fcm_device_token)) {
            seenFcm.add(row.fcm_device_token);
            result.fcmDeviceTokens.push(row.fcm_device_token);
          }
        }

        // Telegram
        if (channels.includes("telegram") && row.telegram_chat_id) {
          if (!seenTelegram.has(row.telegram_chat_id)) {
            seenTelegram.add(row.telegram_chat_id);
            result.telegramChatIds.push(row.telegram_chat_id);
          }
        }

        // WhatsApp
        if (channels.includes("whatsapp") && row.whatsapp_phone_number) {
          if (!seenWhatsapp.has(row.whatsapp_phone_number)) {
            seenWhatsapp.add(row.whatsapp_phone_number);
            result.whatsappPhoneNumbers.push(row.whatsapp_phone_number);
          }
        }

        // Email
        if (channels.includes("email") && row.email) {
          if (!seenEmail.has(row.email)) {
            seenEmail.add(row.email);
            result.emailRecipients.push({
              email: row.email,
              userId: row.user_id,
            });
          }
        }
      }

      result.totalMatchedCandidates = seenUsers.size;
      return result;
    }

    // 2. Resilient Fallback: direct table query if RPC is not yet executed
    console.warn(
      "[SubscriptionsDataAccess] RPC match_notification_subscribers unavailable, using table query fallback:",
      rpcError?.message
    );

    const { data: rows, error: queryError } = await supabaseAdmin
      .from("user_subscriptions")
      .select("*");

    if (queryError || !rows) {
      console.error("[SubscriptionsDataAccess] Fallback query failed:", queryError?.message);
      return result;
    }

    const seenUsers = new Set<string>();
    const seenFcm = new Set<string>();
    const seenTelegram = new Set<string>();
    const seenWhatsapp = new Set<string>();

    for (const row of rows) {
      // Check match conditions
      const matchesExam = Boolean(
        criteria.examId &&
          Array.isArray(row.subscribed_exam_ids) &&
          row.subscribed_exam_ids.includes(criteria.examId)
      );

      const categoryMatches =
        !row.subscribed_categories ||
        row.subscribed_categories.length === 0 ||
        (criteria.category &&
          row.subscribed_categories.includes(criteria.category as ExamCategoryEnum));

      const stateMatches =
        !row.subscribed_states ||
        row.subscribed_states.length === 0 ||
        !criteria.stateOrCentral ||
        criteria.stateOrCentral.includes("Central") ||
        criteria.stateOrCentral.includes("All-India") ||
        row.subscribed_states.includes("All-India / Central") ||
        row.subscribed_states.includes(criteria.stateOrCentral);

      const matchesFilters = categoryMatches && stateMatches;

      if (matchesExam || matchesFilters) {
        seenUsers.add(row.user_id);
        const channels = (row.preferred_channels || []) as string[];

        if (
          channels.includes("web_push") &&
          row.fcm_device_token &&
          !seenFcm.has(row.fcm_device_token)
        ) {
          seenFcm.add(row.fcm_device_token);
          result.fcmDeviceTokens.push(row.fcm_device_token);
        }

        if (
          channels.includes("telegram") &&
          row.telegram_chat_id &&
          !seenTelegram.has(row.telegram_chat_id)
        ) {
          seenTelegram.add(row.telegram_chat_id);
          result.telegramChatIds.push(row.telegram_chat_id);
        }

        if (
          channels.includes("whatsapp") &&
          row.whatsapp_phone_number &&
          !seenWhatsapp.has(row.whatsapp_phone_number)
        ) {
          seenWhatsapp.add(row.whatsapp_phone_number);
          result.whatsappPhoneNumbers.push(row.whatsapp_phone_number);
        }
      }
    }

    result.totalMatchedCandidates = seenUsers.size;
    return result;
  } catch (err) {
    console.error("[SubscriptionsDataAccess] Fatal error in findMatchingSubscribersForNotification:", err);
    return result;
  }
}

