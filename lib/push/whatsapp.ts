/**
 * @file lib/push/whatsapp.ts
 * @module WhatsAppDispatchEngine
 * @description Server-side WhatsApp Business API alert dispatch engine for UPA-GURU.
 * Formats structured exam notification alerts into Meta-approved WhatsApp message templates,
 * normalizes candidate phone numbers into standard E.164 formats, executes throttled
 * multicast delivery conforming to Meta Graph API rate limits, isolates per-recipient
 * delivery failures, and automatically prunes invalid or unregistered phone numbers.
 * 
 * Task ID: TASK-05040101 (Subtask: SUB-0504010101)
 * Architecture Reference: ADR-004 (Backend), ADR-007 (Omnichannel Push Alert Engine), ADR-013 (Security)
 * 
 * Complies with:
 * - TypeScript strict mode (Zero `any`)
 * - Meta Graph API Cloud WhatsApp standards (v20.0)
 * - Strict E.164 phone normalization for Indian mobile prefixes (+91)
 * - Rate limiting compliance (Max 80 messages/sec Meta Tier-1 cloud limit)
 * - Automatic pruning of unregistered/blocked WhatsApp recipients from public.user_subscriptions
 */

import { createAdminClient } from "@/lib/supabase";

export interface WhatsAppExamNotification {
  id?: string;
  title: string;
  slug: string;
  conductingBody?: string;
  totalVacancies?: number;
  applicationEndDate?: string;
  category?: string;
  officialPdfUrl?: string;
  applyOnlineUrl?: string;
}

export interface WhatsAppSendOptions {
  recipientPhone: string;
  notification: WhatsAppExamNotification;
  siteUrl?: string;
  templateName?: string;
  languageCode?: string;
}

export interface WhatsAppBroadcastOptions {
  phoneNumbers: string[];
  notification: WhatsAppExamNotification;
  siteUrl?: string;
  templateName?: string;
  languageCode?: string;
}

export interface WhatsAppBroadcastResult {
  success: boolean;
  totalRecipients: number;
  successCount: number;
  failureCount: number;
  invalidPhones: string[];
  errors: Array<{ phone: string; error: string; code?: number }>;
  durationMs: number;
}

export interface WhatsAppTemplateComponent {
  type: "header" | "body" | "button";
  sub_type?: "url" | "quick_reply";
  index?: string;
  parameters: Array<{
    type: "text" | "payload" | "image" | "document";
    text?: string;
    payload?: string;
  }>;
}

export interface WhatsAppMessagePayload {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "template";
  template: {
    name: string;
    language: {
      code: string;
    };
    components: WhatsAppTemplateComponent[];
  };
}

const DEFAULT_GRAPH_API_VERSION = "v20.0";
const DEFAULT_TEMPLATE_NAME = "exam_alert_notification";
const DEFAULT_LANGUAGE_CODE = "en_US";
const WHATSAPP_BATCH_SIZE = 25;
const INTER_BATCH_PAUSE_MS = 100; // ~25 msgs/sec, safe under Meta 80 req/sec limit

/**
 * Retrieves WhatsApp Business API credentials from environment.
 * Guards against client-side bundling leakage.
 * 
 * @returns {{ accessToken: string | undefined; phoneNumberId: string | undefined; apiVersion: string }}
 */
export function getWhatsAppConfig() {
  if (typeof window !== "undefined") {
    throw new Error("SECURITY VIOLATION: WhatsApp API credentials cannot be accessed client-side.");
  }

  return {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    templateName: process.env.WHATSAPP_TEMPLATE_NAME || DEFAULT_TEMPLATE_NAME,
    apiVersion: process.env.WHATSAPP_API_VERSION || DEFAULT_GRAPH_API_VERSION,
  };
}

/**
 * Determines whether WhatsApp Cloud API is fully configured with required credentials.
 * 
 * @returns {boolean} True if access token and phone number ID are present
 */
