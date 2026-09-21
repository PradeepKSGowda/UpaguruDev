/**
 * @file tests/unit/schemas/drafts.test.ts
 * @description Unit tests for administrative draft verification schemas.
 * 
 * Task ID: TASK-09010102 (Subtask: SUB-0901010201)
 * Architecture Reference: ADR-001, ADR-002, AGENTS.md (Rule 1 & Rule 2)
 */

import { describe, it, expect } from "vitest";
import {
  draftFilterSchema,
  draftParsedFieldsSchema,
  DRAFT_STATUSES,
  DRAFT_SORT_OPTIONS,
} from "@/lib/schemas/drafts";

describe("draftFilterSchema", () => {
  it("TC-DRAFT-FLT-01: should apply valid default parameters when empty", () => {
    const result = draftFilterSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("pending_review");
      expect(result.data.sortBy).toBe("confidence_asc");
      expect(result.data.search).toBe("");
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("TC-DRAFT-FLT-02: should accept all predefined draft statuses", () => {
    for (const st of ["all", ...DRAFT_STATUSES]) {
      const result = draftFilterSchema.safeParse({ status: st });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe(st);
      }
    }
  });

  it("TC-DRAFT-FLT-02B: should accept all predefined draft sort options", () => {
    for (const sortOpt of DRAFT_SORT_OPTIONS) {
      const result = draftFilterSchema.safeParse({ sortBy: sortOpt });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortBy).toBe(sortOpt);
      }
    }
  });

  it("TC-DRAFT-FLT-03: should accept valid confidence boundaries (0.0 to 1.0)", () => {
    const result = draftFilterSchema.safeParse({
      minConfidence: 0.75,
      maxConfidence: 0.95,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.minConfidence).toBe(0.75);
      expect(result.data.maxConfidence).toBe(0.95);
    }
  });

  it("TC-DRAFT-FLT-04: should reject confidence score exceeding 1.0", () => {
    const result = draftFilterSchema.safeParse({ minConfidence: 1.5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Confidence cannot exceed 1");
    }
  });

  it("TC-DRAFT-FLT-05: should reject invalid status values", () => {
    const result = draftFilterSchema.safeParse({ status: "arbitrary_status" });
    expect(result.success).toBe(false);
  });
});

describe("draftParsedFieldsSchema", () => {
  const validDraftFields = {
    title: "KPSC Assistant Engineer Recruitment 2026",
    conducting_body: "Karnataka Public Service Commission",
    exam_name: "Assistant Engineer (Civil & Mech)",
    notification_number: "PSC 44/2026",
    category: "state_psc",
    total_vacancies: 250,
    application_start_date: "2026-04-01",
    application_end_date: "2026-05-15",
    age_limit_min: 21,
    age_limit_max: 38,
    official_pdf_url: "https://kpsc.kar.nic.in/ae2026.pdf",
    apply_online_url: "https://kpsc.kar.nic.in/apply",
  };

  it("TC-DRAFT-FLD-01: should pass with complete and valid draft notification fields", () => {
    const result = draftParsedFieldsSchema.safeParse(validDraftFields);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe(validDraftFields.title);
      expect(result.data.total_vacancies).toBe(250);
    }
  });

  it("TC-DRAFT-FLD-02: should reject title shorter than 3 characters", () => {
    const result = draftParsedFieldsSchema.safeParse({
      ...validDraftFields,
      title: "KP",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Title must be at least 3 characters");
    }
  });

  it("TC-DRAFT-FLD-03: should reject missing conducting_body", () => {
    const { conducting_body, ...missingBody } = validDraftFields;
    const result = draftParsedFieldsSchema.safeParse(missingBody);
    expect(result.success).toBe(false);
  });

  it("TC-DRAFT-FLD-04: should reject negative total vacancies", () => {
    const result = draftParsedFieldsSchema.safeParse({
      ...validDraftFields,
      total_vacancies: -10,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Vacancies cannot be negative");
    }
  });

  it("TC-DRAFT-FLD-05: should reject invalid URL formatting for official PDF URL", () => {
    const result = draftParsedFieldsSchema.safeParse({
      ...validDraftFields,
      official_pdf_url: "ftp-not-http-url",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Please enter a valid URL");
    }
  });
});
