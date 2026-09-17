/**
 * @file lib/schemas/exams.ts
 * @module ExamSchemas
 * @description Zod validation schemas for administrative Exam CRUD operations.
 * 
 * Task ID: TASK-03030101 (Subtask: SUB-0303010102)
 * Architecture Reference: ADR-001, ADR-002, AGENTS.md (Rule 1: Zod Input Validation)
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

export type ExamCategory = (typeof EXAM_CATEGORIES)[number];

export const examCategoryEnumSchema = z.enum(EXAM_CATEGORIES);

/**
 * Zod validation schema for creating and editing exams
 */
export const examInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Exam title must be at least 3 characters")
    .max(200, "Exam title cannot exceed 200 characters"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Slug must be at least 3 characters")
    .max(100, "Slug cannot exceed 100 characters")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must contain only lowercase alphanumeric characters and hyphens (e.g. upsc-cse)"),
  conducting_body: z
    .string()
    .trim()
    .min(2, "Conducting body must be at least 2 characters")
    .max(150, "Conducting body cannot exceed 150 characters"),
  category: examCategoryEnumSchema,
  state_or_central: z
    .string()
    .trim()
    .min(2, "State or Central designation is required")
    .max(100, "State or Central designation cannot exceed 100 characters"),
  official_website: z
    .string()
    .trim()
    .url("Must be a valid URL (e.g. https://upsc.gov.in)"),
  logo_url: z
    .string()
    .trim()
    .url("Must be a valid URL")
    .or(z.literal(""))
    .nullable()
    .optional(),
});

export type ValidatedExamInput = z.infer<typeof examInputSchema>;

/**
 * Filter and pagination schema for administrative exams list
 */
export const examFilterSchema = z.object({
  search: z.string().trim().max(100).optional().default(""),
  category: z.enum(["all", ...EXAM_CATEGORIES]).optional().default("all"),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(5).max(100).optional().default(15),
});

export type ValidatedExamFilter = z.infer<typeof examFilterSchema>;
