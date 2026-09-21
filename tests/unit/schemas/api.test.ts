/**
 * @file tests/unit/schemas/api.test.ts
 * @description Unit tests for Public REST API query schemas and RFC 7807 error formatting.
 * 
 * Task ID: TASK-09010102 (Subtask: SUB-0901010201)
 * Architecture Reference: ADR-010, ADR-014, AGENTS.md (Rule 1 & Rule 2)
 */

import { describe, it, expect } from "vitest";
import {
  notificationQueryParamsSchema,
  examQueryParamsSchema,
  searchQueryParamsSchema,
  formatRfc7807ValidationError,
  NOTIFICATION_API_SORT_OPTIONS,
  EXAM_API_SORT_OPTIONS,
  SEARCH_API_SORT_OPTIONS,
} from "@/lib/schemas/api";

describe("notificationQueryParamsSchema (GET /api/v1/notifications)", () => {
  it("TC-API-NOTIF-01: should pass with defaults when parameters are omitted", () => {
    const result = notificationQueryParamsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
      expect(result.data.category).toBe("all");
      expect(result.data.state).toBe("all");
      expect(result.data.sort).toBe("published_desc");
      expect(result.data.search).toBe("");
    }
  });

  it("TC-API-NOTIF-02: should coerce valid string values to appropriate types", () => {
    const result = notificationQueryParamsSchema.safeParse({
      limit: "50",
      offset: "100",
      category: "banking",
      state: "Maharashtra",
      sort: "deadline_asc",
      search: "Probationary Officer",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.offset).toBe(100);
      expect(result.data.category).toBe("banking");
      expect(result.data.state).toBe("Maharashtra");
      expect(result.data.sort).toBe("deadline_asc");
      expect(result.data.search).toBe("Probationary Officer");
    }
  });

  it("TC-API-NOTIF-03: should reject limit exceeding maximum allowed 100", () => {
    const result = notificationQueryParamsSchema.safeParse({ limit: "101" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Limit cannot exceed 100");
    }
  });

  it("TC-API-NOTIF-04: should reject negative offset values", () => {
    const result = notificationQueryParamsSchema.safeParse({ offset: "-1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Offset must be greater than or equal to 0");
    }
  });

  it("TC-API-NOTIF-05: should reject invalid sort options with descriptive message", () => {
    const result = notificationQueryParamsSchema.safeParse({ sort: "unsupported_order" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Sort must be one of");
    }
  });

  it("TC-API-NOTIF-06: should accept all predefined sort strategies", () => {
    for (const sortOption of NOTIFICATION_API_SORT_OPTIONS) {
      const result = notificationQueryParamsSchema.safeParse({ sort: sortOption });
      expect(result.success).toBe(true);
    }
  });
});

describe("examQueryParamsSchema (GET /api/v1/exams)", () => {
  it("TC-API-EXAM-01: should apply valid defaults when parameters are omitted", () => {
    const result = examQueryParamsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
      expect(result.data.sort).toBe("title_asc");
    }
  });

  it("TC-API-EXAM-02: should parse valid category, state, and sort options", () => {
    const result = examQueryParamsSchema.safeParse({
      category: "railways",
      state: "Central",
      sort: "created_desc",
      search: "RRB NTPC",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe("railways");
      expect(result.data.state).toBe("Central");
      expect(result.data.sort).toBe("created_desc");
      expect(result.data.search).toBe("RRB NTPC");
    }
  });

  it("TC-API-EXAM-03: should accept all predefined exam sort options", () => {
    for (const sortOption of EXAM_API_SORT_OPTIONS) {
      const result = examQueryParamsSchema.safeParse({ sort: sortOption });
      expect(result.success).toBe(true);
    }
  });

  it("TC-API-EXAM-04: should reject limit less than 1", () => {
    const result = examQueryParamsSchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Limit must be at least 1");
    }
  });

  it("TC-API-EXAM-05: should reject search query exceeding 100 characters", () => {
    const result = examQueryParamsSchema.safeParse({ search: "x".repeat(101) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Search query must not exceed 100 characters");
    }
  });
});

describe("searchQueryParamsSchema (GET /api/v1/search)", () => {
  it("TC-API-SRCH-01: should pass with required 'q' parameter and defaults", () => {
    const result = searchQueryParamsSchema.safeParse({ q: "Civil Services" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("Civil Services");
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
      expect(result.data.sort).toBe("relevance");
    }
  });

  it("TC-API-SRCH-02: should reject missing 'q' parameter", () => {
    const result = searchQueryParamsSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("q");
    }
  });

  it("TC-API-SRCH-03: should reject empty or whitespace-only 'q' query", () => {
    const result = searchQueryParamsSchema.safeParse({ q: "    " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Search query 'q' must not be empty");
    }
  });

  it("TC-API-SRCH-04: should reject query string exceeding 100 characters", () => {
    const result = searchQueryParamsSchema.safeParse({ q: "a".repeat(101) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Search query 'q' cannot exceed 100 characters");
    }
  });

  it("TC-API-SRCH-05: should accept all valid search sort options", () => {
    for (const sortOpt of SEARCH_API_SORT_OPTIONS) {
      const result = searchQueryParamsSchema.safeParse({ q: "engineer", sort: sortOpt });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sort).toBe(sortOpt);
      }
    }
  });
});

describe("formatRfc7807ValidationError Helper", () => {
  it("TC-API-RFC-01: should correctly structure RFC 7807 400 Bad Request Problem Details", () => {
    const validationError = searchQueryParamsSchema.safeParse({ q: "" });
    expect(validationError.success).toBe(false);

    if (!validationError.success) {
      const problem = formatRfc7807ValidationError("/api/v1/search", validationError.error);
      expect(problem.type).toBe("https://upaguru.in/errors/invalid-parameters");
      expect(problem.title).toBe("Invalid Query Parameters");
      expect(problem.status).toBe(400);
      expect(problem.instance).toBe("/api/v1/search");
      expect(problem.invalid_params).toBeDefined();
      expect(problem.invalid_params?.length).toBeGreaterThan(0);
      expect(problem.invalid_params?.[0]?.name).toBe("q");
    }
  });

  it("TC-API-RFC-02: should format multiple invalid parameters in detail string", () => {
    const validationError = notificationQueryParamsSchema.safeParse({
      limit: "999",
      offset: "-5",
    });
    expect(validationError.success).toBe(false);

    if (!validationError.success) {
      const problem = formatRfc7807ValidationError("/api/v1/notifications", validationError.error);
      expect(problem.invalid_params?.length).toBe(2);
      expect(problem.detail).toContain("limit");
      expect(problem.detail).toContain("offset");
    }
  });
});
