/**
 * @file types/drafts.ts
 * @module DraftTypes
 * @description Strongly-typed TypeScript interfaces and domain models for AI-extracted
 * draft notifications, parsed field structures, queue filtering, and pagination.
 * 
 * Task ID: TASK-03020101 (Subtask: SUB-0302010101)
 * Architecture Reference: ADR-001 (Frontend RSC), ADR-002 (Database Schema), ADR-013 (Security)
 */

import type { DraftStatusEnum } from "./database.types";

/**
 * Lifecycle status for draft notifications in the HITL pipeline
 */
export type DraftStatus = DraftStatusEnum; // "pending_review" | "approved" | "rejected"

/**
 * Supported sorting options for the draft review queue
 */
export type DraftSortBy =
  | "confidence_asc"   // Lowest confidence first (default: priority review)
  | "confidence_desc"  // Highest confidence first
  | "newest"           // Most recently extracted first
  | "oldest";          // Oldest in queue first

/**
 * Structured payload extracted by the AI engine from notification PDFs and announcement sites
 */
export interface DraftParsedJson {
  title?: string;
  exam_name?: string;
  conducting_body?: string;
  notification_number?: string | null;
  total_vacancies?: number | null;
  application_start_date?: string | null;
  application_end_date?: string | null;
  exam_date?: string | null;
  qualification_required?: string[];
  age_limit_min?: number | null;
  age_limit_max?: number | null;
  official_pdf_url?: string | null;
  apply_online_url?: string | null;
  category?: string | null;
  syllabus_summary?: Record<string, unknown>;
  selection_process?: string[];
  [key: string]: unknown;
}

/**
 * Complete draft notification domain entity
 */
export interface DraftNotification {
  id: string;
  sourceUrl: string;
  rawExtractedText: string | null;
  parsedJson: DraftParsedJson;
  extractionConfidenceScore: number;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Query filter parameters for the draft review queue
 */
export interface DraftFilterParams {
  status?: DraftStatus | "all";
  sortBy?: DraftSortBy;
  search?: string;
  minConfidence?: number;
  maxConfidence?: number;
  page?: number;
  pageSize?: number;
}

/**
 * Paginated response wrapper for draft notification listings
 */
export interface PaginatedDrafts {
  drafts: DraftNotification[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}
