/**
 * @file tests/unit/eligibility-engine.test.ts
 * @description Unit tests for Smart Eligibility Matching Engine.
 * Covers age calculation, category-based reservation relaxation, qualification hierarchy,
 * domicile matching, deadline proximity, and composite score computation.
 *
 * Enhancement: ENH-0009 (Smart Eligibility Matching Engine)
 */

import { describe, it, expect } from "vitest";
import {
  calculateAge,
  evaluateAgeDimension,
  evaluateQualificationDimension,
  evaluateStateDimension,
  evaluateDeadlineDimension,
  computeEligibilityScore,
  matchCandidateToNotifications,
  type CandidateProfile,
  type NotificationEligibilityCriteria,
} from "@/lib/matching/eligibility-engine";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const baseProfile: CandidateProfile = {
  dateOfBirth: "1998-06-15",
  gender: "male",
  category: "OBC",
  state: "Karnataka",
  qualifications: ["10th", "12th", "Graduate"],
};

const futureDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  .toISOString()
  .split("T")[0] as string;

const baseNotification: NotificationEligibilityCriteria = {
  notificationId: "n-001",
  title: "KPSC FDA Exam 2026",
  slug: "kpsc-fda-exam-2026",
  ageLimitMin: 21,
  ageLimitMax: 35,
  qualificationRequired: ["Graduate"],
  applicationStartDate: "2026-09-01",
  applicationEndDate: futureDeadline,
  examStateOrCentral: "Karnataka",
  examCategory: "state_psc",
  status: "published",
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Eligibility Engine — Age Calculation", () => {
  it("calculates age correctly when birthday has passed", () => {
    const age = calculateAge("2000-01-15", new Date("2026-09-24"));
    expect(age).toBe(26);
  });

  it("handles birthday not yet passed this year", () => {
    const age = calculateAge("2000-12-25", new Date("2026-09-24"));
    expect(age).toBe(25);
  });

  it("calculates exact birthday correctly", () => {
    const age = calculateAge("2000-09-24", new Date("2026-09-24"));
    expect(age).toBe(26);
  });
});

describe("Eligibility Engine — Age Dimension", () => {
  it("marks eligible when age is within range", () => {
    const result = evaluateAgeDimension(baseProfile, baseNotification);
    expect(result.status).toBe("eligible");
    expect(result.score).toBe(100);
  });

  it("applies OBC age relaxation (+3 years)", () => {
    // 36 years old with base max 35. OBC gets +3 -> max 38
    const olderProfile: CandidateProfile = { ...baseProfile, dateOfBirth: "1990-01-01" };
    const result = evaluateAgeDimension(olderProfile, {
      ...baseNotification,
      ageLimitMax: 35,
      applicationEndDate: "2026-09-24",
    });
    expect(result.status).toBe("eligible");
    expect(result.score).toBe(100);
    expect(result.detail).toContain("OBC relaxation");
  });

  it("applies SC/ST age relaxation (+5 years)", () => {
    // 39 years old with base max 35. SC gets +5 -> max 40
    const scProfile: CandidateProfile = { ...baseProfile, category: "SC", dateOfBirth: "1987-01-01" };
    const result = evaluateAgeDimension(scProfile, {
      ...baseNotification,
      ageLimitMax: 35,
      applicationEndDate: "2026-09-24",
    });
    expect(result.status).toBe("eligible");
    expect(result.score).toBe(100);
    expect(result.detail).toContain("SC relaxation");
  });

  it("marks ineligible when age exceeds even with relaxation", () => {
    // 45 years old with base max 35 + 3 OBC = 38
    const overageProfile: CandidateProfile = { ...baseProfile, dateOfBirth: "1980-01-01" };
    const result = evaluateAgeDimension(overageProfile, {
      ...baseNotification,
      ageLimitMax: 35,
      applicationEndDate: "2026-09-24",
    });
    expect(result.status).toBe("ineligible");
    expect(result.score).toBe(0);
  });

  it("returns unknown when DOB is missing", () => {
    const result = evaluateAgeDimension(
      { ...baseProfile, dateOfBirth: null },
      baseNotification
    );
    expect(result.status).toBe("unknown");
    expect(result.score).toBe(50);
  });

  it("marks eligible when notification has no age restrictions", () => {
    const result = evaluateAgeDimension(baseProfile, {
      ...baseNotification,
      ageLimitMin: null,
      ageLimitMax: null,
    });
    expect(result.status).toBe("eligible");
    expect(result.score).toBe(100);
  });
});

