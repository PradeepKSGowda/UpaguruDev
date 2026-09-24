/**
 * @file lib/telegram/connect.ts
 * @description Telegram deep-linking helper and personalized eligibility alert formatter.
 * Generates one-click deep link URLs for binding candidate Telegram accounts and formats
 * rich HTML notifications highlighting matched eligibility criteria.
 *
 * Enhancement: ENH-0010 (Event-Driven Eligibility Alert Dispatch & Telegram One-Click Bridge)
 * Architecture Reference: ADR-007 (Omnichannel Push Alert Engine), ADR-013 (Security)
 */

import type { EligibilityResult } from "@/lib/matching/eligibility-engine";

/**
 * Retrieves the configured Telegram bot username.
 */
export function getTelegramBotUsername(): string {
  const username = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "UpaguruBot";
  return username.replace(/^@/, "");
}

/**
 * Constructs a secure one-click deep link URL for binding a candidate's Telegram Chat ID.
 * Example: https://t.me/UpaguruBot?start=link_c0a80123-4567-89ab-cdef-0123456789ab
 *
 * @param userId - Unique candidate UUID from auth session
 * @returns Fully-qualified Telegram deep link
 */
export function getTelegramConnectUrl(userId: string): string {
  const botUsername = getTelegramBotUsername();
  return `https://t.me/${botUsername}?start=link_${userId}`;
}

/**
 * Formats a high-converting, personalized Telegram HTML message for an eligible exam.
 *
 * @param candidateName - Candidate display name or fallback
 * @param result - Evaluated eligibility result containing score and dimension breakdown
 * @param siteUrl - Application base URL for notification action link
 * @returns Formatted HTML message for Telegram Bot API
 */
export function formatTelegramEligibilityAlert(
  candidateName: string,
  result: EligibilityResult,
  siteUrl: string = process.env.NEXT_PUBLIC_SITE_URL || "https://upaguru.in"
): string {
  const safeName = candidateName || "Candidate";
  const notificationUrl = `${siteUrl}/notification/${result.slug}`;

  // Extract key dimension highlights
  const dimensionBullets = result.dimensions
    .map((dim) => {
      let icon = "🔹";
      if (dim.status === "eligible") icon = "✅";
      if (dim.status === "ineligible") icon = "❌";
      if (dim.status === "expiring") icon = "⚠️";
      return `${icon} <b>${dim.name.toUpperCase()}:</b> ${dim.detail}`;
    })
    .join("\n");

  const scoreBadge =
    result.overallScore >= 80 ? "🌟 Highly Eligible" : "🎯 Eligible";

  return (
    `🎯 <b>New Exam Matching Your Profile!</b>\n\n` +
    `Hello <b>${safeName}</b>, a new government recruitment has just been published that matches your qualifications and eligibility criteria:\n\n` +
    `📋 <b>${result.title}</b>\n` +
    `🎖️ <b>Match Score:</b> ${result.overallScore}% (${scoreBadge})\n` +
    `⏳ <b>Application Window:</b> ${result.daysUntilDeadline} days remaining\n\n` +
    `<b>Eligibility Evaluation:</b>\n` +
    `${dimensionBullets}\n\n` +
    `👉 <a href="${notificationUrl}">View Full Notification & Apply Online</a>`
  );
}
