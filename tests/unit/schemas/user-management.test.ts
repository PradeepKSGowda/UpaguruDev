/**
 * @file tests/unit/schemas/user-management.test.ts
 * @description Unit tests for user management, role assignment, and candidate workspace Zod schemas.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 */

import { describe, it, expect } from "vitest";
import {
  userFilterSchema,
  userBlockStatusSchema,
  assignRoleSchema,
} from "@/lib/schemas/user-management";
import {
  accountSettingsSchema,
  bookmarkToggleSchema,
  examNoteSchema,
  examTrackingSchema,
} from "@/lib/schemas/candidate-workspace";

describe("User Management Schemas", () => {
  it("validates userFilterSchema with defaults", () => {
    const parsed = userFilterSchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
    expect(parsed.status).toBe("all");
    expect(parsed.role).toBe("all");
  });

  it("validates userFilterSchema custom inputs", () => {
    const parsed = userFilterSchema.parse({
      page: 3,
      pageSize: 50,
      search: "kpsc",
      role: "admin",
      status: "active",
    });
    expect(parsed.page).toBe(3);
    expect(parsed.pageSize).toBe(50);
    expect(parsed.search).toBe("kpsc");
    expect(parsed.role).toBe("admin");
    expect(parsed.status).toBe("active");
  });

  it("validates userBlockStatusSchema constraints", () => {
    const valid = userBlockStatusSchema.safeParse({
      userId: "123e4567-e89b-12d3-a456-426614174000",
      isBlocked: true,
      reason: "Suspicious automated crawler activity detected",
    });
    expect(valid.success).toBe(true);

    const invalidShortReason = userBlockStatusSchema.safeParse({
      userId: "123e4567-e89b-12d3-a456-426614174000",
      isBlocked: true,
      reason: "bad", // < 5 chars
    });
    expect(invalidShortReason.success).toBe(false);
  });

  it("validates assignRoleSchema role options", () => {
    const valid = assignRoleSchema.safeParse({
      userId: "123e4567-e89b-12d3-a456-426614174000",
      role: "admin",
      reason: "Promoting verified staff",
    });
    expect(valid.success).toBe(true);

    const invalidRole = assignRoleSchema.safeParse({
      userId: "123e4567-e89b-12d3-a456-426614174000",
      role: "god_mode", // Not in enum
    });
    expect(invalidRole.success).toBe(false);
  });
});

describe("Candidate Workspace Schemas", () => {
  it("validates accountSettingsSchema with valid Indian phone and pincode", () => {
    const valid = accountSettingsSchema.safeParse({
      firstName: "Ramesh",
      lastName: "Kumar",
      phone: "9876543210",
      pincode: "560001",
      category: "OBC",
      languagePreference: "kn",
    });
    expect(valid.success).toBe(true);
  });

  it("rejects invalid Indian phone format", () => {
    const invalidPhone = accountSettingsSchema.safeParse({
      firstName: "Ramesh",
      phone: "1234567890", // Does not start with 6-9
    });
    expect(invalidPhone.success).toBe(false);
  });

  it("rejects invalid pincode format", () => {
    const invalidPin = accountSettingsSchema.safeParse({
      firstName: "Ramesh",
      pincode: "012345", // PIN code in India doesn't start with 0
    });
    expect(invalidPin.success).toBe(false);
  });

  it("validates bookmarkToggleSchema", () => {
    const valid = bookmarkToggleSchema.safeParse({
      entityType: "notification",
      entityId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(valid.success).toBe(true);

    const invalidType = bookmarkToggleSchema.safeParse({
      entityType: "video",
      entityId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(invalidType.success).toBe(false);
  });

  it("validates examNoteSchema", () => {
    const valid = examNoteSchema.safeParse({
      title: "Prelims Ancient History Notes",
      content: "Indus Valley Civilization key sites: Harappa (Ravi), Mohenjodaro (Indus).",
      tags: ["history", "prelims"],
    });
    expect(valid.success).toBe(true);

    const emptyTitle = examNoteSchema.safeParse({
      title: "",
      content: "some content",
    });
    expect(emptyTitle.success).toBe(false);
  });

  it("validates examTrackingSchema", () => {
    const valid = examTrackingSchema.safeParse({
      notificationId: "123e4567-e89b-12d3-a456-426614174000",
      applicationSubmitted: true,
      applicationNumber: "KPSC2026/9021",
      feePaid: true,
      feeAmount: 500,
      hallTicketDownloaded: false,
      examAttended: false,
      resultStatus: "pending",
    });
    expect(valid.success).toBe(true);
  });
});
