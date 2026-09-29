/**
 * @file tests/unit/candidate-test-matrix.test.ts
 * @description Unit tests for synthetic candidate dataset matrix integrity, deterministic IDs,
 * non-PII / DPDP compliance, regional scripts, and boundary coverage.
 *
 * Enhancement: ENH-CANDIDATE-TEST-MATRIX
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import type { CandidateRecord } from "../test-data/upaguru-candidates/generate-candidates";

const candidatesPath = path.resolve(__dirname, "../test-data/upaguru-candidates/candidates.json");
const candidates: CandidateRecord[] = JSON.parse(fs.readFileSync(candidatesPath, "utf8"));

describe("Synthetic Candidate Test Matrix — Dataset Integrity", () => {
  it("contains exactly 120 deterministic synthetic candidate profiles", () => {
    expect(candidates).toBeDefined();
    expect(candidates.length).toBe(120);
  });

  it("enforces deterministic machine-readable candidate IDs (TC-0001 to TC-0120)", () => {
    candidates.forEach((c, index) => {
      const expectedId = `TC-${String(index + 1).padStart(4, "0")}`;
      expect(c.candidate_id).toBe(expectedId);
    });
  });

  it("strictly enforces reserved test domain @upaguru.test (zero real email addresses)", () => {
    candidates.forEach((c) => {
      expect(c.email).toMatch(/^[a-z0-9_.-]+@upaguru\.test$/);
      expect(c.email).not.toContain("@gmail.com");
      expect(c.email).not.toContain("@yahoo.com");
      expect(c.email).not.toContain("@outlook.com");
    });
  });

  it("strictly marks all candidates with is_test_user = true and verified flags", () => {
    candidates.forEach((c) => {
      expect(c.is_test_user).toBe(true);
      if (c.candidate_id !== "TC-0119") {
        // TC-0119 is explicit incomplete profile test case
        expect(c.is_email_verified).toBe(true);
        expect(c.is_phone_verified).toBe(true);
      }
    });
  });

  it("includes regional script name coverage (Kannada, Telugu) and transliteration edge cases", () => {
    const kannadaCandidates = candidates.filter((c) =>
      /[\u0C80-\u0CFF]/.test(c.full_name)
    );
    expect(kannadaCandidates.length).toBeGreaterThanOrEqual(2);

    const teluguCandidates = candidates.filter((c) =>
      /[\u0C00-\u0C7F]/.test(c.full_name)
    );
    expect(teluguCandidates.length).toBeGreaterThanOrEqual(1);

    const apostropheCandidate = candidates.find((c) => c.full_name.includes("'"));
    expect(apostropheCandidate).toBeDefined();
    expect(apostropheCandidate?.candidate_id).toBe("TC-0114");

    const hyphenCandidate = candidates.find((c) => c.full_name.includes("-"));
    expect(hyphenCandidate).toBeDefined();
  });

  it("covers critical age boundary conditions as of reference date 2027-01-01", () => {
    const minMinus2d = candidates.find((c) => c.candidate_id === "TC-0001");
    const minMinus1d = candidates.find((c) => c.candidate_id === "TC-0002");
    const minExact = candidates.find((c) => c.candidate_id === "TC-0003");
    const maxMinus1d = candidates.find((c) => c.candidate_id === "TC-0008");
    const maxExact = candidates.find((c) => c.candidate_id === "TC-0009");
    const maxPlus1d = candidates.find((c) => c.candidate_id === "TC-0010");

    expect(minMinus2d?.date_of_birth).toBe("2009-01-03");
    expect(minMinus1d?.date_of_birth).toBe("2009-01-02");
    expect(minExact?.date_of_birth).toBe("2009-01-01");
    expect(maxMinus1d?.date_of_birth).toBe("2000-01-02");
    expect(maxExact?.date_of_birth).toBe("2000-01-01");
    expect(maxPlus1d?.date_of_birth).toBe("1999-12-31");
  });

  it("covers education hierarchy spanning SSLC, PUC, ITI, Diploma, BE, Masters, MBBS, LLB", () => {
    const degrees = new Set(candidates.map((c) => c.highest_degree).filter(Boolean));
    expect(degrees.has("SSLC")).toBe(true);
    expect(degrees.has("PUC")).toBe(true);
    expect(degrees.has("ITI")).toBe(true);
    expect(degrees.has("Diploma")).toBe(true);
    expect(degrees.has("BE")).toBe(true);
    expect(degrees.has("BTech")).toBe(true);
    expect(degrees.has("BSc")).toBe(true);
    expect(degrees.has("BCom")).toBe(true);
    expect(degrees.has("BA")).toBe(true);
    expect(degrees.has("MA")).toBe(true);
    expect(degrees.has("MSc")).toBe(true);
    expect(degrees.has("MBA")).toBe(true);
    expect(degrees.has("MBBS")).toBe(true);
    expect(degrees.has("LLB")).toBe(true);
  });

  it("covers Kalyana Karnataka Article 371(J) domicile distinction (residence vs certified status)", () => {
    const certifiedKK = candidates.find((c) => c.candidate_id === "TC-0061");
    const uncertifiedKK = candidates.find((c) => c.candidate_id === "TC-0062");

    expect(certifiedKK?.region).toBe("Kalyana Karnataka");
    expect(certifiedKK?.has_domicile_certificate).toBe(true);

    expect(uncertifiedKK?.region).toBe("Kalyana Karnataka");
    expect(uncertifiedKK?.has_domicile_certificate).toBe(false);
  });

  it("provides indeterminate source test profiles with missing candidate attributes", () => {
    const missingDob = candidates.find((c) => c.candidate_id === "TC-0116");
    const missingState = candidates.find((c) => c.candidate_id === "TC-0117");
    const missingQual = candidates.find((c) => c.candidate_id === "TC-0118");

    expect(missingDob?.date_of_birth).toBeNull();
    expect(missingState?.state).toBeNull();
    expect(missingQual?.qualifications).toEqual([]);
  });
});
