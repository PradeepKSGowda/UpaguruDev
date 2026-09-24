/**
 * @file tests/unit/eligibility-dispatcher.test.ts
 * @description Unit tests for Event-Driven Eligibility Alert Dispatch & Telegram One-Click Bridge.
 * Tests deep link URL generation, bot username normalization, and HTML alert message formatting.
 *
 * Enhancement: ENH-0010
 */

import { describe, it, expect } from "vitest";
import {
  getTelegramBotUsername,
  getTelegramConnectUrl,
  formatTelegramEligibilityAlert,
} from "@/lib/telegram/connect";
import type { EligibilityResult } from "@/lib/matching/eligibility-engine";

describe("Telegram Connect Bridge — Deep Linking", () => {
  it("normalizes bot username by stripping leading @ symbol", () => {
    const username = getTelegramBotUsername();
    expect(username.startsWith("@")).toBe(false);
    expect(username.length).toBeGreaterThan(0);
  });

  it("generates correct one-click deep link with user id payload", () => {
    const userId = "c0a80123-4567-89ab-cdef-0123456789ab";
    const url = getTelegramConnectUrl(userId);
    expect(url).toContain("https://t.me/");
    expect(url).toContain(`?start=link_${userId}`);
  });
});

describe("Telegram Eligibility Alert — Message Formatter", () => {
  const sampleResult: EligibilityResult = {
    notificationId: "notif-001",
    title: "KPSC Assistant Conservator of Forests Exam 2026",
    slug: "kpsc-acf-exam-2026",
    overallScore: 95,
    isEligible: true,
    applicationEndDate: "2026-10-31",
    daysUntilDeadline: 37,
    dimensions: [
      {
        name: "age",
        status: "eligible",
        score: 100,
        detail: "Age 28 is within the eligible range 21–38 (includes +3 years OBC relaxation).",
      },
      {
        name: "qualification",
        status: "eligible",
        score: 100,
        detail: "Your qualification meets the requirement (Graduate).",
      },
      {
        name: "state",
        status: "eligible",
        score: 100,
        detail: "Your state (Karnataka) matches the exam state.",
      },
      {
        name: "deadline",
        status: "eligible",
        score: 100,
        detail: "37 days remaining to apply.",
      },
    ],
  };

  it("formats personalized greeting and notification title in HTML", () => {
    const html = formatTelegramEligibilityAlert("Priya Sharma", sampleResult, "https://upaguru.in");
    expect(html).toContain("Hello <b>Priya Sharma</b>");
    expect(html).toContain("KPSC Assistant Conservator of Forests Exam 2026");
    expect(html).toContain("95%");
    expect(html).toContain("37 days remaining");
  });

  it("includes all evaluated dimension highlights with status icons", () => {
    const html = formatTelegramEligibilityAlert("Candidate", sampleResult);
    expect(html).toContain("✅ <b>AGE:</b>");
    expect(html).toContain("OBC relaxation");
    expect(html).toContain("✅ <b>QUALIFICATION:</b>");
    expect(html).toContain("Graduate");
    expect(html).toContain("✅ <b>STATE:</b>");
    expect(html).toContain("Karnataka");
  });

  it("embeds direct link to candidate notification detail page", () => {
    const html = formatTelegramEligibilityAlert("Ramesh", sampleResult, "https://upaguru.in");
    expect(html).toContain('href="https://upaguru.in/notification/kpsc-acf-exam-2026"');
  });
});
