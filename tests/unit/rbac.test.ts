/**
 * @file tests/unit/rbac.test.ts
 * @description Unit tests for Role-Based Access Control (RBAC) permission resolution,
 * role hierarchy, and privilege escalation guards.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 * Architecture Reference: ADR-003 (RBAC)
 */

import { describe, it, expect } from "vitest";
import {
  PERMISSIONS,
  STANDARD_ROLES,
  ROLE_DEFAULT_PERMISSIONS,
  ROLE_PERMISSION_SETS,
  isRoleAuthorized,
  canAssignRole,
} from "@/lib/rbac/permissions";
import { invalidateUserAuthCache } from "@/lib/rbac/rbac-service";

describe("RBAC Permissions & Roles Matrix", () => {
  it("defines standard system roles correctly", () => {
    expect(STANDARD_ROLES.SUPER_ADMIN).toBe("super_admin");
    expect(STANDARD_ROLES.ADMIN).toBe("admin");
    expect(STANDARD_ROLES.MODERATOR).toBe("moderator");
    expect(STANDARD_ROLES.SUPPORT).toBe("support");
    expect(STANDARD_ROLES.CANDIDATE).toBe("candidate");
    expect(ROLE_DEFAULT_PERMISSIONS[STANDARD_ROLES.SUPER_ADMIN].length).toBeGreaterThan(0);
  });

  it("grants super_admin universal permissions", () => {
    // Every permission in PERMISSIONS must be authorized for super_admin
    Object.values(PERMISSIONS).forEach((permission) => {
      expect(isRoleAuthorized(STANDARD_ROLES.SUPER_ADMIN, permission)).toBe(true);
    });
  });

  it("grants admin full operational permissions except super_admin specific rights", () => {
    expect(isRoleAuthorized(STANDARD_ROLES.ADMIN, PERMISSIONS.USERS_READ_ALL)).toBe(true);
    expect(isRoleAuthorized(STANDARD_ROLES.ADMIN, PERMISSIONS.USERS_BLOCK)).toBe(true);
    expect(isRoleAuthorized(STANDARD_ROLES.ADMIN, PERMISSIONS.SCRAPERS_RUN)).toBe(true);
    expect(isRoleAuthorized(STANDARD_ROLES.ADMIN, PERMISSIONS.AUDIT_LOGS_READ)).toBe(true);

    // Admin cannot assign system roles or manage permissions (reserved for super_admin)
    expect(isRoleAuthorized(STANDARD_ROLES.ADMIN, PERMISSIONS.IAM_ROLES_ASSIGN)).toBe(false);
    expect(isRoleAuthorized(STANDARD_ROLES.ADMIN, PERMISSIONS.IAM_PERMISSIONS_MANAGE)).toBe(false);
  });

  it("restricts moderator permissions to drafting and notifications", () => {
    // Moderators can review drafts and notifications
    expect(isRoleAuthorized(STANDARD_ROLES.MODERATOR, PERMISSIONS.NOTIFICATIONS_REVIEW)).toBe(true);
    expect(isRoleAuthorized(STANDARD_ROLES.MODERATOR, PERMISSIONS.DRAFTS_REVIEW)).toBe(true);

    // Moderators cannot manage users or run crawlers
    expect(isRoleAuthorized(STANDARD_ROLES.MODERATOR, PERMISSIONS.USERS_READ_ALL)).toBe(false);
    expect(isRoleAuthorized(STANDARD_ROLES.MODERATOR, PERMISSIONS.USERS_BLOCK)).toBe(false);
    expect(isRoleAuthorized(STANDARD_ROLES.MODERATOR, PERMISSIONS.IAM_ROLES_ASSIGN)).toBe(false);
    expect(isRoleAuthorized(STANDARD_ROLES.MODERATOR, PERMISSIONS.SCRAPERS_RUN)).toBe(false);
  });

  it("restricts candidate permissions strictly to candidate workspace", () => {
    // Candidate cannot access administrative or moderation features
    expect(isRoleAuthorized(STANDARD_ROLES.CANDIDATE, PERMISSIONS.USERS_READ_ALL)).toBe(false);
    expect(isRoleAuthorized(STANDARD_ROLES.CANDIDATE, PERMISSIONS.USERS_BLOCK)).toBe(false);
    expect(isRoleAuthorized(STANDARD_ROLES.CANDIDATE, PERMISSIONS.AUDIT_LOGS_READ)).toBe(false);
    expect(isRoleAuthorized(STANDARD_ROLES.CANDIDATE, PERMISSIONS.SCRAPERS_VIEW)).toBe(false);
    expect(isRoleAuthorized(STANDARD_ROLES.CANDIDATE, PERMISSIONS.IAM_ROLES_MANAGE)).toBe(false);

    // Candidate can view published notifications
    expect(isRoleAuthorized(STANDARD_ROLES.CANDIDATE, PERMISSIONS.NOTIFICATIONS_VIEW)).toBe(true);
  });

  it("enforces privilege escalation protection with canAssignRole", () => {
    // Super admin can assign any role
    expect(canAssignRole(STANDARD_ROLES.SUPER_ADMIN, STANDARD_ROLES.ADMIN)).toBe(true);
    expect(canAssignRole(STANDARD_ROLES.SUPER_ADMIN, STANDARD_ROLES.SUPER_ADMIN)).toBe(true);

    // Admin cannot assign super_admin or admin
    expect(canAssignRole(STANDARD_ROLES.ADMIN, STANDARD_ROLES.SUPER_ADMIN)).toBe(false);
    expect(canAssignRole(STANDARD_ROLES.ADMIN, STANDARD_ROLES.ADMIN)).toBe(false);

    // Admin can assign candidate, moderator, support
    expect(canAssignRole(STANDARD_ROLES.ADMIN, STANDARD_ROLES.CANDIDATE)).toBe(true);
    expect(canAssignRole(STANDARD_ROLES.ADMIN, STANDARD_ROLES.MODERATOR)).toBe(true);
    expect(canAssignRole(STANDARD_ROLES.ADMIN, STANDARD_ROLES.SUPPORT)).toBe(true);

    // Candidate cannot assign any role
    expect(canAssignRole(STANDARD_ROLES.CANDIDATE, STANDARD_ROLES.CANDIDATE)).toBe(false);
  });

  it("precomputes ROLE_PERMISSION_SETS as Set objects for O(1) membership checks (PERF-01)", () => {
    Object.keys(STANDARD_ROLES).forEach((key) => {
      const role = STANDARD_ROLES[key as keyof typeof STANDARD_ROLES];
      const permSet = ROLE_PERMISSION_SETS[role];
      expect(permSet).toBeInstanceOf(Set);
      expect(permSet.size).toBe(ROLE_DEFAULT_PERMISSIONS[role].length);
    });
  });

  it("supports in-memory cache invalidation without throwing errors (PERF-02)", () => {
    expect(() => invalidateUserAuthCache("test-user-id")).not.toThrow();
    expect(() => invalidateUserAuthCache()).not.toThrow();
  });
});
