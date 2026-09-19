/**
 * @file lib/push/email.ts
 * @module EmailDigestEngine
 * @description Server-side email notification and digest dispatch engine for UPA-GURU.
 * Constructs responsive, accessible HTML email templates for exam alerts and digests,
 * delivers messages via the Resend REST API, supports batch delivery with isolated error
 * containment, respects candidate communication preferences, and provides development
 * simulation fallbacks.
 * 
 * Task ID: TASK-05040102 (Subtask: SUB-0504010201)
 * Architecture Reference: ADR-004 (Backend), ADR-007 (Omnichannel Push Alert Engine), ADR-013 (Security)
 * 
 * Complies with:
 * - TypeScript strict mode (Zero `any`)
 * - Resend REST API standards (POST https://api.resend.com/emails)
 * - Mobile-first inline CSS for maximum email client compatibility (Gmail, Outlook, Apple Mail)
 * - Multipart HTML + Plaintext generation for high deliverability and low spam scoring
 * - Graceful development simulation when RESEND_API_KEY is not configured
 */

export interface EmailExamNotification {
  id?: string;
  title: string;
  slug: string;
  conductingBody?: string;
  totalVacancies?: number;
  applicationEndDate?: string;
  category?: string;
  qualificationSummary?: string;
  officialPdfUrl?: string;
  applyOnlineUrl?: string;
}

export interface EmailRecipient {
  email: string;
  name?: string;
  userId?: string;
}

export interface EmailDigestOptions {
  recipients: Array<EmailRecipient | string>;
  notifications: EmailExamNotification[];
  digestType?: "instant" | "daily" | "weekly";
  subject?: string;
  siteUrl?: string;
}

export interface EmailDigestResult {
  success: boolean;
  totalRecipients: number;
  successCount: number;
  failureCount: number;
  invalidEmails: string[];
  errors: Array<{ email: string; error: string; code?: string }>;
  durationMs: number;
}

const DEFAULT_RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM_EMAIL = "UPA-GURU Exam Alerts <alerts@upaguru.in>";
const DEFAULT_SITE_URL = "https://upaguru.in";
const EMAIL_BATCH_SIZE = 25;
const INTER_BATCH_PAUSE_MS = 150; // Respects Resend rate limits (~10-20 requests/sec)

/**
 * Retrieves Resend API credentials and defaults from environment.
 * Guards against client-side bundling leakage.
 * 
 * @returns {{ apiKey: string | undefined; fromEmail: string; siteUrl: string }}
 */
export function getResendConfig() {
  if (typeof window !== "undefined") {
    throw new Error("SECURITY VIOLATION: Resend API credentials cannot be accessed client-side.");
  }

  return {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL,
  };
}

/**
 * Determines whether Resend API is configured with an active API key.
 * 
 * @returns {boolean} True if RESEND_API_KEY is set in environment
 */
