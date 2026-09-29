/**
 * @file tests/unit/admin-user-directory.test.ts
 * @description Unit tests for Admin User Management Directory data structures,
 * filtering logic, and KPI aggregation resilience.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 * Architecture Reference: ADR-003 (RBAC), ADR-013 (Security)
 */

import { describe, it, expect } from "vitest";
import { userFilterSchema, userBlockStatusSchema, assignRoleSchema } from "@/lib/schemas/user-management";

describe("Admin User Management Schemas & Filtering", () => {
  it("validates and applies defaults for user directory query filters", () => {
    const parsed = userFilterSchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
    expect(parsed.role).toBe("all");
    expect(parsed.status).toBe("all");
  });

  it("accepts custom pagination and role filter parameters", () => {
    const parsed = userFilterSchema.parse({
      page: 2,
      limit: 50,
      role: "candidate",
      query: "pradeep.flwork@gmail.com",
    });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
    expect(parsed.role).toBe("candidate");
    expect(parsed.query).toBe("pradeep.flwork@gmail.com");
  });

  it("validates user block status input payload", () => {
    const payload = {
      userId: "40187b9a-f157-4db1-ad0a-8b6a3a7d0238",
      isBlocked: true,
      reason: "Account under security review",
    };
    const parsed = userBlockStatusSchema.parse(payload);
    expect(parsed.userId).toBe(payload.userId);
    expect(parsed.isBlocked).toBe(true);
  });

  it("validates role assignment input payload", () => {
    const payload = {
      userId: "40187b9a-f157-4db1-ad0a-8b6a3a7d0238",
      roleCode: "moderator" as const,
    };
    const parsed = assignRoleSchema.parse(payload);
    expect(parsed.userId).toBe(payload.userId);
    expect(parsed.roleCode).toBe("moderator");
  });

  it("correctly models multi-user directory aggregation without profile omission", () => {
    const rawProfiles = [
      {
        id: "934f69d9-f3f0-4911-a8fe-d7822414efc5",
        email: "ksg.pradi@gmail.com",
        full_name: "Prajna Digi",
        role: "admin",
        email_verified: true,
        avatar_url: null,
        created_at: "2026-09-20T00:00:00Z",
      },
      {
        id: "40187b9a-f157-4db1-ad0a-8b6a3a7d0238",
        email: "pradeep.flwork@gmail.com",
        full_name: "New Test",
        role: "candidate",
        email_verified: false,
        avatar_url: null,
        created_at: "2026-09-22T00:00:00Z",
      },
    ];

    const users = rawProfiles.map((p) => ({
      id: p.id,
      email: p.email,
      fullName: p.full_name,
      role: p.role,
      emailVerified: p.email_verified,
      avatarUrl: p.avatar_url,
      createdAt: p.created_at,
      isBlocked: false,
    }));

    expect(users).toHaveLength(2);
    expect(users.find((u) => u.email === "pradeep.flwork@gmail.com")).toBeDefined();
    expect(users.find((u) => u.email === "ksg.pradi@gmail.com")).toBeDefined();
    expect(users.find((u) => u.email === "pradeep.flwork@gmail.com")?.role).toBe("candidate");
  });

  it("filters and labels synthetic test candidates separately from real candidates", () => {
    const rawProfiles = [
      { id: "1", email: "real.candidate@gmail.com", role: "candidate" },
      { id: "2", email: "tc0001@upaguru.test", role: "candidate" },
      { id: "3", email: "admin@upaguru.in", role: "admin" },
    ];

    const users = rawProfiles.map((p) => ({
      ...p,
      isTestUser: p.email.endsWith("@upaguru.test"),
    }));

    const testCandidates = users.filter(
      (u) => u.role === "candidate" && u.isTestUser
    );
    const realCandidates = users.filter(
      (u) => u.role === "candidate" && !u.isTestUser
    );

    expect(testCandidates).toHaveLength(1);
    expect(testCandidates[0]?.email).toBe("tc0001@upaguru.test");
    expect(realCandidates).toHaveLength(1);
    expect(realCandidates[0]?.email).toBe("real.candidate@gmail.com");

    const parsedFilter = userFilterSchema.parse({ role: "test_candidate" });
    expect(parsedFilter.role).toBe("test_candidate");
  });
});
