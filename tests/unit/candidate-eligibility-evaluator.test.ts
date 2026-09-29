/**
 * @file tests/unit/candidate-eligibility-evaluator.test.ts
 * @description Unit and regression tests for Candidate Eligibility Evaluation Engine v2.0.0.
 * Verifies rule matching, boundary conditions, relaxations, indeterminate mappings,
 * corrigendum recalculations, and performance latency (< 250ms for 120 candidates).
 *
 * Enhancement: ENH-CANDIDATE-TEST-MATRIX
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  evaluateCandidateEligibility,
  evaluateCandidateMatrix,
  type CandidateKYCProfile,
  type ExtractedNotificationRule,
} from "@/lib/matching/candidate-eligibility-evaluator";

const candidatesPath = path.resolve(__dirname, "../test-data/upaguru-candidates/candidates.json");
const candidates: CandidateKYCProfile[] = JSON.parse(fs.readFileSync(candidatesPath, "utf8"));

const expectationsPath = path.resolve(
  __dirname,
  "../test-data/upaguru-candidates/eligibility-expected-results.json"
);
const expectationsFixture = JSON.parse(fs.readFileSync(expectationsPath, "utf8"));

describe("Candidate Eligibility Evaluator v2.0 — Deterministic Golden Fixture", () => {
  const notifKpsc = expectationsFixture.test_notifications.find(
    (n: any) => n.notification_id === "NOTIF-KPSC-AE-2027"
  ) as ExtractedNotificationRule & { expected_evaluations: Record<string, any> };

  it("evaluates KPSC Assistant Engineer 2027 against expected golden fixture", () => {
    expect(notifKpsc).toBeDefined();

    for (const [candidateId, expected] of Object.entries(notifKpsc.expected_evaluations)) {
      const candidate = candidates.find((c) => c.candidate_id === candidateId);
      expect(candidate, `Candidate ${candidateId} should exist`).toBeDefined();

      if (candidate) {
        const result = evaluateCandidateEligibility(candidate, notifKpsc);

        expect(result.status, `Status for ${candidateId}`).toBe(expected.status);
        expect(result.eligible, `Eligible boolean for ${candidateId}`).toBe(expected.eligible);

        if (expected.failed_rules) {
          expect(result.failed_rules.sort(), `Failed rules for ${candidateId}`).toEqual(
            expected.failed_rules.sort()
          );
        }

        if (expected.matched_rules) {
          for (const rule of expected.matched_rules) {
            expect(result.matched_rules, `Expected matched rule ${rule} for ${candidateId}`).toContain(
              rule
            );
          }
        }

        if (expected.reasons && expected.reasons.length > 0) {
          expect(result.reasons.length, `Reasons count for ${candidateId}`).toBeGreaterThanOrEqual(
            expected.reasons.length
          );
        }
      }
    }
  });

  it("yields INDETERMINATE when reference date is missing and confidence is low", () => {
    const notifAmbiguous = expectationsFixture.test_notifications.find(
      (n: any) => n.notification_id === "NOTIF-AMBIGUOUS-CUTOFF-2027"
    ) as ExtractedNotificationRule & { expected_evaluations: Record<string, any> };

    expect(notifAmbiguous).toBeDefined();

    const candidate = candidates.find((c) => c.candidate_id === "TC-0006");
    expect(candidate).toBeDefined();

    if (candidate) {
      const result = evaluateCandidateEligibility(candidate, notifAmbiguous);
      expect(result.status).toBe("INDETERMINATE");
      expect(result.eligible).toBeNull();
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining("below verification threshold"),
        ])
      );
    }
  });

  it("re-evaluates corrigendum properly when max age is enhanced (Section 23 & 23a)", () => {
    const notifCorrigendum = expectationsFixture.test_notifications.find(
      (n: any) => n.notification_id === "NOTIF-CORRIGENDUM-2027"
    ) as ExtractedNotificationRule;

    expect(notifCorrigendum).toBeDefined();

    // TC-0011 is 28 years old. Under Rev 1 (max 27) -> Ineligible.
    // Under Rev 2 (Corrigendum max 30) -> Eligible.
    const tc0011 = candidates.find((c) => c.candidate_id === "TC-0011");
    expect(tc0011).toBeDefined();

    if (tc0011) {
      const resultRev1 = evaluateCandidateEligibility(tc0011, notifKpsc);
      expect(resultRev1.status).toBe("INELIGIBLE");
      expect(resultRev1.failed_rules).toContain("age");

      const resultRev2 = evaluateCandidateEligibility(tc0011, notifCorrigendum);
      expect(resultRev2.status).toBe("ELIGIBLE");
      expect(resultRev2.matched_rules).toContain("age");
      expect(resultRev2.corrigendum_revision).toBe(2);
    }
  });

  it("properly resolves stacked relaxation conflict using max applicable policy (Section 8a)", () => {
    // TC-0024 is SC + Ex-Servicemen, age 32.
    // Base max: 27. SC relaxation: 5y. Ex-Servicemen relaxation: 5y.
    // Engine applies Math.max(5, 5) = 5 years -> Effective max = 32.
    const tc0024 = candidates.find((c) => c.candidate_id === "TC-0024");
    expect(tc0024).toBeDefined();

    if (tc0024) {
      const result = evaluateCandidateEligibility(tc0024, notifKpsc);
      expect(result.status).toBe("ELIGIBLE");
      expect(result.matched_rules).toContain("age");
    }
  });

  it("differentiates Kalyana Karnataka residence from certified domicile status (Section 9a)", () => {
    const notifKKPost: ExtractedNotificationRule = {
      ...notifKpsc,
      notification_id: "NOTIF-KPSC-KK-2027",
      quota_reserved_for: "Kalyana Karnataka 371(J)",
    };

    // TC-0061: Kalaburagi resident WITH certificate -> PASS
    const tc0061 = candidates.find((c) => c.candidate_id === "TC-0061");
    expect(tc0061).toBeDefined();
    if (tc0061) {
      const resCertified = evaluateCandidateEligibility(tc0061, notifKKPost);
      expect(resCertified.status).toBe("ELIGIBLE");
    }

    // TC-0062: Kalaburagi resident WITHOUT certificate -> FAIL
    const tc0062 = candidates.find((c) => c.candidate_id === "TC-0062");
    expect(tc0062).toBeDefined();
    if (tc0062) {
      const resUncertified = evaluateCandidateEligibility(tc0062, notifKKPost);
      expect(resUncertified.status).toBe("INELIGIBLE");
      expect(resUncertified.failed_rules).toContain("location");
      expect(resUncertified.reasons.some((r) => r.includes("lacks mandatory Article 371(J)"))).toBe(true);
    }
  });
});

describe("Candidate Eligibility Evaluator v2.0 — Batch Performance & Scale Target (Section 27a)", () => {
  const notifKpsc = expectationsFixture.test_notifications.find(
    (n: any) => n.notification_id === "NOTIF-KPSC-AE-2027"
  ) as ExtractedNotificationRule;

  it("evaluates all 120 candidates against one notification in under 250ms target", () => {
    const summary = evaluateCandidateMatrix(candidates, notifKpsc);

    expect(summary.total_candidates).toBe(120);
    expect(summary.results.length).toBe(120);
    expect(summary.eligible_count).toBeGreaterThan(0);
    expect(summary.ineligible_count).toBeGreaterThan(0);

    console.log(`[PerformanceBenchmark] Batch evaluation of 120 candidates took ${summary.evaluation_duration_ms} ms`);
    // Performance target: strictly < 250ms
    expect(summary.evaluation_duration_ms).toBeLessThan(250);
  });
});
