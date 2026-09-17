/**
 * @file lib/data/exams.ts
 * @module ExamDataAccess
 * @description Data access functions for administrative Exam CRUD management.
 * 
 * Task ID: TASK-03030101 (Subtasks: SUB-0303010101, SUB-0303010102)
 * Architecture Reference: ADR-001 (Frontend Architecture), ADR-002 (Database)
 */

import { createServerClient } from "@/lib/supabase/server";
import { ValidatedExamFilter } from "@/lib/schemas/exams";
import { Database } from "@/types/database.types";

export type ExamRow = Database["public"]["Tables"]["exams"]["Row"];

export interface AdminExamListItem extends ExamRow {
  notificationCount: number;
}

export interface AdminExamsResponse {
  exams: AdminExamListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Retrieve paginated exams with search, category filtering, and linked notification counts.
 */
export async function getAdminExams(
  filter: Partial<ValidatedExamFilter> = {}
): Promise<AdminExamsResponse> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filter.pageSize ?? 15));
  const offset = (page - 1) * pageSize;

  const supabase = await createServerClient();

  let query = supabase
    .from("exams")
    .select("*, notifications(count)", { count: "exact" });

  // Apply search across title and conducting body
  if (filter.search && filter.search.trim().length > 0) {
    const term = filter.search.trim();
    query = query.or(`title.ilike.%${term}%,conducting_body.ilike.%${term}%,slug.ilike.%${term}%`);
  }

  // Apply category filter
  if (filter.category && filter.category !== "all") {
    query = query.eq("category", filter.category);
  }

  // Order by newest first
  query = query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error("[getAdminExams] Query error:", error);
    return {
      exams: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  const total = count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  // Normalize notification count
  const exams: AdminExamListItem[] = (data || []).map((row: any) => {
    let notificationCount = 0;
    if (Array.isArray(row.notifications) && row.notifications[0]) {
      notificationCount = Number(row.notifications[0].count) || 0;
    }
    return {
      ...row,
      notificationCount,
    };
  });

  return {
    exams,
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Fetch a single exam by ID with linked notification count.
 */
export async function getAdminExamById(id: string): Promise<AdminExamListItem | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("exams")
    .select("*, notifications(count)")
    .eq("id", id)
    .single();

  if (error || !data) {
    if (error && error.code !== "PGRST116") {
      console.error("[getAdminExamById] Query error:", error);
    }
    return null;
  }

  const row: any = data;
  let notificationCount = 0;
  if (Array.isArray(row.notifications) && row.notifications[0]) {
    notificationCount = Number(row.notifications[0].count) || 0;
  }

  return {
    ...row,
    notificationCount,
  };
}
