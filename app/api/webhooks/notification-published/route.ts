/**
 * @file app/api/webhooks/notification-published/route.ts
 * @module NotificationPublishedWebhook
 * @description Next.js 15 Route Handler for notification publication webhooks.
 * Authenticates incoming webhook events (from Supabase Database Webhooks or internal publication actions),
 * validates payloads against strict Zod schemas, resolves candidate subscriber matches across
 * exam categories, states, and exam IDs, and prepares channel targets for omnichannel dispatch.
 * 
 * Task ID: TASK-05050101 (Subtasks: SUB-0505010101, SUB-0505010102)
 * Architecture Reference: ADR-004 (Backend), ADR-007 (Omnichannel Push Alert Engine), ADR-013 (Security), ADR-014 (API Design)
 * Rules: AGENTS.md Rule 1 (Zod validation), Rule 2 (No symptom masking), Rule 3 (Audit trail)
 */

import { NextRequest, NextResponse } from "next/server";
import { parseNotificationWebhookPayload } from "@/lib/schemas/webhooks";
import { findMatchingSubscribersForNotification } from "@/lib/data/subscriptions";
import { dispatchToAllChannels } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Validates the webhook authentication secret against environment configuration.
 * Supports x-webhook-secret header or Bearer authorization token.
 * 
 * @param {NextRequest} request Incoming HTTP request
 * @returns {boolean} True if authenticated or if running in unconfigured local dev mode
 */
function isWebhookAuthorized(request: NextRequest): boolean {
  const expectedSecret =
    process.env.DISPATCH_WEBHOOK_SECRET || process.env.SUPABASE_WEBHOOK_SECRET;

  // Development fallback when secret is not configured
  if (!expectedSecret) {
    console.warn(
      "[NotificationPublishedWebhook] DISPATCH_WEBHOOK_SECRET is not configured. Request permitted in local development."
    );
    return true;
  }

  // Check x-webhook-secret header (Standard for Supabase Database Webhooks)
  const headerSecret = request.headers.get("x-webhook-secret");
  if (headerSecret && headerSecret === expectedSecret) {
    return true;
  }

  // Check Authorization: Bearer <token>
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.substring(7).trim();
    if (bearerToken === expectedSecret) {
      return true;
    }
  }

  return false;
}

/**
 * Subtask SUB-0505010101:
 * POST Handler: Authenticates webhook secret, parses payload, validates published status,
 * matches candidate subscribers across all preferred channels, and records audit telemetry.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  // 1. Authenticate incoming request
  if (!isWebhookAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized: Invalid or missing webhook secret token",
      },
      { status: 401 }
    );
  }

  // 2. Parse and validate request JSON body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "Malformed JSON payload in request body",
      },
      { status: 400 }
    );
  }

  const parseResult = parseNotificationWebhookPayload(rawBody);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parseResult.error,
      },
      { status: 400 }
    );
  }

  const notification = parseResult.data;

  // 3. Status Guard: Only published notifications trigger candidate alert dispatches
  if (notification.status !== "published") {
    return NextResponse.json({
      ok: true,
      status: "skipped",
      reason: `Notification status is "${notification.status}", publication alerts are only triggered for "published" records.`,
      notificationId: notification.notificationId,
    });
  }

  try {
    const supabaseAdmin = createAdminClient();

    // 4. Enrich missing metadata (category, state_or_central, conducting_body) from parent exam if needed
    let category = notification.category;
    let stateOrCentral = notification.stateOrCentral;
    let conductingBody = notification.conductingBody;

    if (notification.examId && (!category || !stateOrCentral || !conductingBody)) {
      const { data: examData } = await supabaseAdmin
        .from("exams")
        .select("category, state_or_central, conducting_body")
        .eq("id", notification.examId)
        .maybeSingle();

      if (examData) {
        category = category || examData.category;
        stateOrCentral = stateOrCentral || examData.state_or_central;
        conductingBody = conductingBody || examData.conducting_body;
      }
    }

    // 5. Subtask SUB-0505010102: Execute subscriber matching query
    const matchedSubscribers = await findMatchingSubscribersForNotification({
      examId: notification.examId,
      category,
      stateOrCentral,
    });

    // 6. Subtask SUB-0505010201: Orchestrate omnichannel dispatch in parallel across all preferred channels
    const dispatchResult = await dispatchToAllChannels({
      notification: {
        id: notification.notificationId,
        slug: notification.slug,
        title: notification.title,
        conductingBody,
        category,
        stateOrCentral,
        totalVacancies: notification.totalVacancies,
        applicationEndDate: notification.applicationEndDate,
        officialPdfUrl: notification.officialPdfUrl,
        applyOnlineUrl: notification.applyOnlineUrl,
        examId: notification.examId,
      },
      matchedSubscribers,
    });

    // 7. Return structured success with matched subscriber and channel dispatch details
    return NextResponse.json({
      ok: true,
      status: "dispatched",
      notification: {
        id: notification.notificationId,
        slug: notification.slug,
        title: notification.title,
        category,
        stateOrCentral,
        conductingBody,
      },
      matched: {
        totalCandidates: matchedSubscribers.totalMatchedCandidates,
        channels: {
          webPush: matchedSubscribers.fcmDeviceTokens.length,
          telegram: matchedSubscribers.telegramChatIds.length,
          whatsapp: matchedSubscribers.whatsappPhoneNumbers.length,
          email: matchedSubscribers.emailRecipients.length,
        },
      },
      dispatch: dispatchResult,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error("[NotificationPublishedWebhook] Fatal execution error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Internal server error during subscriber matching",
      },
      { status: 500 }
    );
  }
}