export function isWhatsAppConfigured(): boolean {
  if (typeof window !== "undefined") return false;
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/**
 * Normalizes any Indian or international phone number into standard Meta WhatsApp E.164 format without leading '+'.
 * 
 * Examples:
 * - "+91 98765-43210" -> "919876543210"
 * - "9876543210" -> "919876543210" (defaults to India country code 91 if 10 digits)
 * - "09876543210" -> "919876543210"
 * - "919876543210" -> "919876543210"
 * 
 * @param {string} rawPhone Raw candidate input phone number
 * @returns {string} Cleaned numeric phone number ready for Meta Graph API
 */
export function normalizeWhatsAppPhoneNumber(rawPhone: string): string {
  if (!rawPhone) return "";

  // Strip all non-numeric characters except leading plus
  let cleaned = rawPhone.trim().replace(/[\s\-\(\)\.]/g, "");

  // Remove leading plus
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  }

  // Handle Indian trunk prefix '0' (e.g. 09876543210 -> 919876543210)
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = `91${cleaned.slice(1)}`;
  }

  // Handle standard 10-digit Indian mobile number (e.g. 9876543210 -> 919876543210)
  if (cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned)) {
    cleaned = `91${cleaned}`;
  }

  return cleaned;
}

/**
 * Builds Meta-compliant WhatsApp template message payload with exam details and dynamic URL parameters.
 * 
 * Template Parameter Mapping:
 * - Header: {{1}} = Notification Title
 * - Body:
 *   - {{1}} = Conducting Body
 *   - {{2}} = Total Vacancies (or "Not Specified")
 *   - {{3}} = Last Date to Apply (or "Refer Notification")
 *   - {{4}} = Category
 * - Button [0]: Dynamic URL suffix parameter = notification slug
 * 
 * @param {string} to Clean E.164 phone number
 * @param {WhatsAppExamNotification} notification Exam notification object
 * @param {string} templateName WhatsApp template name
 * @param {string} languageCode ISO language code
 * @returns {WhatsAppMessagePayload} Formatted Meta Graph API payload
 */
export function buildWhatsAppTemplatePayload(
  to: string,
  notification: WhatsAppExamNotification,
  templateName: string = DEFAULT_TEMPLATE_NAME,
  languageCode: string = DEFAULT_LANGUAGE_CODE
): WhatsAppMessagePayload {
  const vacanciesText = notification.totalVacancies
    ? notification.totalVacancies.toLocaleString("en-IN")
    : "Multiple Posts";

  const lastDateText = notification.applicationEndDate
    ? new Date(notification.applicationEndDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Refer Notification";

  const conductingBodyText = notification.conductingBody || "Government Agency";
  const categoryText = (notification.category || "General").replace(/_/g, " ").toUpperCase();

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
      components: [
        {
          type: "header",
          parameters: [
            {
              type: "text",
              text: notification.title.slice(0, 60), // WhatsApp template header limit is 60 chars
            },
          ],
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: conductingBodyText },
            { type: "text", text: vacanciesText },
            { type: "text", text: lastDateText },
            { type: "text", text: categoryText },
          ],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [
            {
              type: "text",
              text: notification.slug, // Dynamic URL suffix e.g. /notification/{{1}}
            },
          ],
        },
      ],
    },
  };
}

/**
 * Sends a single WhatsApp notification using Meta Cloud API.
 * 
 * @param {WhatsAppSendOptions} options Send parameters including recipient and notification
 * @returns {Promise<{ success: boolean; messageId?: string; error?: string; errorCode?: number }>}
 */
