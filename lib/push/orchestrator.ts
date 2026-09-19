/**
 * @file lib/push/orchestrator.ts
 * @module OmnichannelDispatchOrchestrator
 * @description Centralized omnichannel dispatch orchestrator for UPA-GURU.
 * Coordinates parallel notification delivery across Web Push (FCM), Telegram Bot API,
 * WhatsApp Business API, and Email (Resend) using Promise.allSettled with isolated
 * error containment, persistent database telemetry logging, and subscriber matching.
 * 
 * Task ID: TASK-05050102 (Subtask: SUB-0505010201)
 * Architecture Reference: ADR-004 (Backend), ADR-007 (Omnichannel Push Alert Engine), ADR-013 (Security)
 * 
 * Complies with:
 * - TypeScript strict mode (Zero `any`)
 * - Non-blocking parallel execution (Promise.allSettled)
 * - Strict error isolation (One channel failure never disrupts remaining channels)
 * - Persistent audit logging to public.notification_dispatch_logs
 */

import { sendFcmPush } from "./fcm";
import { sendTelegramBroadcast } from "./telegram";
import { sendWhatsAppBroadcast } from "./whatsapp";
import { sendEmailDigest } from "./email";
import {
  findMatchingSubscribersForNotification,
  type MatchedSubscribersByChannel,
} from "@/lib/data/subscriptions";
import { createAdminClient } from "@/lib/supabase";

export interface OmnichannelNotificationPayload {
  id: string;
  slug: string;
  title: string;
  conductingBody?: string;
  category?: string;
  stateOrCentral?: string;
  totalVacancies?: number;
  applicationEndDate?: string;
  officialPdfUrl?: string;
  applyOnlineUrl?: string;
  examId?: string | null;
}

export interface OmnichannelDispatchOptions {
  notification: OmnichannelNotificationPayload;
  matchedSubscribers?: MatchedSubscribersByChannel;
  enabledChannels?: Array<"web_push" | "telegram" | "whatsapp" | "email">;
  siteUrl?: string;
}

export interface ChannelDispatchReport {
  channel: "web_push" | "telegram" | "whatsapp" | "email";
  status: "success" | "partial_failure" | "failed" | "skipped";
  totalRecipients: number;
  successCount: number;
  failureCount: number;
  durationMs: number;
  errors?: string[];
}

export interface OmnichannelDispatchResult {
  notificationId: string;
  slug: string;
  success: boolean;
  totalCandidates: number;
  channelReports: Record<"web_push" | "telegram" | "whatsapp" | "email", ChannelDispatchReport>;
  overallDurationMs: number;
}

const ALL_CHANNELS: Array<"web_push" | "telegram" | "whatsapp" | "email"> = [
  "web_push",
  "telegram",
  "whatsapp",
  "email",
];

/**
 * Dispatches a published government exam notification across all candidate preferred channels.
 * Employs Promise.allSettled to guarantee that failures or timeouts on one channel (e.g. invalid WhatsApp token
 * or rate limits) never disrupt or cancel message transmission on the other channels.
 * 
 * @param {OmnichannelDispatchOptions} options Orchestrator options with notification data and recipients
 * @returns {Promise<OmnichannelDispatchResult>} Comprehensive telemetry report of delivery results
 */