describe("Eligibility Engine — Qualification Dimension", () => {
  it("marks eligible when candidate meets exact qualification", () => {
    const result = evaluateQualificationDimension(baseProfile, baseNotification);
    expect(result.status).toBe("eligible");
    expect(result.score).toBe(100);
  });

  it("marks eligible when candidate has higher qualification in hierarchy", () => {
    const result = evaluateQualificationDimension(baseProfile, {
      ...baseNotification,
      qualificationRequired: ["12th"],
    });
    expect(result.status).toBe("eligible");
    expect(result.score).toBe(100);
  });

  it("marks ineligible when candidate qualification is below requirement", () => {
    const lowProfile: CandidateProfile = { ...baseProfile, qualifications: ["10th"] };
    const result = evaluateQualificationDimension(lowProfile, baseNotification);
    expect(result.status).toBe("ineligible");
    expect(result.score).toBe(0);
  });

  it("returns unknown when candidate has no qualifications listed", () => {
    const emptyProfile: CandidateProfile = { ...baseProfile, qualifications: [] };
    const result = evaluateQualificationDimension(emptyProfile, baseNotification);
    expect(result.status).toBe("unknown");
    expect(result.score).toBe(50);
  });

  it("marks eligible when exam lists no qualification requirements", () => {
    const result = evaluateQualificationDimension(baseProfile, {
      ...baseNotification,
      qualificationRequired: [],
    });
    expect(result.status).toBe("eligible");
    expect(result.score).toBe(100);
  });
});

describe("Eligibility Engine — State Dimension", () => {
  it("marks eligible when candidate state matches exam state", () => {
    const result = evaluateStateDimension(baseProfile, baseNotification);
    expect(result.status).toBe("eligible");
    expect(result.score).toBe(100);
  });

  it("marks eligible for Central/All-India exams regardless of state", () => {
    const result = evaluateStateDimension(baseProfile, {
      ...baseNotification,
      examStateOrCentral: "Central",
    });
    expect(result.status).toBe("eligible");
    expect(result.score).toBe(100);
  });

  it("marks eligible for All India exam variations", () => {
    const result = evaluateStateDimension(baseProfile, {
      ...baseNotification,
      examStateOrCentral: "All India",
    });
    expect(result.status).toBe("eligible");
    expect(result.score).toBe(100);
  });

  it("marks ineligible for different state exam", () => {
    const result = evaluateStateDimension(baseProfile, {
      ...baseNotification,
      examStateOrCentral: "Tamil Nadu",
    });
    expect(result.status).toBe("ineligible");
    expect(result.score).toBe(0);
  });

  it("returns unknown when candidate state is missing for state exam", () => {
    const noStateProfile: CandidateProfile = { ...baseProfile, state: null };
    const result = evaluateStateDimension(noStateProfile, baseNotification);
    expect(result.status).toBe("unknown");
    expect(result.score).toBe(50);
  });
});

