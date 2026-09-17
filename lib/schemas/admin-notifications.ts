/**
 * @file lib/schemas/admin-notifications.ts
 * @module AdminNotificationSchemas
 * @description Zod validation schemas for administrative Notification CRUD operations.
 * 
 * Task ID: TASK-03030102 (Subtask: SUB-0303010201)
 * Architecture Reference: ADR-001, ADR-002, AGENTS.md (Rule 1: Zod Input Validation)
 */

import { z } from "zod";

export const NOTIFICATION_STATUSES = [
  "draft",
  "under_review",
  "published",
  "archived",
] as const;

export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const notificationStatusEnumSchema = z.enum(NOTIFICATION_STATUSES);

/**
 * Zod validation schema for creating and editing notifications manually
 */
export const adminNotificationInputSchema = z.object({
  exam_id: z.string().uuid("Please select a valid examination series"),
  title: z
    .string()
    .trim()
    .min(5, "Notification title must be at least 5 characters")
    .max(255, "Notification title cannot exceed 255 characters"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Slug must be at least 3 characters")
    .max(120, "Slug cannot exceed 120 characters")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must contain only lowercase alphanumeric characters and hyphens (e.g. upsc-cse-2026)"),
  notification_number: z
    .string()
    .trim()
    .max(100, "Notification reference number cannot exceed 100 characters")
    .nullable()
    .optional(),
  total_vacancies: z
    .preprocess(
      (val) => (val === "" || val === null || val === undefined ? 0 : Number(val)),
      z.number().int("Vacancies must be an integer").min(0, "Vacancies cannot be negative").default(0)
    ),
  application_start_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Application start date must be in YYYY-MM-DD format"),
  application_end_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Application deadline must be in YYYY-MM-DD format"),
  exam_date: z
    .preprocess(
      (val) => (val === "" || val === null || val === undefined ? null : String(val)),
      z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Exam date must be in YYYY-MM-DD format").nullable().optional()
    ),
  qualification_required: z
    .union([
      z.array(z.string()),
      z.string().transform((val) =>
        val
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      ),
    ])
    .default([]),
  age_limit_min: z
    .preprocess(
      (val) => (val === "" || val === null || val === undefined ? null : Number(val)),
      z.number().int("Minimum age must be an integer").min(0).max(100).nullable().optional()
    ),
  age_limit_max: z
    .preprocess(
      (val) => (val === "" || val === null || val === undefined ? null : Number(val)),
      z.number().int("Maximum age must be an integer").min(0).max(100).nullable().optional()
    ),
  official_pdf_url: z
    .string()
    .trim()
    .url("Must be a valid URL (e.g. https://upsc.gov.in/notif.pdf)")
    .or(z.literal(""))
    .nullable()
    .optional(),
  apply_online_url: z
    .string()
    .trim()
    .url("Must be a valid URL (e.g. https://upsconline.nic.in)")
    .or(z.literal(""))
    .nullable()
    .optional(),
  status: notificationStatusEnumSchema.default("published"),
});

export type ValidatedAdminNotificationInput = z.infer<typeof adminNotificationInputSchema>;

/**
 * Filter schema for admin notifications list
 */
export const adminNotificationFilterSchema = z.object({
  search: z.string().trim().max(100).optional().default(""),
  status: z.enum(["all", ...NOTIFICATION_STATUSES]).optional().default("all"),
  examId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(5).max(100).optional().default(15),
});

export type ValidatedAdminNotificationFilter = z.infer<typeof adminNotificationFilterSchema>;