export async function dispatchToAllChannels(
  options: OmnichannelDispatchOptions
): Promise<OmnichannelDispatchResult> {
  const startTime = Date.now();
  const { notification, enabledChannels = ALL_CHANNELS } = options;
  const siteUrl = options.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://upaguru.in";

  // 1. Resolve matching subscribers if not pre-supplied
  let subscribers = options.matchedSubscribers;
  if (!subscribers) {
    subscribers = await findMatchingSubscribersForNotification({
      examId: notification.examId,
      category: notification.category,
      stateOrCentral: notification.stateOrCentral,
    });
  }

  // 2. Parallel dispatch using Promise.allSettled
  const [fcmSettled, telegramSettled, whatsappSettled, emailSettled] = await Promise.allSettled([
    // Channel 1: Web Push (FCM)
    (async (): Promise<ChannelDispatchReport> => {
      const channelStart = Date.now();
      if (!enabledChannels.includes("web_push") || subscribers.fcmDeviceTokens.length === 0) {
        return {
          channel: "web_push",
          status: "skipped",
          totalRecipients: subscribers.fcmDeviceTokens.length,
          successCount: 0,
          failureCount: 0,
          durationMs: 0,
        };
      }

      const bodyText = notification.totalVacancies
        ? `${notification.totalVacancies.toLocaleString("en-IN")} Vacancies • ${notification.conductingBody || "Apply Now"}`
        : notification.conductingBody || "New government recruitment published";

      const res = await sendFcmPush({
        tokens: subscribers.fcmDeviceTokens,
        title: `📢 ${notification.title}`,
        body: bodyText,
        targetUrl: `${siteUrl}/notification/${notification.slug}`,
        notificationId: notification.id,
        slug: notification.slug,
        category: notification.category,
      });

      return {
        channel: "web_push",
        status: res.failureCount === 0 ? "success" : res.successCount > 0 ? "partial_failure" : "failed",
        totalRecipients: res.totalTokens,
        successCount: res.successCount,
        failureCount: res.failureCount,
        durationMs: Date.now() - channelStart,
        errors: res.errors.slice(0, 5).map((e) => e.error),
      };
    })(),

    // Channel 2: Telegram Bot Alert
    (async (): Promise<ChannelDispatchReport> => {
      const channelStart = Date.now();
      if (!enabledChannels.includes("telegram") || subscribers.telegramChatIds.length === 0) {
        return {
          channel: "telegram",
          status: "skipped",
          totalRecipients: subscribers.telegramChatIds.length,
          successCount: 0,
          failureCount: 0,
          durationMs: 0,
        };
      }

      const res = await sendTelegramBroadcast({
        chatIds: subscribers.telegramChatIds,
        notification: {
          id: notification.id,
          title: notification.title,
          slug: notification.slug,
          conductingBody: notification.conductingBody,
          totalVacancies: notification.totalVacancies,
          applicationEndDate: notification.applicationEndDate,
          category: notification.category,
          officialPdfUrl: notification.officialPdfUrl,
          applyOnlineUrl: notification.applyOnlineUrl,
        },
        siteUrl,
      });

      return {
        channel: "telegram",
        status: res.failureCount === 0 ? "success" : res.successCount > 0 ? "partial_failure" : "failed",
        totalRecipients: res.totalChats,
        successCount: res.successCount,
        failureCount: res.failureCount,
        durationMs: Date.now() - channelStart,
        errors: res.errors.slice(0, 5).map((e) => e.error),
      };
    })(),

    // Channel 3: WhatsApp Business Cloud API
    (async (): Promise<ChannelDispatchReport> => {
      const channelStart = Date.now();
      if (!enabledChannels.includes("whatsapp") || subscribers.whatsappPhoneNumbers.length === 0) {
        return {
          channel: "whatsapp",
          status: "skipped",
          totalRecipients: subscribers.whatsappPhoneNumbers.length,
          successCount: 0,
          failureCount: 0,
          durationMs: 0,
        };
      }

      const res = await sendWhatsAppBroadcast({
        phoneNumbers: subscribers.whatsappPhoneNumbers,
        notification: {
          id: notification.id,
          title: notification.title,
          slug: notification.slug,
          conductingBody: notification.conductingBody,
          totalVacancies: notification.totalVacancies,
          applicationEndDate: notification.applicationEndDate,
          category: notification.category,
          officialPdfUrl: notification.officialPdfUrl,
          applyOnlineUrl: notification.applyOnlineUrl,
        },
        siteUrl,
      });

      return {
        channel: "whatsapp",
        status: res.failureCount === 0 ? "success" : res.successCount > 0 ? "partial_failure" : "failed",
        totalRecipients: res.totalRecipients,
        successCount: res.successCount,
        failureCount: res.failureCount,
        durationMs: Date.now() - channelStart,
        errors: res.errors.slice(0, 5).map((e) => e.error),
      };
    })(),

    // Channel 4: Email Digest / Instant Alert (Resend)
    (async (): Promise<ChannelDispatchReport> => {
      const channelStart = Date.now();
      if (!enabledChannels.includes("email") || subscribers.emailRecipients.length === 0) {
        return {
          channel: "email",
          status: "skipped",
          totalRecipients: subscribers.emailRecipients.length,
          successCount: 0,
          failureCount: 0,
          durationMs: 0,
        };
      }

      const res = await sendEmailDigest({
        recipients: subscribers.emailRecipients,
        notifications: [
          {
            id: notification.id,
            title: notification.title,
            slug: notification.slug,
            conductingBody: notification.conductingBody,
            totalVacancies: notification.totalVacancies,
            applicationEndDate: notification.applicationEndDate,
            category: notification.category,
            officialPdfUrl: notification.officialPdfUrl,
            applyOnlineUrl: notification.applyOnlineUrl,
          },
        ],
        digestType: "instant",
        siteUrl,
      });

      return {
        channel: "email",
        status: res.failureCount === 0 ? "success" : res.successCount > 0 ? "partial_failure" : "failed",
        totalRecipients: res.totalRecipients,
        successCount: res.successCount,
        failureCount: res.failureCount,
        durationMs: Date.now() - channelStart,
        errors: res.errors.slice(0, 5).map((e) => e.error),
      };
    })(),
  ]);

  // 3. Helper to format settled outcome
  const formatReport = (
    channelName: "web_push" | "telegram" | "whatsapp" | "email",
    settled: PromiseSettledResult<ChannelDispatchReport>,
    fallbackCount: number
  ): ChannelDispatchReport => {
    if (settled.status === "fulfilled") {
      return settled.value;
    }
    return {
      channel: channelName,
      status: "failed",
      totalRecipients: fallbackCount,
      successCount: 0,
      failureCount: fallbackCount,
      durationMs: 0,
      errors: [settled.reason instanceof Error ? settled.reason.message : "Unhandled channel exception"],
    };
  };

  const channelReports: Record<"web_push" | "telegram" | "whatsapp" | "email", ChannelDispatchReport> = {
    web_push: formatReport("web_push", fcmSettled, subscribers.fcmDeviceTokens.length),
    telegram: formatReport("telegram", telegramSettled, subscribers.telegramChatIds.length),
    whatsapp: formatReport("whatsapp", whatsappSettled, subscribers.whatsappPhoneNumbers.length),
    email: formatReport("email", emailSettled, subscribers.emailRecipients.length),
  };

  const overallDurationMs = Date.now() - startTime;
  const overallSuccess = Object.values(channelReports).every(
    (report) => report.status === "success" || report.status === "skipped"
  );

  // 4. Asynchronously log telemetry to public.notification_dispatch_logs
  try {
    const supabaseAdmin = createAdminClient();
    const logEntries = Object.values(channelReports)
      .filter((report) => report.status !== "skipped")
      .map((report) => ({
        notification_id: notification.id,
        channel: report.channel,
        recipient_count: report.totalRecipients,
        success_count: report.successCount,
        failure_count: report.failureCount,
        status: report.status,
        duration_ms: report.durationMs,
        metadata: {
          slug: notification.slug,
          errors: report.errors,
        },
        created_at: new Date().toISOString(),
      }));

    if (logEntries.length > 0) {
      await supabaseAdmin.from("notification_dispatch_logs").insert(logEntries);
    }
  } catch (logErr) {
    console.warn("[OmnichannelOrchestrator] Telemetry logging notice:", logErr);
  }

  return {
    notificationId: notification.id,
    slug: notification.slug,
    success: overallSuccess,
    totalCandidates: subscribers.totalMatchedCandidates,
    channelReports,
    overallDurationMs,
  };
}
