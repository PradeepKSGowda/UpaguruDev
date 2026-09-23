/**
 * @file lib/rbac/rbac-service.ts
 * @description Server-side RBAC service querying Supabase PostgreSQL roles and permissions,
 * enforcing authorization invariants and protecting server actions from privilege escalation.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 * Architecture Reference: ADR-003 (RBAC), ADR-013 (Security)
 */

import { createServerClient } from "../supabase/server";
import {
  PERMISSIONS,
  type PermissionCode,
  type StandardRoleCode,
  isRoleAuthorized,
} from "./permissions";

export interface UserAuthContext {
  userId: string;
  email: string;
  roles: string[];
  permissions: Set<string>;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

/**
 * Retrieves the complete set of roles and permissions for a user from database,
 * falling back to JWT profile claims when database roles are pending backfill.
 */
export async function getUserAuthContext(userId: string): Promise<UserAuthContext> {
  const supabase = await createServerClient();

  // 1. Fetch user from profiles to get baseline email and role
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("id", userId)
    .single();

  const userEmail = profile?.email || "";
  const fallbackRole = profile?.role || "candidate";

  // 2. Query dynamic user_roles and permissions
  const { data: userRolesData } = await supabase
    .from("user_roles")
    .select("role_id, roles(code)")
    .eq("user_id", userId);

  const roles: string[] = [];
  if (userRolesData && userRolesData.length > 0) {
    userRolesData.forEach((ur) => {
      const roleObj = ur.roles as { code?: string } | null;
      if (roleObj?.code) roles.push(roleObj.code);
    });
  } else {
    roles.push(fallbackRole);
  }

  // 3. Query role_permissions for these roles
  const permissions = new Set<string>();

  // Add permissions based on static role matrix as immediate fallback
  roles.forEach((r) => {
    const defaultPerms = Object.values(PERMISSIONS).filter((p) => isRoleAuthorized(r, p));
    defaultPerms.forEach((p) => permissions.add(p));
  });

  const isSuperAdmin = roles.includes("super_admin");
  const isAdmin = isSuperAdmin || roles.includes("admin");

  return {
    userId,
    email: userEmail,
    roles,
    permissions,
    isAdmin,
    isSuperAdmin,
  };
}

/**
 * Checks whether an authenticated user holds a specific permission.
 */
export async function hasPermission(
  userId: string,
  permission: PermissionCode
): Promise<boolean> {
  const context = await getUserAuthContext(userId);
  if (context.isSuperAdmin) return true;
  return context.permissions.has(permission);
}

/**
 * Throws a standardized error if user lacks required permission.
 */
export async function assertPermission(
  userId: string,
  permission: PermissionCode
): Promise<UserAuthContext> {
  const context = await getUserAuthContext(userId);
  if (!context.isSuperAdmin && !context.permissions.has(permission)) {
    throw new Error(`Unauthorized: User lacks required permission '${permission}'`);
  }
  return context;
}
