/**
 * @file lib/rbac/permissions.ts
 * @description Centralized, strongly-typed permission codes, role taxonomies,
 * and authorization invariants for the UPA-GURU enterprise RBAC subsystem.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 * Architecture Reference: ADR-003 (RBAC), ADR-013 (Security)
 */

export const PERMISSIONS = {
  // Identity & Access Management (IAM)
  IAM_ROLES_MANAGE: "iam:roles:manage",
  IAM_ROLES_ASSIGN: "iam:roles:assign",
  IAM_PERMISSIONS_MANAGE: "iam:permissions:manage",

  // User Management
  USERS_CREATE: "users:create",
  USERS_READ_ALL: "users:read:all",
  USERS_UPDATE_ANY: "users:update:any",
  USERS_BLOCK: "users:block",
  USERS_DELETE_SOFT: "users:delete:soft",
  USERS_EXPORT: "users:export",

  // Administrative Governance
  ADMIN_CREATE: "admin:create",
  ADMIN_SUSPEND: "admin:suspend",
  ADMIN_DELETE: "admin:delete",

  // Audit & Telemetry
  AUDIT_LOGS_READ: "audit:logs:read",
  ANALYTICS_KPI_READ: "analytics:kpi:read",

  // Scrapers & Crawlers
  SCRAPERS_VIEW: "scrapers:view",
  SCRAPERS_RUN: "scrapers:run",

  // Notifications & Drafts
  NOTIFICATIONS_VIEW: "notifications:view",
  NOTIFICATIONS_REVIEW: "notifications:review",
  DRAFTS_REVIEW: "drafts:review",

  // Candidate Self-Service Workspace
  PROFILE_SELF: "profile:self",
  BOOKMARKS_SELF: "bookmarks:self",
  NOTES_SELF: "notes:self",
  TRACKING_SELF: "tracking:self",
} as const;

export type PermissionCode = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export const STANDARD_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  MODERATOR: "moderator",
  SUPPORT: "support",
  CANDIDATE: "candidate",
} as const;

export type StandardRoleCode = typeof STANDARD_ROLES[keyof typeof STANDARD_ROLES];

/**
 * Maps default roles to their baseline permission allowances.
 * Used for in-memory assertions, fallback evaluation, and database seeding.
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<StandardRoleCode, PermissionCode[]> = {
  super_admin: Object.values(PERMISSIONS) as PermissionCode[],
  admin: [
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_READ_ALL,
    PERMISSIONS.USERS_UPDATE_ANY,
    PERMISSIONS.USERS_BLOCK,
    PERMISSIONS.USERS_EXPORT,
    PERMISSIONS.AUDIT_LOGS_READ,
    PERMISSIONS.ANALYTICS_KPI_READ,
    PERMISSIONS.SCRAPERS_VIEW,
    PERMISSIONS.SCRAPERS_RUN,
    PERMISSIONS.NOTIFICATIONS_VIEW,
    PERMISSIONS.NOTIFICATIONS_REVIEW,
    PERMISSIONS.DRAFTS_REVIEW,
    PERMISSIONS.PROFILE_SELF,
    PERMISSIONS.BOOKMARKS_SELF,
    PERMISSIONS.NOTES_SELF,
    PERMISSIONS.TRACKING_SELF,
  ],
  moderator: [
    PERMISSIONS.SCRAPERS_VIEW,
    PERMISSIONS.NOTIFICATIONS_VIEW,
    PERMISSIONS.NOTIFICATIONS_REVIEW,
    PERMISSIONS.DRAFTS_REVIEW,
    PERMISSIONS.PROFILE_SELF,
    PERMISSIONS.BOOKMARKS_SELF,
    PERMISSIONS.NOTES_SELF,
    PERMISSIONS.TRACKING_SELF,
  ],
  support: [
    PERMISSIONS.USERS_READ_ALL,
    PERMISSIONS.NOTIFICATIONS_VIEW,
    PERMISSIONS.PROFILE_SELF,
    PERMISSIONS.BOOKMARKS_SELF,
    PERMISSIONS.NOTES_SELF,
    PERMISSIONS.TRACKING_SELF,
  ],
  candidate: [
    PERMISSIONS.NOTIFICATIONS_VIEW,
    PERMISSIONS.PROFILE_SELF,
    PERMISSIONS.BOOKMARKS_SELF,
    PERMISSIONS.NOTES_SELF,
    PERMISSIONS.TRACKING_SELF,
  ],
};

/**
 * Determines whether a role is authorized to perform an action based on static matrix.
 */
export function isRoleAuthorized(role: string, permission: PermissionCode): boolean {
  const perms = ROLE_DEFAULT_PERMISSIONS[role as StandardRoleCode];
  if (!perms) return false;
  return perms.includes(permission);
}

/**
 * Prevents privilege escalation:
 * - Super admin can assign any role.
 * - Admin can assign moderator, support, candidate (cannot assign super_admin or admin).
 * - Others cannot assign any role.
 */
export function canAssignRole(actorRole: string, targetRole: string): boolean {
  if (actorRole === STANDARD_ROLES.SUPER_ADMIN) return true;
  if (actorRole === STANDARD_ROLES.ADMIN) {
    return targetRole === STANDARD_ROLES.MODERATOR ||
      targetRole === STANDARD_ROLES.SUPPORT ||
      targetRole === STANDARD_ROLES.CANDIDATE;
  }
  return false;
}
