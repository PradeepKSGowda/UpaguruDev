/**
 * @file lib/schemas/drafts.ts
 * @module DraftSchemas
 * @description Zod validation schemas for administrative draft queue filtering,
 * pagination, and sorting parameters.
 * 
 * Task ID: TASK-03020101 (Subtask: SUB-0302010101)
 * Architecture Reference: ADR-001, ADR-002, AGENTS.md (Rule 1: Zod Input Validation)
 */

import { z } from "zod";

export const DRAFT_STATUSES = ["pending_review", "approved", "rejected"] as const;

export const DRAFT_SORT_OPTIONS = [
  "confidence_asc",
  "confidence_desc",
  "newest",
  "oldest",
] as const;

/**
 * Validation schema for draft queue query parameters
 */
export const draftFilterSchema = z.object({
  status: z
    .enum(["all", ...DRAFT_STATUSES])
    .optional()
    .default("pending_review"),
  sortBy: z
    .enum(DRAFT_SORT_OPTIONS)
    .optional()
    .default("confidence_asc"),
  search: z
    .string()
    .trim()
    .max(100, "Search query must not exceed 100 characters")
    .optional()
    .default(""),
  minConfidence: z
    .coerce
    .number()
    .min(0, "Confidence cannot be less than 0")
    .max(1, "Confidence cannot exceed 1")
    .optional(),
  maxConfidence: z
    .coerce
    .number()
    .min(0, "Confidence cannot be less than 0")
    .max(1, "Confidence cannot exceed 1")
    .optional(),
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
    .default(20),
});

export type ValidatedDraftFilters = z.infer<typeof draftFilterSchema>;

/**
 * Validation schema for parsed fields edited by administrative operators
 * in the draft verification workspace prior to approval.
 */
export const draftParsedFieldsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(300, "Title cannot exceed 300 characters"),
  conducting_body: z
    .string()
    .trim()
    .min(2, "Conducting body must be at least 2 characters")
    .max(150, "Conducting body cannot exceed 150 characters"),
  exam_name: z
    .string()
    .trim()
    .max(200, "Exam name cannot exceed 200 characters")
    .optional()
    .nullable(),
  notification_number: z
    .string()
    .trim()
    .max(100, "Notification number cannot exceed 100 characters")
    .optional()
    .nullable(),
  category: z
    .string()
    .trim()
    .max(100, "Category cannot exceed 100 characters")
    .optional()
    .nullable(),
  total_vacancies: z
    .preprocess(
      (val) => (val === "" || val === null || val === undefined ? null : Number(val)),
      z.number().int("Must be an integer").min(0, "Vacancies cannot be negative").nullable().optional()
    ),
  application_start_date: z
    .string()
    .trim()
    .max(50)
    .optional()
    .nullable(),
  application_end_date: z
    .string()
    .trim()
    .max(50)
    .optional()
    .nullable(),
  exam_date: z
    .string()
    .trim()
    .max(50)
    .optional()
    .nullable(),
  age_limit_min: z
    .preprocess(
      (val) => (val === "" || val === null || val === undefined ? null : Number(val)),
      z.number().int("Must be an integer").min(0, "Minimum age cannot be negative").max(100).nullable().optional()
    ),
  age_limit_max: z
    .preprocess(
      (val) => (val === "" || val === null || val === undefined ? null : Number(val)),
      z.number().int("Must be an integer").min(0, "Maximum age cannot be negative").max(100).nullable().optional()
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
    .optional()
    .nullable(),
  official_pdf_url: z
    .string()
    .trim()
    .url("Must be a valid URL")
    .or(z.literal(""))
    .optional()
    .nullable(),
  apply_online_url: z
    .string()
    .trim()
    .url("Must be a valid URL")
    .or(z.literal(""))
    .optional()
    .nullable(),
});

export type ValidatedDraftParsedFields = z.infer<typeof draftParsedFieldsSchema>;

/**
 * Rejection reason schema for HITL verification workflow
 */
export const draftRejectionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Rejection reason must be at least 10 characters long to provide an actionable audit trail")
    .max(1000, "Rejection reason cannot exceed 1000 characters"),
});

export type ValidatedDraftRejection = z.infer<typeof draftRejectionSchema>;

/**
 * Validation schema for publishNotificationAction payload
 */
export const publishNotificationInputSchema = draftParsedFieldsSchema.extend({
  draftId: z.string().uuid("Invalid draft UUID format"),
  examId: z.string().uuid("Invalid exam UUID format").optional().nullable(),
});

export type ValidatedPublishNotificationInput = z.infer<typeof publishNotificationInputSchema>;
