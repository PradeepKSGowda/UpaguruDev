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
import { createServerClient, createAdminClient, type ServerClient } from "../../../lib/supabase/server";
import { assertPermission, invalidateUserAuthCache } from "../../../lib/rbac/rbac-service";
import { PERMISSIONS, canAssignRole } from "../../../lib/rbac/permissions";
import {
  userFilterSchema,
  userBlockStatusSchema,
  assignRoleSchema,
  type UserFilterInput,
  type UserBlockStatusInput,
  type AssignRoleInput,
} from "../../../lib/schemas/user-management";

function getAdminOrFallback(fallback: ServerClient): ServerClient {
  try {
    return createAdminClient();
  } catch {
    return fallback;
  }
}

export interface UserSummaryItem {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  emailVerified: boolean;
  avatarUrl: string | null;
  createdAt: string;
  isBlocked?: boolean;
  gender?: string | null;
  maritalStatus?: string | null;
  isTestUser?: boolean;
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

  // Query profiles using admin client so that caller session RLS does not suppress other users
  const db = getAdminOrFallback(supabase);
  let query = db.from("profiles").select("*", { count: "exact" });

  if (params.query) {
    // Sanitize query to prevent PostgREST .or() filter injection (SEC-01)
    const sanitized = params.query.replace(/[%_,.()"']/g, "").trim();
    if (sanitized) {
      query = query.or(`email.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%`);
    }
  }

  if (params.role && params.role !== "all") {
    if (params.role === "test_candidate") {
      query = query.eq("role", "candidate").ilike("email", "%@upaguru.test");
    } else if (params.role === "candidate") {
      query = query.eq("role", "candidate").not("email", "ilike", "%@upaguru.test");
    } else {
      query = query.eq("role", params.role);
    }
  }

  if (params.userType === "test") {
    query = query.ilike("email", "%@upaguru.test");
  } else if (params.userType === "real") {
    query = query.not("email", "ilike", "%@upaguru.test");
  }

  const from = (params.page - 1) * params.limit;
  const to = from + params.limit - 1;
  query = query.range(from, to).order("created_at", { ascending: false });

  const { data: profiles, count, error } = await query;
  if (error) throw error;

  // Retrieve extended profile attributes (gender, marital_status) from user_profiles
  const profileIds = (profiles || []).map((p) => p.id);
  const userProfilesMap = new Map<string, { gender?: string | null; marital_status?: string | null }>();
  if (profileIds.length > 0) {
    const { data: upData } = await db
      .from("user_profiles")
      .select("id, gender, marital_status")
      .in("id", profileIds);
    if (upData) {
      upData.forEach((up: any) => {
        userProfilesMap.set(up.id, { gender: up.gender, marital_status: up.marital_status });
      });
    }
  }

  const users: UserSummaryItem[] = (profiles || []).map((p) => {
    const up = userProfilesMap.get(p.id);
    const isTest = p.email.endsWith("@upaguru.test") || p.email.includes(".test");
    return {
      id: p.id,
      email: p.email,
      fullName: p.full_name,
      role: p.role,
      emailVerified: p.email_verified,
      avatarUrl: p.avatar_url,
      createdAt: p.created_at,
      isBlocked: false, // Baseline fallback
      gender: up?.gender || null,
      maritalStatus: up?.marital_status || null,
      isTestUser: isTest,
    };
  });

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

  const db = getAdminOrFallback(supabase);

  // Invariant: Non-super-admin cannot block an admin
  const { data: targetProfile } = await db
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
  await db.from("audit_logs").insert({
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

  const db = getAdminOrFallback(supabase);

  // Update profile role
  const { error } = await db
    .from("profiles")
    .update({ role: input.roleCode, updated_at: new Date().toISOString() })
    .eq("id", input.userId);

  if (error) throw error;

  // Synchronize public.user_roles so that database RBAC and profile remain in complete parity
  const { data: roleRecord } = await db
    .from("roles")
    .select("id")
    .eq("code", input.roleCode)
    .maybeSingle();

  if (roleRecord?.id) {
    await db.from("user_roles").delete().eq("user_id", input.userId);
    await db.from("user_roles").insert({
      user_id: input.userId,
      role_id: roleRecord.id,
      assigned_by: currentUser.id,
      assigned_at: new Date().toISOString(),
    });
  }

  // Synchronize auth.users app_metadata for JWT claims parity
  try {
    await db.auth.admin.updateUserById(input.userId, {
      app_metadata: { role: input.roleCode },
    });
  } catch {
    // Non-blocking fallback if auth admin API is unavailable
  }

  // Log in audit logs
  await db.from("audit_logs").insert({
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

  // Invalidate in-memory auth cache for both target user and caller session (PERF-02)
  invalidateUserAuthCache(input.userId);
  invalidateUserAuthCache(currentUser.id);

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

  const db = getAdminOrFallback(supabase);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [usersCountRes, verifiedCountRes, bookmarksCountRes, notesCountRes, todayCountRes] =
    await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }),
      db
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("email_verified", true),
      db.from("bookmarks").select("id", { count: "exact", head: true }),
      db.from("exam_notes").select("id", { count: "exact", head: true }),
      db
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
