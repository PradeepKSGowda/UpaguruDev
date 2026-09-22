/**
 * @file app/api/telegram/webhook/route.ts
 * @module TelegramWebhookHandler
 * @description Next.js 15 Route Handler for Telegram Bot API webhook events.
 * Authenticates incoming updates, processes /start command deep-linking, links Telegram
 * chat IDs to candidate profiles, and responds with interactive inline keyboards.
 * 
 * Task ID: TASK-05030101 (Subtasks: SUB-0503010101, SUB-0503010102)
 * Architecture Reference: ADR-004 (Backend), ADR-007 (Omnichannel Alerts), ADR-013 (Security), ADR-014 (API Design)
 * 
 * Complies with:
 * - Next.js 15 App Router Route Handler standards
 * - Secret token header verification (x-telegram-bot-api-secret-token)
 * - Elevated service-role database operations via createAdminClient()
 * - Deep-link user binding (/start link_<userId>)
 */

import { NextRequest, NextResponse } from "next/server";
import { getTelegramWebhookSecret, sendTelegramMessage } from "@/lib/telegram/bot";
import type { TelegramUpdate } from "@/lib/telegram/types";
import { createAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Handles incoming Telegram Bot API webhook updates.
 */
export async function POST(request: NextRequest) {
  // 1. Security Header Verification
  const expectedSecret = getTelegramWebhookSecret();
  if (expectedSecret) {
    const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token");
    if (receivedSecret !== expectedSecret) {
      console.warn("[TelegramWebhook] Unauthorized update attempt: Invalid secret token.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // 2. Parse Telegram Update Payload
  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch (err) {
    console.error("[TelegramWebhook] Failed to parse request JSON:", err);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = update.message;
  if (!message || !message.text) {
    // Acknowledge non-text updates (e.g. status changes, pin messages)
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const text = message.text.trim();
  const senderName = message.from?.first_name || "Candidate";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://upaguru.in";

  // 3. Command Routing
  if (text.startsWith("/start")) {
    const parts = text.split(" ");
    const startPayload = parts.length > 1 ? (parts[1]?.trim() ?? "") : "";

    // Check if /start was invoked via a deep-link: /start link_<userId> or /start <userId>
    let boundUserId: string | null = null;
    if (startPayload.startsWith("link_")) {
      boundUserId = startPayload.replace("link_", "");
    } else if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(startPayload)
    ) {
      boundUserId = startPayload;
    }

    if (boundUserId) {
      // Bind Telegram Chat ID to the candidate's account
      try {
        const supabase = createAdminClient();
        const { data: existingSub } = await supabase
          .from("user_subscriptions")
          .select("id, preferred_channels")
          .eq("user_id", boundUserId)
          .maybeSingle();

        if (existingSub) {
          const channels = existingSub.preferred_channels || [];
          const updatedChannels = Array.from(new Set([...channels, "telegram"]));

          await supabase
            .from("user_subscriptions")
            .update({
              telegram_chat_id: chatId,
              preferred_channels: updatedChannels,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingSub.id);

          await sendTelegramMessage({
            chat_id: chatId,
            text:
              `🎉 <b>Account Linked Successfully!</b>\n\n` +
              `Hello <b>${senderName}</b>, your Telegram account is now connected to UPA-GURU.\n\n` +
              `✅ <b>Instant Recruitment Alerts:</b> ACTIVE\n` +
              `🎯 You will receive instant notifications here as soon as new official exams and admit cards are released matching your preferences.`,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "⚙️ Manage Preferences",
                    url: `${siteUrl}/preferences`,
                  },
                ],
              ],
            },
          });

          return NextResponse.json({ ok: true });
        }
      } catch (bindErr) {
        console.error("[TelegramWebhook] Error binding user via deep link:", bindErr);
      }
    }

    // Standard /start Welcome Message
    await sendTelegramMessage({
      chat_id: chatId,
      text:
        `👋 <b>Welcome to UPA-GURU Exam Intelligence!</b>\n\n` +
        `I am the official notification bot for pan-India competitive exams (UPSC, State PSCs, Banking, Railways, Defence).\n\n` +
        `🔑 <b>Your Telegram Chat ID:</b>\n<code>${chatId}</code>\n\n` +
        `<b>To activate instant alerts:</b>\n` +
        `1. Copy your Chat ID above.\n` +
        `2. Go to your UPA-GURU Alert Preferences.\n` +
        `3. Enable <b>Telegram Bot Direct Alerts</b> and paste this Chat ID.`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🔔 Open Alert Preferences",
              url: `${siteUrl}/preferences`,
            },
          ],
          [
            {
              text: "🌐 Browse Live Exams",
              url: `${siteUrl}/`,
            },
          ],
        ],
      },
    });

    return NextResponse.json({ ok: true });
  }

  // 4. Status Command (/status)
  if (text === "/status") {
    try {
      const supabase = createAdminClient();
      const { data: subscription } = await supabase
        .from("user_subscriptions")
        .select("subscribed_categories, subscribed_states, preferred_channels")
        .eq("telegram_chat_id", chatId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscription) {
        const categories = (subscription.subscribed_categories || []).join(", ") || "All Categories";
        const states = (subscription.subscribed_states || []).join(", ") || "All States";

        await sendTelegramMessage({
          chat_id: chatId,
          text:
            `📊 <b>Your Alert Subscription Status</b>\n\n` +
            `• <b>Status:</b> Active 🟢\n` +
            `• <b>Target Categories:</b> ${categories}\n` +
            `• <b>Jurisdictions:</b> ${states}\n` +
            `• <b>Active Channels:</b> ${(subscription.preferred_channels || []).join(", ")}`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "✏️ Modify Preferences", url: `${siteUrl}/preferences` }],
            ],
          },
        });
      } else {
        await sendTelegramMessage({
          chat_id: chatId,
          text:
            `ℹ️ <b>Chat ID Not Linked</b>\n\n` +
            `This chat (<code>${chatId}</code>) is not yet attached to an active subscription profile.\n` +
            `Please copy your Chat ID and add it in your account preferences.`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔔 Open Preferences", url: `${siteUrl}/preferences` }],
            ],
          },
        });
      }
    } catch (statusErr) {
      console.error("[TelegramWebhook] Error querying status:", statusErr);
    }

    return NextResponse.json({ ok: true });
  }

  // 5. Unsubscribe Command (/stop)
  if (text === "/stop" || text === "/unsubscribe") {
    try {
      const supabase = createAdminClient();
      await supabase
        .from("user_subscriptions")
        .update({
          telegram_chat_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("telegram_chat_id", chatId);

      await sendTelegramMessage({
        chat_id: chatId,
        text:
          `🛑 <b>Alerts Paused</b>\n\n` +
          `You have been unsubscribed from Telegram exam alerts.\n` +
          `You can re-enable alerts anytime by typing /start or updating your preferences on the portal.`,
        parse_mode: "HTML",
      });
    } catch (stopErr) {
      console.error("[TelegramWebhook] Error in /stop command:", stopErr);
    }

    return NextResponse.json({ ok: true });
  }

  // 6. Help / Fallback (/help)
  await sendTelegramMessage({
    chat_id: chatId,
    text:
      `ℹ️ <b>UPA-GURU Bot Commands</b>\n\n` +
      `• /start - Get your Chat ID or re-activate alerts\n` +
      `• /status - Check active exam categories and states\n` +
      `• /stop - Pause Telegram alerts\n` +
      `• /help - View command instructions\n\n` +
      `Visit <a href="${siteUrl}">upa-guru.in</a> for the full pan-India exam intelligence catalog.`,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });

  return NextResponse.json({ ok: true });
}
