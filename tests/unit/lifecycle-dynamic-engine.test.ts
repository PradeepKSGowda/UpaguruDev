/**
 * @file tests/unit/lifecycle-dynamic-engine.test.ts
 * @description Unit tests for Master Notification Taxonomy, Stage Definitions,
 * Dynamic Form Field generation, and declarative Dependency Validation.
 */

import { describe, it, expect } from "vitest";
import {
  NOTIFICATION_TAXONOMY,
  getNotificationTypeMeta,
  getStagesForOrganization,
  ORGANIZATION_STAGES,
} from "@/lib/lifecycle/taxonomy";
import {
  getFormFieldsForType,
  validateDynamicLifecycleForm,
  FormValidationContext,
} from "@/lib/lifecycle/dynamic-form-engine";

describe("Complete Examination Lifecycle Taxonomy Engine", () => {
  it("should contain comprehensive notification types across all core categories", () => {
    const keys = Object.keys(NOTIFICATION_TAXONOMY);
    expect(keys.length).toBeGreaterThanOrEqual(20);

    // Initial / Recruitment
    expect(NOTIFICATION_TAXONOMY.FIRST_NOTIFICATION.operationType).toBe("CREATE");
    expect(NOTIFICATION_TAXONOMY.FIRST_NOTIFICATION.requiresExistingExam).toBe(false);

    // Updates
    expect(NOTIFICATION_TAXONOMY.APPLICATION_EXTENSION.operationType).toBe("UPDATE");
    expect(NOTIFICATION_TAXONOMY.APPLICATION_EXTENSION.requiresExistingExam).toBe(true);

    expect(NOTIFICATION_TAXONOMY.ADMIT_CARD_RELEASED.requiresStage).toBe(true);
    expect(NOTIFICATION_TAXONOMY.ANSWER_KEY_PROVISIONAL.requiresStage).toBe(true);
    expect(NOTIFICATION_TAXONOMY.RESULT_RELEASED.requiresStage).toBe(true);
    expect(NOTIFICATION_TAXONOMY.EXAM_DATE_POSTPONED.requiresStage).toBe(true);
  });

  it("should return distinct and accurate stages per organization", () => {
    const upscStages = getStagesForOrganization("UPSC");
    const rrbStages = getStagesForOrganization("RRB");
    const kpscStages = getStagesForOrganization("KPSC");
    const sscStages = getStagesForOrganization("SSC");
    const ibpsStages = getStagesForOrganization("IBPS");

    // UPSC has Prelims, Mains, Interview
    expect(upscStages.some((s) => s.stageCode === "PRELIMS")).toBe(true);
    expect(upscStages.some((s) => s.stageCode === "MAINS")).toBe(true);
    expect(upscStages.some((s) => s.stageCode === "INTERVIEW")).toBe(true);

    // RRB has CBT 1, CBT 2, CBAT, Typing, Medical
    expect(rrbStages.some((s) => s.stageCode === "CBT_1")).toBe(true);
    expect(rrbStages.some((s) => s.stageCode === "MEDICAL_EXAM")).toBe(true);

    // KPSC has Kannada Test and Select Lists
    expect(kpscStages.some((s) => s.stageCode === "KANNADA_TEST")).toBe(true);
    expect(kpscStages.some((s) => s.stageCode === "PROVISIONAL_SELECT_LIST")).toBe(true);

    // SSC has Tier 1, Tier 2
    expect(sscStages.some((s) => s.stageCode === "TIER_1")).toBe(true);
    expect(sscStages.some((s) => s.stageCode === "TIER_2")).toBe(true);

    // IBPS has Provisional Allotment
    expect(ibpsStages.some((s) => s.stageCode === "PROVISIONAL_ALLOTMENT")).toBe(true);
  });

  it("should dynamically render ONLY relevant fields for each notification type", () => {
    // 1. Application Extension fields
    const extFields = getFormFieldsForType("APPLICATION_EXTENSION");
    const extFieldNames = extFields.map((f) => f.fieldName);
    expect(extFieldNames).toContain("new_closing_date");
    expect(extFieldNames).toContain("original_closing_date");
    expect(extFieldNames).toContain("official_pdf_url");
    // Must NOT contain unrelated fields like vacancies, admit card or cut-off
    expect(extFieldNames).not.toContain("download_url");
    expect(extFieldNames).not.toContain("cut_off_available");
    expect(extFieldNames).not.toContain("total_candidates_qualified");

    // 2. Admit Card fields
    const admitFields = getFormFieldsForType("ADMIT_CARD_RELEASED");
    const admitFieldNames = admitFields.map((f) => f.fieldName);
    expect(admitFieldNames).toContain("download_url");
    expect(admitFieldNames).toContain("reporting_time");
    expect(admitFieldNames).toContain("exam_date");
    expect(admitFieldNames).not.toContain("new_closing_date");
    expect(admitFieldNames).not.toContain("objection_fee_per_question");

    // 3. Answer Key fields
    const answerKeyFields = getFormFieldsForType("ANSWER_KEY_PROVISIONAL");
    const answerKeyNames = answerKeyFields.map((f) => f.fieldName);
    expect(answerKeyNames).toContain("objection_window_available");
    expect(answerKeyNames).toContain("objection_portal_url");
    expect(answerKeyNames).not.toContain("reporting_time");
  });

  describe("Dependency and Business Rules Validation", () => {
    it("should reject Application Extension if new date is not after original deadline", () => {
      const invalidCtx: FormValidationContext = {
        notificationTypeCode: "APPLICATION_EXTENSION",
        organizationCode: "KPSC",
        examMasterId: "exam-123",
        examCycleId: "cycle-123",
        values: {
          original_closing_date: "2026-08-31",
          new_closing_date: "2026-08-25", // Earlier!
          official_pdf_url: "https://kpsc.kar.nic.in/ext.pdf",
        },
      };

      const result = validateDynamicLifecycleForm(invalidCtx);
      expect(result.isValid).toBe(false);
      expect(result.errors.new_closing_date).toContain("must be later than the original deadline");
    });

    it("should accept Application Extension if new date is strictly later than original deadline", () => {
      const validCtx: FormValidationContext = {
        notificationTypeCode: "APPLICATION_EXTENSION",
        organizationCode: "KPSC",
        examMasterId: "exam-123",
        examCycleId: "cycle-123",
        values: {
          original_closing_date: "2026-08-31",
          new_closing_date: "2026-09-07", // Later!
          official_pdf_url: "https://kpsc.kar.nic.in/ext.pdf",
        },
      };

      const result = validateDynamicLifecycleForm(validCtx);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it("should require stage for stage-dependent notification types", () => {
      const missingStageCtx: FormValidationContext = {
        notificationTypeCode: "ADMIT_CARD_RELEASED",
        organizationCode: "UPSC",
        examMasterId: "upsc-cse",
        examCycleId: "cse-2026",
        stageCode: "", // Missing stage
        values: {
          release_date: "2026-05-10",
          exam_date: "2026-05-24",
          download_url: "https://upsconline.nic.in",
          official_pdf_url: "https://upsc.gov.in/notice.pdf",
        },
      };

      const result = validateDynamicLifecycleForm(missingStageCtx);
      expect(result.isValid).toBe(false);
      expect(result.errors.stageCode).toBeDefined();
    });

    it("should enforce revised date if postponed exam has new date announced", () => {
      const postponedCtx: FormValidationContext = {
        notificationTypeCode: "EXAM_DATE_POSTPONED",
        organizationCode: "SSC",
        examMasterId: "ssc-cgl",
        examCycleId: "cgl-2026",
        stageCode: "TIER_1",
        values: {
          new_date_available: true,
          new_exam_date: "", // Missing when indicated available
          official_pdf_url: "https://ssc.nic.in/postponed.pdf",
        },
      };

      const result = validateDynamicLifecycleForm(postponedCtx);
      expect(result.isValid).toBe(false);
      expect(result.errors.new_exam_date).toBeDefined();
    });
  });
});
