/**
 * @file lib/data/admin-notifications.ts
 * @module AdminNotificationDataAccess
 * @description Data access functions for administrative Notification CRUD operations.
 * 
 * Task ID: TASK-03030102 (Subtask: SUB-0303010201)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-002 (Database)
 */

import { createServerClient } from "@/lib/supabase/server";
import { ValidatedAdminNotificationFilter } from "@/lib/schemas/admin-notifications";
import { Database } from "@/types/database.types";

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
type ExamRow = Database["public"]["Tables"]["exams"]["Row"];

export interface AdminNotificationListItem extends NotificationRow {
  exam: Pick<ExamRow, "id" | "title" | "conducting_body" | "category" | "state_or_central" | "slug"> | null;
}

export interface AdminNotificationsResponse {
  notifications: AdminNotificationListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ExamOption {
  id: string;
  title: string;
  conducting_body: string;
  category: string;
  state_or_central: string;
  slug: string;
}

/**
 * Retrieve paginated notifications for admin listing with search, status filtering, and joined exam metadata.
 */
export async function getAdminNotifications(
  filter: Partial<ValidatedAdminNotificationFilter> = {}
): Promise<AdminNotificationsResponse> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filter.pageSize ?? 15));
  const offset = (page - 1) * pageSize;

  const supabase = await createServerClient();

  let query = supabase
    .from("notifications")
    .select("*, exams(id, title, conducting_body, category, state_or_central, slug)", { count: "exact" });

  // Apply search query
  if (filter.search && filter.search.trim().length > 0) {
    const term = filter.search.trim();
    query = query.or(`title.ilike.%${term}%,notification_number.ilike.%${term}%,slug.ilike.%${term}%`);
  }

  // Apply status filter
  if (filter.status && filter.status !== "all") {
    query = query.eq("status", filter.status);
  }

  // Apply exam filter
  if (filter.examId) {
    query = query.eq("exam_id", filter.examId);
  }

  // Order by created_at descending
  query = query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error("[getAdminNotifications] Query error:", error);
    return {
      notifications: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  const total = count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const notifications: AdminNotificationListItem[] = (data || []).map((row: any) => ({
    ...row,
    exam: row.exams || null,
  }));

  return {
    notifications,
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Fetch a single notification by UUID for administrative editing.
 */
export async function getAdminNotificationById(
  id: string
): Promise<AdminNotificationListItem | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("notifications")
    .select("*, exams(id, title, conducting_body, category, state_or_central, slug)")
    .eq("id", id)
    .single();

  if (error || !data) {
    if (error && error.code !== "PGRST116") {
      console.error("[getAdminNotificationById] Query error:", error);
    }
    return null;
  }

  const row: any = data;
  return {
    ...row,
    exam: row.exams || null,
  };
}

/**
 * Fetch a lightweight list of all exams for the parent exam selector dropdown.
 */
export async function getExamOptionsForSelector(): Promise<ExamOption[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("exams")
    .select("id, title, conducting_body, category, state_or_central, slug")
    .order("title", { ascending: true });

  if (error || !data) {
    console.error("[getExamOptionsForSelector] Query error:", error);
    return [];
  }

  return data as ExamOption[];
}
