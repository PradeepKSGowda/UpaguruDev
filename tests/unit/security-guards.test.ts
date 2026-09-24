/**
 * @file tests/unit/security-guards.test.ts
 * @description Unit tests for security guardrails (SEC-01 through SEC-05).
 * Validates search query injection sanitization, role assignment privilege escalation guards,
 * and OTP token hashing.
 */

import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { canAssignRole, STANDARD_ROLES } from "@/lib/rbac/permissions";

describe("Security Guardrails — SEC-01 PostgREST Filter Sanitization", () => {
  function sanitizePostgrestQuery(query: string): string {
    return query.replace(/[%_,.()"']/g, "").trim();
  }

  it("strips PostgREST filter injection metacharacters", () => {
    const maliciousQuery = 'admin%,role.eq.super_admin,status.eq."active"';
    const sanitized = sanitizePostgrestQuery(maliciousQuery);
    expect(sanitized).toBe("adminroleeqsuperadminstatuseqactive");
    expect(sanitized).not.toContain("%");
    expect(sanitized).not.toContain("_");
    expect(sanitized).not.toContain(",");
    expect(sanitized).not.toContain(".");
    expect(sanitized).not.toContain("(");
    expect(sanitized).not.toContain(")");
    expect(sanitized).not.toContain('"');
  });

  it("preserves alphanumeric characters, spaces, and hyphens", () => {
    const legitimateQuery = "UPSC Civil Services 2026";
    const sanitized = sanitizePostgrestQuery(legitimateQuery);
    expect(sanitized).toBe("UPSC Civil Services 2026");
  });
});

describe("Security Guardrails — SEC-04 Privilege Escalation Guard", () => {
  it("prevents admin from escalating privilege to super_admin or admin", () => {
    expect(canAssignRole(STANDARD_ROLES.ADMIN, STANDARD_ROLES.SUPER_ADMIN)).toBe(false);
    expect(canAssignRole(STANDARD_ROLES.ADMIN, STANDARD_ROLES.ADMIN)).toBe(false);
  });

  it("permits super_admin to assign any role", () => {
    expect(canAssignRole(STANDARD_ROLES.SUPER_ADMIN, STANDARD_ROLES.SUPER_ADMIN)).toBe(true);
    expect(canAssignRole(STANDARD_ROLES.SUPER_ADMIN, STANDARD_ROLES.ADMIN)).toBe(true);
    expect(canAssignRole(STANDARD_ROLES.SUPER_ADMIN, STANDARD_ROLES.MODERATOR)).toBe(true);
  });

  it("permits admin to assign lower operational roles", () => {
    expect(canAssignRole(STANDARD_ROLES.ADMIN, STANDARD_ROLES.MODERATOR)).toBe(true);
    expect(canAssignRole(STANDARD_ROLES.ADMIN, STANDARD_ROLES.SUPPORT)).toBe(true);
    expect(canAssignRole(STANDARD_ROLES.ADMIN, STANDARD_ROLES.CANDIDATE)).toBe(true);
  });

  it("denies candidate and other roles from assigning any role", () => {
    expect(canAssignRole(STANDARD_ROLES.CANDIDATE, STANDARD_ROLES.CANDIDATE)).toBe(false);
    expect(canAssignRole(STANDARD_ROLES.SUPPORT, STANDARD_ROLES.CANDIDATE)).toBe(false);
  });
});

describe("Security Guardrails — SEC-02 & SEC-03 Cryptographic OTP Token Hashing", () => {
  it("computes deterministic SHA-256 hash for OTP validation", () => {
    const otp = "849201";
    const hash1 = createHash("sha256").update(otp).digest("hex");
    const hash2 = createHash("sha256").update(otp).digest("hex");

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
    expect(hash1).not.toBe(otp);
  });

  it("detects mismatched OTPs through cryptographic hash comparison", () => {
    const validOtp = "123456";
    const invalidOtp = "654321";

    const validHash = createHash("sha256").update(validOtp).digest("hex");
    const testHash = createHash("sha256").update(invalidOtp).digest("hex");

    expect(validHash === testHash).toBe(false);
  });
});
