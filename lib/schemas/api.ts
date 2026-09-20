/**
 * @file lib/schemas/api.ts
 * @module ApiSchemas
 * @description Zod validation schemas and TypeScript contracts for UPA-GURU Public REST API v1.
 * Defines request query validation (limit, offset, category, state, sort, search, q) and
 * RFC 7807 problem details error response formatting across:
 * - GET /api/v1/notifications
 * - GET /api/v1/exams
 * - GET /api/v1/search
 * 
 * Task ID: TASK-08010101, TASK-08010102 (Subtasks: SUB-0801010101, SUB-0801010201)
 * Architecture Reference: ADR-001, ADR-002, ADR-006, ADR-010, ADR-013, ADR-014 (API Design)
 * Complies with: AGENTS.md (Rule 1: Zod Input Validation & TypeScript Strict Mode)
 */

import { z } from "zod";
import { EXAM_CATEGORIES } from "./notifications";

// =============================================================================
// 1. Common Types & RFC 7807 Problem Details
// =============================================================================

/**
 * RFC 7807 Problem Details invalid parameter descriptor
 */
export interface Rfc7807InvalidParam {
  name: string;
  reason: string;
}

/**
 * RFC 7807 Standard Problem Details Specification
 * @see https://datatracker.ietf.org/doc/html/rfc7807
 */
export interface Rfc7807ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  invalid_params?: Rfc7807InvalidParam[];
  [key: string]: unknown;
}

/**
 * Formats a Zod validation error into a standard RFC 7807 400 Bad Request Problem Details payload
 * 
 * @param {string} pathname Request URL path
 * @param {z.ZodError} error Zod validation error instance
 * @returns {Rfc7807ProblemDetails} Structured problem details object
 */
export function formatRfc7807ValidationError(
  pathname: string,
  error: z.ZodError
): Rfc7807ProblemDetails {
  const invalid_params: Rfc7807InvalidParam[] = error.errors.map((err) => ({
    name: err.path.join(".") || "parameter",
    reason: err.message,
  }));

  return {
    type: "https://upaguru.in/errors/invalid-parameters",
    title: "Invalid Query Parameters",
    status: 400,
    detail: `The request query parameters failed validation: ${invalid_params.map((p) => `${p.name} (${p.reason})`).join("; ")}`,
    instance: pathname,
    invalid_params,
  };
}

/**
 * Standard pagination metadata for REST API list endpoints
 */
export interface ApiPagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// =============================================================================
// 2. Notifications Endpoint Schemas & Types (GET /api/v1/notifications)
// =============================================================================

/**
 * Permitted sort options for the public notifications REST API
 */
export const NOTIFICATION_API_SORT_OPTIONS = [
  "published_desc",
  "published_asc",
  "deadline_asc",
  "deadline_desc",
  "vacancies_desc",
  "title_asc",
] as const;

export type NotificationApiSort = (typeof NOTIFICATION_API_SORT_OPTIONS)[number];

/**
 * Zod validation schema for GET /api/v1/notifications query parameters
 */
export const notificationQueryParamsSchema = z.object({
  limit: z
    .coerce
    .number()
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(100, "Limit cannot exceed 100")
    .optional()
    .default(20),
  offset: z
    .coerce
    .number()
    .int("Offset must be an integer")
    .min(0, "Offset must be greater than or equal to 0")
    .optional()
    .default(0),
  category: z
    .enum(["all", ...EXAM_CATEGORIES], {
      errorMap: () => ({
        message: `Category must be one of: all, ${EXAM_CATEGORIES.join(", ")}`,
      }),
    })
    .optional()
    .default("all"),
  state: z
    .string()
    .trim()
    .max(100, "State filter must not exceed 100 characters")
    .optional()
    .default("all"),
  sort: z
    .enum(NOTIFICATION_API_SORT_OPTIONS, {
      errorMap: () => ({
        message: `Sort must be one of: ${NOTIFICATION_API_SORT_OPTIONS.join(", ")}`,
      }),
    })
    .optional()
    .default("published_desc"),
  search: z
    .string()
    .trim()
    .max(100, "Search query must not exceed 100 characters")
    .optional()
    .default(""),
});

export type NotificationQueryParams = z.infer<typeof notificationQueryParamsSchema>;

/**
 * Associated exam metadata included in notification responses
 */
export interface ApiExamSummary {
  id: string;
  slug: string;
  title: string;
  conducting_body: string;
  category: string;
  state_or_central: string;
  official_website: string;
  logo_url: string | null;
}

/**
 * Normalized public notification item in API response envelope
 */