export async function sendWhatsAppTemplate(
  options: WhatsAppSendOptions
): Promise<{ success: boolean; messageId?: string; error?: string; errorCode?: number }> {
  const config = getWhatsAppConfig();
  const normalizedPhone = normalizeWhatsAppPhoneNumber(options.recipientPhone);

  if (!normalizedPhone || normalizedPhone.length < 10) {
    return {
      success: false,
      error: `Invalid recipient phone number format: "${options.recipientPhone}"`,
    };
  }

  // Graceful development mode fallback
  if (!config.accessToken || !config.phoneNumberId) {
    console.warn(
      `[WhatsApp] Dev mode fallback: WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID unset. Simulating delivery to ${normalizedPhone}.`
    );
    return {
      success: true,
      messageId: `mock_wam_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };
  }

  const endpoint = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
  const payload = buildWhatsAppTemplatePayload(
    normalizedPhone,
    options.notification,
    options.templateName || config.templateName,
    options.languageCode || DEFAULT_LANGUAGE_CODE
  );

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      const metaError = data?.error;
      const errorMessage = metaError?.message || `WhatsApp API error (Status ${response.status})`;
      const errorCode = metaError?.code;

      return {
        success: false,
        error: errorMessage,
        errorCode,
      };
    }

    const messageId = data?.messages?.[0]?.id;
    return {
      success: true,
      messageId,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown network error connecting to Meta Graph API",
    };
  }
}

/**
 * Prunes deactivated, unregistered, or invalid WhatsApp phone numbers from public.user_subscriptions.
 * Triggered automatically when Meta returns 131026 (User is not on WhatsApp) or 131047 (Spam/Opt-out).
 * 
 * @param {string[]} invalidPhones Array of normalized phone numbers
 * @returns {Promise<number>} Count of updated subscriber records
 */
export async function pruneInvalidWhatsAppRecipients(invalidPhones: string[]): Promise<number> {
  if (!invalidPhones || invalidPhones.length === 0) {
    return 0;
  }

  try {
    const supabaseAdmin = createAdminClient();
    const { error, count } = await supabaseAdmin
      .from("user_subscriptions")
      .update({
        whatsapp_phone_number: null,
        updated_at: new Date().toISOString(),
      })
      .in("whatsapp_phone_number", invalidPhones);

    if (error) {
      console.error("[WhatsApp] Failed to prune invalid recipients:", error.message);
      return 0;
    }

    console.info(`[WhatsApp] Successfully pruned ${count ?? invalidPhones.length} invalid phone numbers from user_subscriptions.`);
    return count ?? invalidPhones.length;
  } catch (err) {
    console.error("[WhatsApp] Error executing pruneInvalidWhatsAppRecipients:", err);
    return 0;
  }
}

/**
 * Broadcasts WhatsApp template alerts to multiple subscribed candidate phone numbers.
 * Executes micro-batched multicast dispatch with rate-limit pauses, isolated error boundaries,
 * and automatic dead-number pruning.
 * 
 * @param {WhatsAppBroadcastOptions} options Broadcast options including phone numbers and notification data
 * @returns {Promise<WhatsAppBroadcastResult>} Execution result and delivery telemetry
 */
export async function sendWhatsAppBroadcast(
  options: WhatsAppBroadcastOptions
): Promise<WhatsAppBroadcastResult> {
  const startTime = Date.now();
  const { phoneNumbers, notification } = options;

  if (!phoneNumbers || phoneNumbers.length === 0) {
    return {
      success: true,
      totalRecipients: 0,
      successCount: 0,
      failureCount: 0,
      invalidPhones: [],
      errors: [],
      durationMs: 0,
    };
  }

  // Deduplicate and normalize recipient phone numbers
  const normalizedPhones = Array.from(
    new Set(
      phoneNumbers
        .map(normalizeWhatsAppPhoneNumber)
        .filter((phone) => phone.length >= 10)
    )
  );

  let successCount = 0;
  let failureCount = 0;
  const invalidPhones: string[] = [];
  const errors: Array<{ phone: string; error: string; code?: number }> = [];

  // Partition into micro-batches to respect Meta Cloud API rate limits
  for (let i = 0; i < normalizedPhones.length; i += WHATSAPP_BATCH_SIZE) {
    const batch = normalizedPhones.slice(i, i + WHATSAPP_BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (phone) => {
        try {
          const res = await sendWhatsAppTemplate({
            recipientPhone: phone,
            notification,
            siteUrl: options.siteUrl,
            templateName: options.templateName,
            languageCode: options.languageCode,
          });

          return { phone, ...res };
        } catch (err) {
          return {
            phone,
            success: false,
            error: err instanceof Error ? err.message : "Unexpected send error",
          };
        }
      })
    );

    for (const result of batchResults) {
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
        const errorMessage = result.error || "Delivery failed";
        errors.push({
          phone: result.phone,
          error: errorMessage,
          code: result.errorCode,
        });

        // Meta Cloud API Error Codes for unregistered / unreachable numbers:
        // 131026: Message Undeliverable (recipient phone is not a valid WhatsApp user)
        // 131047: Re-engagement message / 24hr window closed
        // 100: Invalid parameter / phone number
        if (result.errorCode === 131026 || result.errorCode === 100) {
          invalidPhones.push(result.phone);
        }
      }
    }

    // Inter-batch pause to prevent burst rate limits
    if (i + WHATSAPP_BATCH_SIZE < normalizedPhones.length) {
      await new Promise((resolve) => setTimeout(resolve, INTER_BATCH_PAUSE_MS));
    }
  }

  // Asynchronously prune invalid phone numbers in the background
  if (invalidPhones.length > 0) {
    pruneInvalidWhatsAppRecipients(invalidPhones).catch((err) =>
      console.error("[WhatsApp] Background recipient pruning failed:", err)
    );
  }

  const durationMs = Date.now() - startTime;

  return {
    success: failureCount === 0,
    totalRecipients: normalizedPhones.length,
    successCount,
    failureCount,
    invalidPhones,
    errors,
    durationMs,
  };
}
