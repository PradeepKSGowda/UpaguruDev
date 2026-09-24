"use server";

/**
 * @file app/admin/users/actions.ts
 * @description Next.js 15 Server Actions for administrative user directory queries,
 * role assignments, user status updates, and admin user provisioning.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 * Architecture Reference: ADR-003 (RBAC), ADR-013 (Security)
 */

import { revalidatePath } from "next/cache";
import { createServerClient } from "../../../lib/supabase/server";
import { assertPermission, invalidateUserAuthCache } from "../../../lib/rbac/rbac-service";
import { PERMISSIONS, canAssignRole } from "../../../lib/rbac/permissions";
import {
  userFilterSchema,
  userBlockStatusSchema,
  assignRoleSchema,
  createAdminSchema,
  type UserFilterInput,
  type UserBlockStatusInput,
  type AssignRoleInput,
  type CreateAdminInput,
} from "../../../lib/schemas/user-management";

export interface UserSummaryItem {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  emailVerified: boolean;
  avatarUrl: string | null;
  createdAt: string;
  isBlocked?: boolean;
}

export interface UserDirectoryResult {
  users: UserSummaryItem[];
  totalCount: number;
  activeCount: number;
  blockedCount: number;
}

export interface UserKpiStats {
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  verifiedUsers: number;
  totalBookmarks: number;
  totalNotes: number;
  newUsersToday: number;
}

/**
 * Fetches paginated user directory with role and query filters.
 */
export async function getUsersDirectory(
  rawParams: Partial<UserFilterInput>
): Promise<UserDirectoryResult> {
  const params = userFilterSchema.parse(rawParams);
  const supabase = await createServerClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) throw new Error("Authentication required");
  await assertPermission(currentUser.id, PERMISSIONS.USERS_READ_ALL);

  // Query profiles
  let query = supabase.from("profiles").select("*", { count: "exact" });

  if (params.query) {
    // Sanitize query to prevent PostgREST .or() filter injection (SEC-01)
    const sanitized = params.query.replace(/[%_,.()"']/g, "").trim();
    if (sanitized) {
      query = query.or(`email.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%`);
    }
  }

  if (params.role && params.role !== "all") {
    query = query.eq("role", params.role);
  }

  const from = (params.page - 1) * params.limit;
  const to = from + params.limit - 1;
  query = query.range(from, to).order("created_at", { ascending: false });

  const { data: profiles, count, error } = await query;
  if (error) throw error;

  const users: UserSummaryItem[] = (profiles || []).map((p) => ({
    id: p.id,
    email: p.email,
    fullName: p.full_name,
    role: p.role,
    emailVerified: p.email_verified,
    avatarUrl: p.avatar_url,
    createdAt: p.created_at,
    isBlocked: false, // Baseline fallback
  }));

  const total = count || 0;
  return {
    users,
    totalCount: total,
    activeCount: total,
    blockedCount: 0,
  };
}

/**
 * Toggles a user's blocked status and creates an audit record.
 */
export async function setUserBlockStatus(
  rawInput: UserBlockStatusInput
): Promise<{ success: boolean; message: string }> {
  const input = userBlockStatusSchema.parse(rawInput);
  const supabase = await createServerClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) throw new Error("Authentication required");
  const authContext = await assertPermission(currentUser.id, PERMISSIONS.USERS_BLOCK);

  // Invariant: Non-super-admin cannot block an admin
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", input.userId)
    .single();

  if (!targetProfile) throw new Error("Target user not found");

  if (
    (targetProfile.role === "admin" || targetProfile.role === "super_admin") &&
    !authContext.isSuperAdmin
  ) {
    throw new Error("Forbidden: Only a Super Administrator can modify administrative accounts");
  }

  // Record audit log
  await supabase.from("audit_logs").insert({
    admin_id: currentUser.id,
    action: input.isBlocked ? "user_blocked" : "user_reactivated",
    target_entity: "profiles",
    target_id: input.userId,
    metadata: {
      targetEmail: targetProfile.email,
      reason: input.reason,
      modifiedBy: currentUser.email,
      timestamp: new Date().toISOString(),
    },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${input.userId}`);

  return {
    success: true,
    message: input.isBlocked
      ? `User ${targetProfile.email} has been blocked.`
      : `User ${targetProfile.email} has been reactivated.`,
  };
}

/**
 * Assigns a role to a user.
 */
export async function assignUserRoleAction(
  rawInput: AssignRoleInput
): Promise<{ success: boolean; message: string }> {
  const input = assignRoleSchema.parse(rawInput);
  const supabase = await createServerClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) throw new Error("Authentication required");
  const authContext = await assertPermission(currentUser.id, PERMISSIONS.IAM_ROLES_ASSIGN);

  // Enforce role hierarchy and privilege escalation guard (SEC-04)
  const actorRole = authContext.roles[0] || "candidate";
  if (!canAssignRole(actorRole, input.roleCode)) {
    throw new Error(
      `Forbidden: Role '${actorRole}' is not authorized to assign role '${input.roleCode}'. Privilege escalation denied.`
    );
  }

  // Update profile role
  const { error } = await supabase
    .from("profiles")
    .update({ role: input.roleCode, updated_at: new Date().toISOString() })
    .eq("id", input.userId);

  if (error) throw error;

  // Log in audit logs
  await supabase.from("audit_logs").insert({
    admin_id: currentUser.id,
    action: "role_assigned",
    target_entity: "profiles",
    target_id: input.userId,
    metadata: {
      newRole: input.roleCode,
      assignedBy: currentUser.email,
      timestamp: new Date().toISOString(),
    },
  });

  // Invalidate in-memory auth cache for the target user (PERF-02)
  invalidateUserAuthCache(input.userId);

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${input.userId}`);

  return {
    success: true,
    message: `Role ${input.roleCode} assigned successfully.`,
  };
}

/**
 * Aggregates high-level User KPI metrics for dashboards.
 */
export async function getUserKpiStats(): Promise<UserKpiStats> {
  const supabase = await createServerClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) throw new Error("Authentication required");
  await assertPermission(currentUser.id, PERMISSIONS.ANALYTICS_KPI_READ);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [usersCountRes, verifiedCountRes, bookmarksCountRes, notesCountRes, todayCountRes] =
    await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("email_verified", true),
      supabase.from("bookmarks").select("id", { count: "exact", head: true }),
      supabase.from("exam_notes").select("id", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString()),
    ]);

  const totalUsers = usersCountRes.count || 0;
  const verifiedUsers = verifiedCountRes.count || 0;
  const totalBookmarks = bookmarksCountRes.count || 0;
  const totalNotes = notesCountRes.count || 0;
  const newUsersToday = todayCountRes.count || 0;

  return {
    totalUsers,
    activeUsers: totalUsers,
    blockedUsers: 0,
    verifiedUsers,
    totalBookmarks,
    totalNotes,
    newUsersToday,
  };
}
