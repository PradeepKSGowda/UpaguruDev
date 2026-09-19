/**
 * @file lib/schemas/subscriptions.ts
 * @module SubscriptionSchemas
 * @description Zod validation schemas for Candidate Subscription Preference Center.
 * Validates selected exam categories, Indian states, alert channels, and contact endpoints.
 * 
 * Task ID: TASK-05010101
 * Architecture Reference: ADR-001 (Frontend RSC), ADR-007 (Omnichannel Alerts), AGENTS.md (Rule 1: Input Validation)
 * 
 * Complies with:
 * - TypeScript strict mode with inferred types
 * - WCAG-accessible human-friendly validation error messages
 * - E.164 / Indian mobile number validation for WhatsApp
 * - Channel-specific conditional constraints
 */

import { z } from "zod";

export const EXAM_CATEGORIES_TUPLE = [
  "civil_services",
  "banking",
  "railways",
  "defense",
  "state_psc",
  "teaching",
  "police",
  "other",
] as const;

export const NOTIFICATION_CHANNELS_TUPLE = [
  "web_push",
  "telegram",
  "whatsapp",
  "email",
] as const;

/**
 * Subscription preference form validation schema
 */
export const subscriptionPreferencesSchema = z
  .object({
    subscribedCategories: z
      .array(z.enum(EXAM_CATEGORIES_TUPLE), {
        invalid_type_error: "Invalid exam category selected",
      })
      .default([]),

    subscribedStates: z
      .array(z.string().trim().min(1, "State name cannot be empty"))
      .default([]),

    preferredChannels: z
      .array(z.enum(NOTIFICATION_CHANNELS_TUPLE), {
        invalid_type_error: "Invalid notification channel selected",
      })
      .min(1, "Please select at least one notification channel (e.g. Web Push or Email)"),

    telegramChatId: z
      .string()
      .trim()
      .max(64, "Telegram Chat ID must not exceed 64 characters")
      .optional()
      .or(z.literal("")),

    whatsappPhoneNumber: z
      .string()
      .trim()
      .max(20, "Phone number is too long")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    // If Telegram channel is enabled, validate chat ID format if provided
    if (data.preferredChannels.includes("telegram")) {
      if (data.telegramChatId && data.telegramChatId.length > 0) {
        if (!/^[a-zA-Z0-9_@-]+$/.test(data.telegramChatId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["telegramChatId"],
            message: "Telegram Chat ID may only contain letters, numbers, underscores, and dashes",
          });
        }
      }
    }

    // If WhatsApp channel is enabled, validate phone number format
    if (data.preferredChannels.includes("whatsapp")) {
      if (!data.whatsappPhoneNumber || data.whatsappPhoneNumber.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["whatsappPhoneNumber"],
          message: "WhatsApp phone number is required when WhatsApp alerts are enabled",
        });
      } else {
        // Allow Indian 10-digit mobile, optionally prefixed with +91 or 0
        const cleaned = data.whatsappPhoneNumber.replace(/[\s\-()]/g, "");
        if (!/^(?:\+91|91|0)?[6-9]\d{9}$/.test(cleaned)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["whatsappPhoneNumber"],
            message: "Please enter a valid 10-digit Indian mobile number (e.g., 9876543210)",
          });
        }
      }
    }
  });

export type ValidatedSubscriptionPreferences = z.infer<typeof subscriptionPreferencesSchema>;
