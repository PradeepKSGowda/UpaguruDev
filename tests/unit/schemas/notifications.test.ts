/**
 * @file tests/unit/schemas/notifications.test.ts
 * @description Unit tests for public candidate portal notification feed validation schemas.
 * 
 * Task ID: TASK-09010102 (Subtask: SUB-0901010201)
 * Architecture Reference: ADR-001, ADR-002, AGENTS.md (Rule 1 & Rule 2)
 */

import { describe, it, expect } from "vitest";
import {
  notificationFilterSchema,
  EXAM_CATEGORIES,
  NOTIFICATION_SORT_OPTIONS,
} from "@/lib/schemas/notifications";

describe("notificationFilterSchema", () => {
  it("TC-NOTIF-01: should pass with empty input and apply default filter parameters", () => {
    const result = notificationFilterSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe("all");
      expect(result.data.state).toBe("all");
      expect(result.data.search).toBe("");
      expect(result.data.sortBy).toBe("deadline_soonest");
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(12);
    }
  });

  it("TC-NOTIF-02: should pass with valid explicit values and coerce numeric query strings", () => {
    const input = {
      category: "civil_services",
      state: "Karnataka",
      search: "Probationers 2026",
      sortBy: "vacancies_high_low",
      page: "3",
      pageSize: "24",
    };

    const result = notificationFilterSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe("civil_services");
      expect(result.data.state).toBe("Karnataka");
      expect(result.data.search).toBe("Probationers 2026");
      expect(result.data.sortBy).toBe("vacancies_high_low");
      expect(result.data.page).toBe(3);
      expect(result.data.pageSize).toBe(24);
    }
  });

  it("TC-NOTIF-03: should accept all predefined exam categories", () => {
    for (const cat of EXAM_CATEGORIES) {
      const result = notificationFilterSchema.safeParse({ category: cat });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.category).toBe(cat);
      }
    }
  });

  it("TC-NOTIF-03B: should accept all predefined notification sort options", () => {
    for (const sortOpt of NOTIFICATION_SORT_OPTIONS) {
      const result = notificationFilterSchema.safeParse({ sortBy: sortOpt });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortBy).toBe(sortOpt);
      }
    }
  });

  it("TC-NOTIF-04: should reject invalid exam category enum value with descriptive error", () => {
    const result = notificationFilterSchema.safeParse({ category: "invalid_exam_domain" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue?.path).toContain("category");
    }
  });

  it("TC-NOTIF-05: should reject negative or zero page numbers", () => {
    const zeroPageResult = notificationFilterSchema.safeParse({ page: 0 });
    expect(zeroPageResult.success).toBe(false);
    if (!zeroPageResult.success) {
      expect(zeroPageResult.error.issues[0]?.path).toContain("page");
    }

    const negPageResult = notificationFilterSchema.safeParse({ page: -4 });
    expect(negPageResult.success).toBe(false);
  });

  it("TC-NOTIF-06: should reject pageSize exceeding the 50 item boundary limit", () => {
    const result = notificationFilterSchema.safeParse({ pageSize: 51 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Maximum 50 items allowed per page");
    }
  });

  it("TC-NOTIF-07: should trim search query strings and enforce max length", () => {
    const trimmedResult = notificationFilterSchema.safeParse({ search: "  KPSC Assistant Engineer   " });
    expect(trimmedResult.success).toBe(true);
    if (trimmedResult.success) {
      expect(trimmedResult.data.search).toBe("KPSC Assistant Engineer");
    }

    const overlyLongSearch = "a".repeat(101);
    const longResult = notificationFilterSchema.safeParse({ search: overlyLongSearch });
    expect(longResult.success).toBe(false);
    if (!longResult.success) {
      expect(longResult.error.issues[0]?.message).toContain("Search query must not exceed 100 characters");
    }
  });

  it("TC-NOTIF-08: should accept all valid sort options", () => {
    for (const sortOpt of NOTIFICATION_SORT_OPTIONS) {
      const result = notificationFilterSchema.safeParse({ sortBy: sortOpt });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortBy).toBe(sortOpt);
      }
    }
  });
});