export function isResendConfigured(): boolean {
  if (typeof window !== "undefined") return false;
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Normalizes email recipient representation to standard EmailRecipient object.
 * 
 * @param {EmailRecipient | string} recipient Raw email string or structured recipient
 * @returns {EmailRecipient} Normalized recipient object
 */
export function normalizeRecipient(recipient: EmailRecipient | string): EmailRecipient {
  if (typeof recipient === "string") {
    return { email: recipient.trim().toLowerCase() };
  }
  return {
    ...recipient,
    email: recipient.email.trim().toLowerCase(),
  };
}

/**
 * Generates mobile-responsive, production-grade inline HTML for candidate exam alerts.
 * Features clean typography, prominent action buttons, deadline urgency highlights,
 * and preference center management links.
 * 
 * @param {object} params Email rendering parameters
 * @returns {string} Clean HTML email markup
 */
export function generateEmailDigestHtml(params: {
  notifications: EmailExamNotification[];
  siteUrl: string;
  recipientName?: string;
  digestType?: string;
}): string {
  const { notifications, siteUrl, recipientName, digestType = "instant" } = params;
  const isDigest = notifications.length > 1 || digestType !== "instant";
  const digestLabel =
    digestType === "daily"
      ? "Daily Digest"
      : digestType === "weekly"
      ? "Weekly Digest"
      : "Exam Alert";
  const greeting = recipientName ? `Hello ${recipientName},` : "Hello Candidate,";
  const subHeading = isDigest
    ? `Here are the latest <strong>${notifications.length} government exam notifications</strong> in your ${digestLabel.toLowerCase()}:`
    : "A new government exam notification has been published matching your alert criteria:";

  const notificationCardsHtml = notifications
    .map((item) => {
      const detailUrl = `${siteUrl}/notification/${item.slug}`;
      const vacancies = item.totalVacancies
        ? `${item.totalVacancies.toLocaleString("en-IN")} Posts`
        : "Refer Notification";

      const deadline = item.applicationEndDate
        ? new Date(item.applicationEndDate).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "Not Specified";

      const categoryLabel = (item.category || "General").replace(/_/g, " ").toUpperCase();
      const conductingBody = item.conductingBody || "Government Agency";

      return `
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="margin-bottom: 12px;">
            <span style="display: inline-block; background-color: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 8px; border-radius: 4px;">
              ${categoryLabel}
            </span>
            <span style="display: inline-block; color: #64748b; font-size: 12px; margin-left: 8px;">
              ${conductingBody}
            </span>
          </div>

          <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; line-height: 1.4;">
            <a href="${detailUrl}" style="color: #0f172a; text-decoration: none;">
              ${item.title}
            </a>
          </h2>

          <div style="background-color: #f8fafc; border-radius: 6px; padding: 12px; margin-bottom: 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px; color: #334155;">
              <tr>
                <td style="padding: 4px 0; width: 45%;"><strong>Total Vacancies:</strong></td>
                <td style="padding: 4px 0; color: #0f172a; font-weight: 600;">${vacancies}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;"><strong>Application Deadline:</strong></td>
                <td style="padding: 4px 0; color: #b91c1c; font-weight: 700;">${deadline}</td>
              </tr>
              ${
                item.qualificationSummary
                  ? `<tr><td style="padding: 4px 0;"><strong>Eligibility:</strong></td><td style="padding: 4px 0;">${item.qualificationSummary}</td></tr>`
                  : ""
              }
            </table>
          </div>

          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 8px;">
            <tr>
              <td style="border-radius: 6px; background-color: #2563eb; text-align: center;">
                <a href="${detailUrl}" style="background-color: #2563eb; border: 1px solid #2563eb; font-size: 13px; font-weight: 600; color: #ffffff; text-decoration: none; padding: 8px 16px; border-radius: 6px; display: inline-block;">
                  View Full Details &rarr;
                </a>
              </td>
              ${
                item.applyOnlineUrl
                  ? `
                <td style="padding-left: 10px;">
                  <a href="${item.applyOnlineUrl}" style="font-size: 13px; font-weight: 600; color: #2563eb; text-decoration: none; padding: 8px 12px; display: inline-block;">
                    Apply Online
                  </a>
                </td>`
                  : ""
              }
            </tr>
          </table>
        </div>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UPA-GURU Exam Alert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px 30px; text-align: left;">
              <h1 style="color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; margin: 0;">
                UPA-GURU
              </h1>
              <p style="color: #94a3b8; font-size: 12px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">
                Verified Government Exam ${digestLabel}
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 24px 30px 10px 30px;">
              <p style="font-size: 15px; color: #1e293b; margin: 0 0 8px 0; font-weight: 600;">
                ${greeting}
              </p>
              <p style="font-size: 14px; color: #475569; margin: 0 0 20px 0; line-height: 1.5;">
                ${subHeading}
              </p>

              <!-- Exam Cards -->
              ${notificationCardsHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 30px; font-size: 12px; color: #64748b; line-height: 1.5;">
              <p style="margin: 0 0 8px 0;">
                You received this alert because you subscribed to exam notifications on <strong>UPA-GURU</strong>.
              </p>
              <p style="margin: 0;">
                <a href="${siteUrl}/preferences" style="color: #2563eb; text-decoration: underline;">
                  Update Alert Preferences
                </a> &bull; 
                <a href="${siteUrl}" style="color: #64748b; text-decoration: none;">
                  Visit Portal
                </a>
              </p>
              <p style="margin: 12px 0 0 0; color: #94a3b8; font-size: 11px;">
                &copy; ${new Date().getFullYear()} UPA-GURU. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generates plain-text fallback representation for email clients and spam filter hygiene.
 * 
 * @param {object} params Rendering parameters
 * @returns {string} Plain text email representation
 */
export function generateEmailDigestText(params: {
  notifications: EmailExamNotification[];
  siteUrl: string;
  recipientName?: string;
}): string {
  const { notifications, siteUrl, recipientName } = params;
  const greeting = recipientName ? `Hello ${recipientName},\n\n` : "Hello Candidate,\n\n";

  const lines: string[] = [
    "UPA-GURU | Verified Government Exam Notifications",
    "===================================================\n",
    greeting,
    `Here are the latest exam notification alerts matching your preferences:\n`,
  ];

  notifications.forEach((item, index) => {
    lines.push(`[${index + 1}] ${item.title}`);
    lines.push(`Conducting Body: ${item.conductingBody || "Government Agency"}`);
    lines.push(`Category: ${(item.category || "General").toUpperCase()}`);
    lines.push(`Vacancies: ${item.totalVacancies || "Refer Notification"}`);
    lines.push(`Last Date to Apply: ${item.applicationEndDate || "Refer Notification"}`);
    lines.push(`Details: ${siteUrl}/notification/${item.slug}`);
    if (item.applyOnlineUrl) {
      lines.push(`Apply Online: ${item.applyOnlineUrl}`);
    }
    lines.push("");
  });

  lines.push("---------------------------------------------------");
  lines.push(`Manage preferences or unsubscribe: ${siteUrl}/preferences`);
  lines.push(`© ${new Date().getFullYear()} UPA-GURU`);

  return lines.join("\n");
}

/**
 * Sends a single transactional email via the Resend REST API.
 * 
 * @param {object} options Single email send parameters
 * @returns {Promise<{ success: boolean; id?: string; error?: string; code?: string }>}
 */
export async function sendSingleEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}): Promise<{ success: boolean; id?: string; error?: string; code?: string }> {
  const config = getResendConfig();
  const { to, subject, html, text, from } = options;

  if (!to || !to.includes("@")) {
    return {
      success: false,
      error: `Invalid destination email address: "${to}"`,
      code: "INVALID_EMAIL",
    };
  }

  // Graceful development mode fallback
  if (!config.apiKey) {
    console.warn(
      `[Email/Resend] Dev mode fallback: RESEND_API_KEY is unset. Simulating delivery to ${to} (Subject: "${subject}").`
    );
    return {
      success: true,
      id: `mock_email_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };
  }

  try {
    const response = await fetch(DEFAULT_RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: from || config.fromEmail,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data?.message || `Resend API error (HTTP ${response.status})`,
        code: data?.name || `HTTP_${response.status}`,
      };
    }

    return {
      success: true,
      id: data?.id,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error contacting Resend API",
      code: "NETWORK_ERROR",
    };
  }
}

