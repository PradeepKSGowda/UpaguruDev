/**
 * @file types/notifications.ts
 * @module NotificationTypes
 * @description Strongly-typed TypeScript interfaces and domain models for exam notifications,
 * conducting bodies, feed filtering, pagination, and detail views.
 * 
 * Task ID: TASK-02020101 (Subtask: SUB-0202010101)
 * Architecture Reference: ADR-001 (Frontend RSC), ADR-002 (Database Schema), ADR-008 (SEO)
 * 
 * Complies with:
 * - TypeScript strict mode (Zero `any`)
 * - schema-v1.sql database column parity
 * - Public Candidate Portal consumption & Playwright test landmarks
 */

import type { ExamCategoryEnum, NotificationStatusEnum, Json } from "./database.types";

/**
 * Re-export core enums for domain convenience
 */
export type ExamCategory = ExamCategoryEnum;
export type NotificationStatus = NotificationStatusEnum;

/**
 * Supported sorting criteria for the public notification feed
 */
export type NotificationSortField = 
  | "application_end_date"
  | "published_at"
  | "total_vacancies"
  | "title";

export type SortOrder = "asc" | "desc";

export type NotificationSortBy = 
  | "deadline_soonest"    // application_end_date ASC
  | "deadline_latest"    // application_end_date DESC
  | "recently_published" // published_at DESC
  | "vacancies_high_low" // total_vacancies DESC
  | "title_asc";         // title ASC

/**
 * Summary representation of an Exam and its Conducting Body
 * Joined from the public.exams table
 */
export interface ExamSummary {
  id: string;
  slug: string;
  title: string;
  conductingBody: string;
  category: ExamCategory;
  stateOrCentral: string;
  officialWebsite: string | null;
  logoUrl: string | null;
}

/**
 * Lightweight notification item optimized for feed cards and list displays
 */
export interface NotificationListItem {
  id: string;
  slug: string;
  title: string;
  notificationNumber: string | null;
  totalVacancies: number;
  applicationStartDate: string;
  applicationEndDate: string;
  examDate: string | null;
  qualificationRequired: string[];
  ageLimitMin: number | null;
  ageLimitMax: number | null;
  status: NotificationStatus;
  publishedAt: string | null;
  exam: ExamSummary;
}

/**
 * Full notification details for individual notification landing pages (/notification/[slug])
 */
export interface NotificationDetail extends NotificationListItem {
  officialPdfUrl: string | null;
  applyOnlineUrl: string | null;
  syllabusSummary: Record<string, unknown> | Json;
  selectionProcess: string[];
  verifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Filter parameters for querying notifications
 */
export interface NotificationFilterParams {
  category?: ExamCategory | "all";
  state?: string | "all";
  search?: string;
  sortBy?: NotificationSortBy;
  page?: number;
  pageSize?: number;
}

/**
 * Paginated response container for notification feed queries
 */
export interface PaginatedNotifications<T = NotificationListItem> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Category metadata with human-readable labels and badges
 */
export interface ExamCategoryMeta {
  category: ExamCategory;
  label: string;
  shortLabel: string;
  iconName: string;
  badgeColorClass: string;
}
