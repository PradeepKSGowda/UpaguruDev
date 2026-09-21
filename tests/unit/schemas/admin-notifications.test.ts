/**
 * @file tests/unit/schemas/admin-notifications.test.ts
 * @description Unit tests for administrative notification input and filter Zod schemas.
 * 
 * Task ID: TASK-09010102
 * Subtask: SUB-0901010201
 * Architecture Reference: AGENTS.md (Rule 1: Zod Input Validation, Rule 2: Testing Safety Guardrails)
 */

import { describe, it, expect } from "vitest";
import {
  adminNotificationInputSchema,
  adminNotificationFilterSchema,
  NOTIFICATION_STATUSES,
} from "@/lib/schemas/admin-notifications";

describe("adminNotificationInputSchema", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000";

  const validPayload = {
    exam_id: validUUID,
    title: "UPSC Civil Services Examination 2026",
    slug: "upsc-cse-2026",
    notification_number: "01/2026-CSP",
    total_vacancies: 1056,
    application_start_date: "2026-02-14",
    application_end_date: "2026-03-05",
    exam_date: "2026-05-24",
    qualification_required: ["Graduate Degree", "Indian Citizen"],
    age_limit_min: 21,
    age_limit_max: 32,
    official_pdf_url: "https://upsc.gov.in/docs/notif-2026.pdf",
    apply_online_url: "https://upsconline.nic.in/apply",
    status: "published" as const,
  };

  it("should successfully parse and validate a valid complete payload", () => {
    const result = adminNotificationInputSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("UPSC Civil Services Examination 2026");
      expect(result.data.slug).toBe("upsc-cse-2026");
      expect(result.data.total_vacancies).toBe(1056);
      expect(result.data.qualification_required).toEqual(["Graduate Degree", "Indian Citizen"]);
      expect(result.data.status).toBe("published");
    }
  });

  it("should transform newline-delimited qualification string into an array of strings", () => {
    const payload = {
      ...validPayload,
      qualification_required: "B.E. / B.Tech\nMaster's Degree in Science\n Chartered Accountant ",
    };
    const result = adminNotificationInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.qualification_required).toEqual([
        "B.E. / B.Tech",
        "Master's Degree in Science",
        "Chartered Accountant",
      ]);
    }
  });

  it("should preprocess empty strings and nulls for vacancies and age limits", () => {
    const payload = {
      ...validPayload,
      total_vacancies: "",
      age_limit_min: "",
      age_limit_max: null,
      exam_date: "",
      official_pdf_url: "",
      apply_online_url: "",
    };
    const result = adminNotificationInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total_vacancies).toBe(0);
      expect(result.data.age_limit_min).toBeNull();
      expect(result.data.age_limit_max).toBeNull();
      expect(result.data.exam_date).toBeNull();
      expect(result.data.official_pdf_url).toBe("");
    }
  });

  it("should reject an invalid UUID for exam_id", () => {
    const payload = { ...validPayload, exam_id: "not-a-uuid" };
    const result = adminNotificationInputSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("exam_id"));
      expect(issue).toBeDefined();
      expect(issue?.message).toContain("valid examination series");
    }
  });

  it("should reject invalid slug formats with uppercase, spaces, or illegal punctuation", () => {
    const invalidSlugs = ["UPSC-CSE-2026", "upsc cse", "upsc--cse", "upsc_cse!"];
    invalidSlugs.forEach((slug) => {
      const payload = { ...validPayload, slug };
      const result = adminNotificationInputSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes("slug"));
        expect(issue).toBeDefined();
        expect(issue?.message).toContain("lowercase alphanumeric");
      }
    });
  });

  it("should reject invalid date strings not matching YYYY-MM-DD", () => {
    const payload = {
      ...validPayload,
      application_start_date: "14-02-2026",
      application_end_date: "2026/03/05",
    };
    const result = adminNotificationInputSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issueStart = result.error.issues.find((i) => i.path.includes("application_start_date"));
      const issueEnd = result.error.issues.find((i) => i.path.includes("application_end_date"));
      expect(issueStart).toBeDefined();
      expect(issueEnd).toBeDefined();
    }
  });

  it("should reject negative total vacancies and out-of-range ages", () => {
    const payload = {
      ...validPayload,
      total_vacancies: -10,
      age_limit_min: -5,
      age_limit_max: 150,
    };
    const result = adminNotificationInputSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      const vacanciesIssue = result.error.issues.find((i) => i.path.includes("total_vacancies"));
      expect(vacanciesIssue).toBeDefined();
      expect(vacanciesIssue?.message).toContain("Vacancies cannot be negative");
    }
  });

  it("should reject malformed URLs for official_pdf_url and apply_online_url", () => {
    const payload = {
      ...validPayload,
      official_pdf_url: "ftp//not-a-valid-http-url",
      apply_online_url: "htp:bad-url",
    };
    const result = adminNotificationInputSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      const pdfIssue = result.error.issues.find((i) => i.path.includes("official_pdf_url"));
      const applyIssue = result.error.issues.find((i) => i.path.includes("apply_online_url"));
      expect(pdfIssue).toBeDefined();
      expect(applyIssue).toBeDefined();
    }
  });

  it("should apply default status 'published' and default vacancies 0 when unspecified", () => {
    const minimalPayload = {
      exam_id: validUUID,
      title: "SSC CGL Exam 2026",
      slug: "ssc-cgl-2026",
      application_start_date: "2026-06-01",
      application_end_date: "2026-06-30",
    };
    const result = adminNotificationInputSchema.safeParse(minimalPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("published");
      expect(result.data.total_vacancies).toBe(0);
      expect(result.data.qualification_required).toEqual([]);
    }
  });
});

describe("adminNotificationFilterSchema", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000";

  it("should apply default filter properties when empty object is passed", () => {
    const result = adminNotificationFilterSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.search).toBe("");
      expect(result.data.status).toBe("all");
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(15);
      expect(result.data.examId).toBeUndefined();
    }
  });

  it("should validate and coerce custom filter parameters", () => {
    const rawInput = {
      search: "  Civil Services  ",
      status: "under_review",
      examId: validUUID,
      page: "3",
      pageSize: "25",
    };
    const result = adminNotificationFilterSchema.safeParse(rawInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.search).toBe("Civil Services");
      expect(result.data.status).toBe("under_review");
      expect(result.data.examId).toBe(validUUID);
      expect(result.data.page).toBe(3);
      expect(result.data.pageSize).toBe(25);
    }
  });

  it("should accept all predefined notification statuses", () => {
    for (const status of ["all", ...NOTIFICATION_STATUSES]) {
      const result = adminNotificationFilterSchema.safeParse({ status });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe(status);
      }
    }
  });

  it("should reject unknown status enum values", () => {
    const result = adminNotificationFilterSchema.safeParse({ status: "deleted_status" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid examId UUID format", () => {
    const result = adminNotificationFilterSchema.safeParse({ examId: "invalid-uuid" });
    expect(result.success).toBe(false);
  });

  it("should reject pageSize outside boundary [5, 100]", () => {
    const tooSmall = adminNotificationFilterSchema.safeParse({ pageSize: 2 });
    const tooLarge = adminNotificationFilterSchema.safeParse({ pageSize: 500 });
    expect(tooSmall.success).toBe(false);
    expect(tooLarge.success).toBe(false);
  });
});
