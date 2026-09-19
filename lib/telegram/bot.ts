/**
 * @file lib/telegram/bot.ts
 * @module TelegramBotHelper
 * @description Core Telegram Bot API client for dispatching messages, setting webhook URLs,
 * and managing bot lifecycle endpoints.
 * 
 * Task ID: TASK-05030101 (Subtask: SUB-0503010101)
 * Architecture Reference: ADR-004 (Backend), ADR-007 (Omnichannel Push Alert Engine), ADR-013 (Security)
 * 
 * Complies with:
 * - Zero external dependencies (uses native fetch)
 * - Safe server-only credential guardrails
 * - Graceful mock fallback in development environments
 */

import type { TelegramSendMessageOptions, TelegramWebhookInfo } from "./types";

const TELEGRAM_API_BASE = "https://api.telegram.org";

/**
 * Retrieves the Telegram Bot Token from environment variables.
 * Server-only function.
 */
export function getTelegramBotToken(): string | null {
  if (typeof window !== "undefined") {
    throw new Error("[TelegramBot] Security Violation: Bot token requested in browser context.");
  }
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

/**
 * Retrieves the configured Telegram Webhook Secret for update verification.
 */
export function getTelegramWebhookSecret(): string | null {
  return process.env.TELEGRAM_WEBHOOK_SECRET || null;
}

/**
 * Sends a message via the Telegram Bot API.
 * 
 * @param {TelegramSendMessageOptions} options Message content, destination chat, and parse mode
 * @returns {Promise<{ ok: boolean; result?: any; description?: string }>}
 */
export async function sendTelegramMessage(options: TelegramSendMessageOptions): Promise<{
  ok: boolean;
  result?: any;
  description?: string;
}> {
  const token = getTelegramBotToken();

  if (!token) {
    console.warn(
      "[TelegramBot] TELEGRAM_BOT_TOKEN is not configured in environment. " +
      "Simulating successful message delivery in development/mock mode.",
      { chatId: options.chat_id, textLength: options.text.length }
    );
    return { ok: true, description: "Mock delivery: TELEGRAM_BOT_TOKEN unconfigured" };
  }

  try {
    const endpoint = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(options),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error("[TelegramBot] Failed sending message:", data);
      return { ok: false, description: data.description || `HTTP_${response.status}` };
    }

    return { ok: true, result: data.result };
  } catch (err) {
    console.error("[TelegramBot] Network error during sendMessage:", err);
    return {
      ok: false,
      description: err instanceof Error ? err.message : "Network error",
    };
  }
}

/**
 * Sets the webhook URL with Telegram Bot API and configures secret header verification.
 * 
 * @param {string} webhookUrl Absolute HTTPS webhook URL (e.g. https://upaguru.in/api/telegram/webhook)
 * @param {string} secretToken Optional 1-256 character secret token to authenticate incoming requests
 * @returns {Promise<{ ok: boolean; description?: string }>}
 */
export async function setTelegramWebhook(
  webhookUrl: string,
  secretToken?: string
): Promise<{ ok: boolean; description?: string }> {
  const token = getTelegramBotToken();

  if (!token) {
    throw new Error("[TelegramBot] TELEGRAM_BOT_TOKEN is required to set webhook.");
  }

  const endpoint = `${TELEGRAM_API_BASE}/bot${token}/setWebhook`;
  const secret = secretToken || getTelegramWebhookSecret();

  const payload: Record<string, any> = {
    url: webhookUrl,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  };

  if (secret) {
    payload.secret_token = secret;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return { ok: data.ok, description: data.description };
  } catch (err) {
    console.error("[TelegramBot] Error configuring webhook:", err);
    return {
      ok: false,
      description: err instanceof Error ? err.message : "Webhook network error",
    };
  }
}

/**
 * Queries current webhook status from Telegram.
 */
export async function getTelegramWebhookInfo(): Promise<TelegramWebhookInfo | null> {
  const token = getTelegramBotToken();
  if (!token) return null;

  try {
    const endpoint = `${TELEGRAM_API_BASE}/bot${token}/getWebhookInfo`;
    const response = await fetch(endpoint);
    const data = await response.json();
    return data.ok ? data.result : null;
  } catch (err) {
    console.error("[TelegramBot] Error getting webhook info:", err);
    return null;
  }
}
