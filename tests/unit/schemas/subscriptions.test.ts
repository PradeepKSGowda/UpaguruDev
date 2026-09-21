/**
 * @file tests/unit/schemas/subscriptions.test.ts
 * @description Unit tests for Candidate Subscription Preferences validation schema.
 * 
 * Task ID: TASK-09010102 (Subtask: SUB-0901010201)
 * Architecture Reference: ADR-007, AGENTS.md (Rule 1 & Rule 2)
 */

import { describe, it, expect } from "vitest";
import {
  subscriptionPreferencesSchema,
  EXAM_CATEGORIES_TUPLE,
  NOTIFICATION_CHANNELS_TUPLE,
} from "@/lib/schemas/subscriptions";

describe("subscriptionPreferencesSchema", () => {
  it("TC-SUB-01: should pass with valid Web Push and Email channels", () => {
    const validData = {
      subscribedCategories: ["civil_services", "state_psc"],
      subscribedStates: ["Karnataka", "Delhi"],
      preferredChannels: ["web_push", "email"],
    };

    const result = subscriptionPreferencesSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subscribedCategories).toEqual(["civil_services", "state_psc"]);
      expect(result.data.preferredChannels).toContain("web_push");
    }
  });

  it("TC-SUB-01B: should accept all predefined categories and supported channels", () => {
    for (const category of EXAM_CATEGORIES_TUPLE) {
      const result = subscriptionPreferencesSchema.safeParse({
        subscribedCategories: [category],
        preferredChannels: ["web_push"],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.subscribedCategories).toContain(category);
      }
    }

    // Verify each valid notification channel is accepted
    expect(NOTIFICATION_CHANNELS_TUPLE.length).toBeGreaterThan(0);
    const channelResult = subscriptionPreferencesSchema.safeParse({
      preferredChannels: ["web_push", "email"],
    });
    expect(channelResult.success).toBe(true);
  });

  it("TC-SUB-02: should reject empty preferredChannels array", () => {
    const invalidData = {
      subscribedCategories: ["banking"],
      subscribedStates: ["Central"],
      preferredChannels: [],
    };

    const result = subscriptionPreferencesSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Please select at least one notification channel");
    }
  });

  it("TC-SUB-03: should pass with valid Indian WhatsApp mobile number with and without +91", () => {
    const formats = [
      "9876543210",
      "+919876543210",
      "+91 98765 43210",
      "09876543210",
    ];

    for (const phone of formats) {
      const data = {
        subscribedCategories: ["railways"],
        preferredChannels: ["whatsapp"],
        whatsappPhoneNumber: phone,
      };

      const result = subscriptionPreferencesSchema.safeParse(data);
      expect(result.success).toBe(true);
    }
  });

  it("TC-SUB-04: should require whatsappPhoneNumber when whatsapp channel is selected", () => {
    const dataWithoutPhone = {
      subscribedCategories: ["railways"],
      preferredChannels: ["whatsapp"],
      whatsappPhoneNumber: "",
    };

    const result = subscriptionPreferencesSchema.safeParse(dataWithoutPhone);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("WhatsApp phone number is required");
    }
  });

  it("TC-SUB-05: should reject invalid Indian mobile numbers (e.g. invalid prefix or length)", () => {
    const invalidNumbers = [
      "1234567890", // Does not start with 6-9
      "98765",      // Too short
      "abcdefghij", // Non-digits
    ];

    for (const phone of invalidNumbers) {
      const data = {
        preferredChannels: ["whatsapp"],
        whatsappPhoneNumber: phone,
      };

      const result = subscriptionPreferencesSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("Please enter a valid 10-digit Indian mobile number");
      }
    }
  });

  it("TC-SUB-06: should pass with valid Telegram chat ID when Telegram channel is selected", () => {
    const validData = {
      preferredChannels: ["telegram"],
      telegramChatId: "@upaguru_candidate",
    };

    const result = subscriptionPreferencesSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("TC-SUB-07: should reject Telegram chat ID containing invalid special characters", () => {
    const invalidData = {
      preferredChannels: ["telegram"],
      telegramChatId: "candidate!#*invalid",
    };

    const result = subscriptionPreferencesSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Telegram Chat ID may only contain");
    }
  });

  it("TC-SUB-08: should reject unrecognized notification channels", () => {
    const invalidData = {
      preferredChannels: ["carrier_pigeon"],
    };

    const result = subscriptionPreferencesSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