describe("Eligibility Engine — Deadline Dimension", () => {
  it("marks eligible when deadline is more than 7 days away", () => {
    const result = evaluateDeadlineDimension(baseNotification);
    expect(result.status).toBe("eligible");
    expect(result.score).toBe(100);
  });

  it("marks expiring when deadline is within 7 days", () => {
    const soonDeadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0] as string;
    const result = evaluateDeadlineDimension({
      ...baseNotification,
      applicationEndDate: soonDeadline,
    });
    expect(result.status).toBe("expiring");
    expect(result.score).toBe(60);
  });

  it("marks expiring with high urgency when deadline is within 3 days", () => {
    const urgentDeadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0] as string;
    const result = evaluateDeadlineDimension({
      ...baseNotification,
      applicationEndDate: urgentDeadline,
    });
    expect(result.status).toBe("expiring");
    expect(result.score).toBe(30);
  });

  it("marks ineligible when deadline has passed", () => {
    const result = evaluateDeadlineDimension({
      ...baseNotification,
      applicationEndDate: "2020-01-01",
    });
    expect(result.status).toBe("ineligible");
    expect(result.score).toBe(0);
  });
});

describe("Eligibility Engine — Composite Score Computation", () => {
  it("computes 100 when all dimensions are eligible", () => {
    const score = computeEligibilityScore([
      { name: "age", status: "eligible", score: 100, detail: "" },
      { name: "qualification", status: "eligible", score: 100, detail: "" },
      { name: "state", status: "eligible", score: 100, detail: "" },
      { name: "deadline", status: "eligible", score: 100, detail: "" },
    ]);
    expect(score).toBe(100);
  });

  it("computes 0 when all dimensions are ineligible", () => {
    const score = computeEligibilityScore([
      { name: "age", status: "ineligible", score: 0, detail: "" },
      { name: "qualification", status: "ineligible", score: 0, detail: "" },
      { name: "state", status: "ineligible", score: 0, detail: "" },
      { name: "deadline", status: "ineligible", score: 0, detail: "" },
    ]);
    expect(score).toBe(0);
  });

  it("applies correct weighting across dimensions", () => {
    // age (30% * 100 = 30) + qualification (30% * 100 = 30) + state (20% * 0 = 0) + deadline (20% * 100 = 20) = 80
    const score = computeEligibilityScore([
      { name: "age", status: "eligible", score: 100, detail: "" },
      { name: "qualification", status: "eligible", score: 100, detail: "" },
      { name: "state", status: "ineligible", score: 0, detail: "" },
      { name: "deadline", status: "eligible", score: 100, detail: "" },
    ]);
    expect(score).toBe(80);
  });
});

describe("Eligibility Engine — Full Candidate Matching", () => {
  it("returns eligible match for a fully matching profile", () => {
    const results = matchCandidateToNotifications(baseProfile, [baseNotification]);
    expect(results.length).toBe(1);
    expect(results[0]!.isEligible).toBe(true);
    expect(results[0]!.overallScore).toBeGreaterThanOrEqual(80);
    expect(results[0]!.daysUntilDeadline).toBeGreaterThan(0);
  });

  it("skips non-published notifications", () => {
    const results = matchCandidateToNotifications(baseProfile, [
      { ...baseNotification, status: "draft" },
      { ...baseNotification, status: "under_review" },
    ]);
    expect(results.length).toBe(0);
  });

  it("skips expired notifications", () => {
    const results = matchCandidateToNotifications(baseProfile, [
      { ...baseNotification, applicationEndDate: "2020-01-01" },
    ]);
    expect(results.length).toBe(0);
  });

  it("sorts results by eligibility then score then deadline", () => {
    const notifications: NotificationEligibilityCriteria[] = [
      { ...baseNotification, notificationId: "n-ineligible-state", examStateOrCentral: "Tamil Nadu" },
      { ...baseNotification, notificationId: "n-eligible", examStateOrCentral: "Karnataka" },
    ];
    const results = matchCandidateToNotifications(baseProfile, notifications);
    expect(results[0]!.notificationId).toBe("n-eligible");
    expect(results[0]!.isEligible).toBe(true);
    expect(results[0]!.overallScore).toBeGreaterThan(results[1]!.overallScore);
  });
});
