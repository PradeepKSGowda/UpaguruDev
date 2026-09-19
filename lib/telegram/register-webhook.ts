/**
 * @file lib/telegram/register-webhook.ts
 * @module RegisterTelegramWebhook
 * @description Utility script to register or inspect the Telegram Bot API webhook URL.
 * 
 * Task ID: TASK-05030101 (Subtask: SUB-0503010101)
 */

import { setTelegramWebhook, getTelegramWebhookInfo } from "./bot";

/**
 * Configures the live webhook URL for Telegram Bot API.
 * 
 * @param {string} siteUrl Optional base site URL (defaults to process.env.NEXT_PUBLIC_SITE_URL)
 */
export async function configureWebhook(siteUrl?: string) {
  const base = siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://upaguru.in";
  const webhookUrl = `${base.replace(/\/$/, "")}/api/telegram/webhook`;

  console.info(`[TelegramWebhookConfig] Setting webhook URL: ${webhookUrl}`);
  const result = await setTelegramWebhook(webhookUrl);

  if (result.ok) {
    console.info("[TelegramWebhookConfig] Webhook registered successfully:", result.description);
  } else {
    console.error("[TelegramWebhookConfig] Webhook registration failed:", result.description);
  }

  const info = await getTelegramWebhookInfo();
  console.info("[TelegramWebhookConfig] Current webhook status:", info);
  return result;
}
