/**
 * @file lib/schemas/notifications.ts
 * @module NotificationSchemas
 * @description Zod validation schemas for notification feed filters, pagination, and sorting parameters.
 * 
 * Task ID: TASK-02020101
 * Architecture Reference: ADR-001, ADR-002, AGENTS.md (Rule 1: Zod Input Validation)
 * 
 * Complies with:
 * - TypeScript strict mode with inferred types
 * - Sanitized search query trimming and bounding
 * - Validated pagination bounds (min page 1, max pageSize 50)
 */

import { z } from "zod";

export const EXAM_CATEGORIES = [
  "civil_services",
  "banking",
  "railways",
  "defense",
  "state_psc",
  "teaching",
  "police",
  "other",
] as const;

export const NOTIFICATION_SORT_OPTIONS = [
  "deadline_soonest",
  "deadline_latest",
  "recently_published",
  "vacancies_high_low",
  "title_asc",
] as const;

/**
 * Validation schema for public notification feed query parameters
 */
export const notificationFilterSchema = z.object({
  category: z
    .enum(["all", ...EXAM_CATEGORIES])
    .optional()
    .default("all"),
  state: z
    .string()
    .trim()
    .max(50, "State filter must not exceed 50 characters")
    .optional()
    .default("all"),
  search: z
    .string()
    .trim()
    .max(100, "Search query must not exceed 100 characters")
    .optional()
    .default(""),
  sortBy: z
    .enum(NOTIFICATION_SORT_OPTIONS)
    .optional()
    .default("deadline_soonest"),
  page: z
    .coerce
    .number()
    .int("Page number must be an integer")
    .positive("Page number must be at least 1")
    .optional()
    .default(1),
  pageSize: z
    .coerce
    .number()
    .int("Page size must be an integer")
    .min(1, "Page size must be at least 1")
    .max(50, "Maximum 50 items allowed per page")
    .optional()
    .default(12),
});

export type ValidatedNotificationFilters = z.infer<typeof notificationFilterSchema>;