export interface ApiNotificationItem {
  id: string;
  slug: string;
  title: string;
  notification_number: string | null;
  total_vacancies: number;
  application_start_date: string;
  application_end_date: string;
  exam_date: string | null;
  qualification_required: string[];
  age_limit_min: number | null;
  age_limit_max: number | null;
  official_pdf_url: string | null;
  apply_online_url: string | null;
  syllabus_summary: unknown;
  selection_process: string[];
  published_at: string | null;
  created_at: string;
  updated_at: string;
  exam: ApiExamSummary;
}

/**
 * GET /api/v1/notifications response envelope
 */
export interface ApiNotificationsResponse {
  data: ApiNotificationItem[];
  pagination: ApiPagination;
  timestamp: string;
}

// =============================================================================
// 3. Exams Endpoint Schemas & Types (GET /api/v1/exams)
// =============================================================================

export const EXAM_API_SORT_OPTIONS = [
  "title_asc",
  "title_desc",
  "created_desc",
  "created_asc",
] as const;

export type ExamApiSort = (typeof EXAM_API_SORT_OPTIONS)[number];

/**
 * Zod validation schema for GET /api/v1/exams query parameters
 */
export const examQueryParamsSchema = z.object({
  limit: z
    .coerce
    .number()
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(100, "Limit cannot exceed 100")
    .optional()
    .default(20),
  offset: z
    .coerce
    .number()
    .int("Offset must be an integer")
    .min(0, "Offset must be greater than or equal to 0")
    .optional()
    .default(0),
  category: z
    .enum(["all", ...EXAM_CATEGORIES], {
      errorMap: () => ({
        message: `Category must be one of: all, ${EXAM_CATEGORIES.join(", ")}`,
      }),
    })
    .optional()
    .default("all"),
  state: z
    .string()
    .trim()
    .max(100, "State filter must not exceed 100 characters")
    .optional()
    .default("all"),
  sort: z
    .enum(EXAM_API_SORT_OPTIONS, {
      errorMap: () => ({
        message: `Sort must be one of: ${EXAM_API_SORT_OPTIONS.join(", ")}`,
      }),
    })
    .optional()
    .default("title_asc"),
  search: z
    .string()
    .trim()
    .max(100, "Search query must not exceed 100 characters")
    .optional()
    .default(""),
});

export type ExamQueryParams = z.infer<typeof examQueryParamsSchema>;

/**
 * Detailed exam item returned by GET /api/v1/exams
 */
export interface ApiExamItem {
  id: string;
  slug: string;
  title: string;
  conducting_body: string;
  category: string;
  state_or_central: string;
  official_website: string;
  logo_url: string | null;
  active_notifications_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/v1/exams response envelope
 */
export interface ApiExamsResponse {
  data: ApiExamItem[];
  pagination: ApiPagination;
  timestamp: string;
}

// =============================================================================
// 4. Search Endpoint Schemas & Types (GET /api/v1/search)
// =============================================================================

export const SEARCH_API_SORT_OPTIONS = [
  "relevance",
  "published_desc",
  "deadline_asc",
  "vacancies_desc",
] as const;

export type SearchApiSort = (typeof SEARCH_API_SORT_OPTIONS)[number];

/**
 * Zod validation schema for GET /api/v1/search query parameters
 */
export const searchQueryParamsSchema = z.object({
  q: z
    .string({
      required_error: "Search parameter 'q' is required",
      invalid_type_error: "Search parameter 'q' must be a string",
    })
    .trim()
    .min(1, "Search query 'q' must not be empty")
    .max(100, "Search query 'q' cannot exceed 100 characters"),
  limit: z
    .coerce
    .number()
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(100, "Limit cannot exceed 100")
    .optional()
    .default(20),
  offset: z
    .coerce
    .number()
    .int("Offset must be an integer")
    .min(0, "Offset must be greater than or equal to 0")
    .optional()
    .default(0),
  category: z
    .enum(["all", ...EXAM_CATEGORIES], {
      errorMap: () => ({
        message: `Category must be one of: all, ${EXAM_CATEGORIES.join(", ")}`,
      }),
    })
    .optional()
    .default("all"),
  state: z
    .string()
    .trim()
    .max(100, "State filter must not exceed 100 characters")
    .optional()
    .default("all"),
  sort: z
    .enum(SEARCH_API_SORT_OPTIONS, {
      errorMap: () => ({
        message: `Sort must be one of: ${SEARCH_API_SORT_OPTIONS.join(", ")}`,
      }),
    })
    .optional()
    .default("relevance"),
});

export type SearchQueryParams = z.infer<typeof searchQueryParamsSchema>;

/**
 * GET /api/v1/search response envelope
 */
export interface ApiSearchResponse {
  query: string;
  data: ApiNotificationItem[];
  pagination: ApiPagination;
  timestamp: string;
}
