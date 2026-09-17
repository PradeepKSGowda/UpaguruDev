/**
 * @file lib/data/audit-logs.ts
 * @module AuditLogDataAccess
 * @description Data access functions for querying forensic administrative audit logs.
 * 
 * Task ID: TASK-03040101 (Subtask: SUB-0304010101)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-002 (Database)
 */

import { createServerClient } from "@/lib/supabase/server";
import { ValidatedAuditLogFilter } from "@/lib/schemas/audit-logs";
import { Database } from "@/types/database.types";

export type AuditLogRow = Database["public"]["Tables"]["audit_logs"]["Row"];

export interface AdminSummary {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
}

export interface AuditLogEntry extends Omit<AuditLogRow, "metadata"> {
  metadata: Record<string, unknown> | null;
  admin: AdminSummary | null;
}

export interface AuditLogsResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Retrieve paginated audit logs with action filters, date ranges, and resolved admin profiles.
 */
export async function getAuditLogs(
  filter: Partial<ValidatedAuditLogFilter> = {}
): Promise<AuditLogsResponse> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filter.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const supabase = await createServerClient();

  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" });

  // Apply action filter
  if (filter.action && filter.action !== "all") {
    query = query.eq("action", filter.action);
  }

  // Apply entity filter
  if (filter.targetEntity && filter.targetEntity !== "all") {
    query = query.eq("target_entity", filter.targetEntity);
  }

  // Apply admin filter
  if (filter.adminId) {
    query = query.eq("admin_id", filter.adminId);
  }

  // Apply date range filters
  if (filter.startDate) {
    query = query.gte("created_at", `${filter.startDate}T00:00:00.000Z`);
  }
  if (filter.endDate) {
    query = query.lte("created_at", `${filter.endDate}T23:59:59.999Z`);
  }

  // Apply search query
  if (filter.search && filter.search.trim().length > 0) {
    const term = filter.search.trim();
    query = query.or(`action.ilike.%${term}%,target_entity.ilike.%${term}%,target_id.ilike.%${term}%`);
  }

  // Order chronologically descending
  query = query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error("[getAuditLogs] Query error:", error);
    return {
      logs: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  const rawLogs = data || [];
  const total = count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  // Batch resolve admin profiles
  const uniqueAdminIds = Array.from(new Set(rawLogs.map((l) => l.admin_id))).filter(Boolean);
  const adminMap = new Map<string, AdminSummary>();

  if (uniqueAdminIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, avatar_url")
      .in("id", uniqueAdminIds);

    if (!profileError && profiles) {
      for (const p of profiles) {
        adminMap.set(p.id, {
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          role: p.role,
          avatar_url: p.avatar_url,
        });
      }
    }
  }

  // Map logs with admin info and parse JSON metadata
  const logs: AuditLogEntry[] = rawLogs.map((row) => {
    let parsedMetadata: Record<string, unknown> | null = null;
    if (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)) {
      parsedMetadata = row.metadata as Record<string, unknown>;
    }

    return {
      id: row.id,
      admin_id: row.admin_id,
      action: row.action,
      target_entity: row.target_entity,
      target_id: row.target_id,
      created_at: row.created_at,
      metadata: parsedMetadata,
      admin: adminMap.get(row.admin_id) || null,
    };
  });

  return {
    logs,
    total,
    page,
    pageSize,
    totalPages,
  };
}