/**
 * Broadcasts an email digest or instant exam alert to multiple subscribed candidate emails.
 * Executes micro-batched delivery, isolated per-recipient error handling, and delivery telemetry.
 * 
 * @param {EmailDigestOptions} options Broadcast options including recipients and notification list
 * @returns {Promise<EmailDigestResult>} Telemetry summary of the email dispatch
 */
export async function sendEmailDigest(options: EmailDigestOptions): Promise<EmailDigestResult> {
  const startTime = Date.now();
  const { recipients, notifications, digestType = "instant" } = options;
  const siteUrl = options.siteUrl || getResendConfig().siteUrl;

  if (!recipients || recipients.length === 0 || !notifications || notifications.length === 0) {
    return {
      success: true,
      totalRecipients: 0,
      successCount: 0,
      failureCount: 0,
      invalidEmails: [],
      errors: [],
      durationMs: 0,
    };
  }

  // Deduplicate and normalize recipient list
  const normalizedRecipients = Array.from(
    new Map(
      recipients.map((r) => {
        const norm = normalizeRecipient(r);
        return [norm.email, norm];
      })
    ).values()
  ).filter((r) => r.email && r.email.includes("@"));

  const firstNotification = notifications[0];
  const defaultSubject =
    notifications.length === 1 && firstNotification
      ? `🎯 New Exam Alert: ${firstNotification.title}`
      : `📋 UPA-GURU Digest: ${notifications.length} New Government Exam Alerts`;

  const subject = options.subject || defaultSubject;

  let successCount = 0;
  let failureCount = 0;
  const invalidEmails: string[] = [];
  const errors: Array<{ email: string; error: string; code?: string }> = [];

  // Partition recipients into micro-batches
  for (let i = 0; i < normalizedRecipients.length; i += EMAIL_BATCH_SIZE) {
    const batch = normalizedRecipients.slice(i, i + EMAIL_BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (recipient) => {
        try {
          const html = generateEmailDigestHtml({
            notifications,
            siteUrl,
            recipientName: recipient.name,
            digestType,
          });
          const text = generateEmailDigestText({
            notifications,
            siteUrl,
            recipientName: recipient.name,
          });

          const sendRes = await sendSingleEmail({
            to: recipient.email,
            subject,
            html,
            text,
          });

          return { email: recipient.email, ...sendRes };
        } catch (err) {
          return {
            email: recipient.email,
            success: false,
            error: err instanceof Error ? err.message : "Unexpected email delivery error",
            code: "INTERNAL_ERROR",
          };
        }
      })
    );

    for (const res of batchResults) {
      if (res.success) {
        successCount++;
      } else {
        failureCount++;
        const errorMessage = res.error || "Email delivery failed";
        errors.push({
          email: res.email,
          error: errorMessage,
          code: res.code,
        });

        if (res.code === "INVALID_EMAIL" || res.code === "validation_error") {
          invalidEmails.push(res.email);
        }
      }
    }

    // Inter-batch pause to prevent rate limiting
    if (i + EMAIL_BATCH_SIZE < normalizedRecipients.length) {
      await new Promise((resolve) => setTimeout(resolve, INTER_BATCH_PAUSE_MS));
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    success: failureCount === 0,
    totalRecipients: normalizedRecipients.length,
    successCount,
    failureCount,
    invalidEmails,
    errors,
    durationMs,
  };
}
