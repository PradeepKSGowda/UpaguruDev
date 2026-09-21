/**
 * @file tests/unit/config.test.ts
 * @description Unit test validating Vitest runner setup, path alias resolution, and environment variables.
 * 
 * Task ID: TASK-09010101 (Subtask: SUB-0901010101)
 * Complies with: AGENTS.md (Rule 2: Test Code Generation)
 */

import { describe, it, expect } from "vitest";
import { notificationQueryParamsSchema } from "@/lib/schemas/api";
import { EXAM_CATEGORIES } from "@/lib/schemas/notifications";

describe("Vitest Test Runner Configuration", () => {
  it("should successfully resolve tsconfig path aliases (@/*)", () => {
    expect(notificationQueryParamsSchema).toBeDefined();
    expect(typeof notificationQueryParamsSchema.safeParse).toBe("function");
    expect(EXAM_CATEGORIES).toBeInstanceOf(Array);
    expect(EXAM_CATEGORIES.length).toBeGreaterThan(0);
  });

  it("should have mocked environment variables initialized from vitest.setup.ts", () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined();
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toContain("supabase.co");
    expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeDefined();
    expect(process.env.UPSTASH_REDIS_REST_URL).toBeDefined();
  });

  it("should validate sample query parameters with Zod schema", () => {
    const validParams = {
      limit: "10",
      offset: "0",
      category: "civil_services",
      state: "Karnataka",
      sort: "published_desc",
    };

    const result = notificationQueryParamsSchema.safeParse(validParams);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
      expect(result.data.offset).toBe(0);
      expect(result.data.category).toBe("civil_services");
    }
  });

  it("should fail validation on invalid query parameters", () => {
    const invalidParams = {
      limit: "999", // Exceeds max 100
      offset: "-5", // Cannot be negative
      category: "invalid_category",
    };

    const result = notificationQueryParamsSchema.safeParse(invalidParams);
    expect(result.success).toBe(false);
    if (!result.success) {
      const errorPaths = result.error.errors.map((e) => e.path.join("."));
      expect(errorPaths).toContain("limit");
      expect(errorPaths).toContain("offset");
      expect(errorPaths).toContain("category");
    }
  });
});
