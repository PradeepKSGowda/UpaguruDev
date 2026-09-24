/**
 * @file lib/matching/eligibility-engine.ts
 * @description Pure-function eligibility matching engine that evaluates candidate profiles
 * against government exam notification requirements. Uses rule-based matching across
 * age (with category relaxation), qualification hierarchy, state domicile, and application deadline.
 *
 * Enhancement: ENH-0009 (Smart Eligibility Matching Engine)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-002 (Database)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CandidateProfile {
  dateOfBirth: string | null;    // ISO date string "YYYY-MM-DD"
  gender: string | null;         // "male" | "female" | "other" | "prefer_not_to_say"
  category: string | null;       // "GM" | "OBC" | "SC" | "ST" | "EWS"
  state: string | null;          // e.g. "Karnataka", "Tamil Nadu"
  qualifications: string[];      // e.g. ["10th", "12th", "Graduate"]
}

export interface NotificationEligibilityCriteria {
  notificationId: string;
  title: string;
  slug: string;
  ageLimitMin: number | null;
  ageLimitMax: number | null;
  qualificationRequired: string[];
  applicationStartDate: string;
  applicationEndDate: string;
  examStateOrCentral: string;     // e.g. "Karnataka" or "Central"
  examCategory: string;
  status: string;
}

export interface EligibilityDimension {
  name: "age" | "qualification" | "state" | "deadline";
  status: "eligible" | "ineligible" | "unknown" | "expiring";
  score: number;                  // 0-100 for this dimension
  detail: string;                 // Human-readable explanation
}

export interface EligibilityResult {
  notificationId: string;
  title: string;
  slug: string;
  overallScore: number;           // 0-100 composite eligibility score
  isEligible: boolean;            // true if score >= threshold
  dimensions: EligibilityDimension[];
  applicationEndDate: string;
  daysUntilDeadline: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Minimum composite score to consider a candidate "eligible" */
export const ELIGIBILITY_THRESHOLD = 50;

/** Weight distribution across matching dimensions (must sum to 100) */
export const DIMENSION_WEIGHTS = {
  age: 30,
  qualification: 30,
  state: 20,
  deadline: 20,
} as const;

/**
 * Age relaxation rules per Indian government norms.
 * Applied on top of the base age_limit_max.
 */
export const AGE_RELAXATION: Record<string, number> = {
  GM: 0,
  General: 0,
  OBC: 3,
  SC: 5,
  ST: 5,
  EWS: 0,
  "Ex-Servicemen": 5,
  PwD: 10,
};

/**
 * Qualification hierarchy for matching.
 * Higher index = higher qualification. A candidate with a higher
 * qualification is eligible for exams requiring lower ones.
 */
export const QUALIFICATION_HIERARCHY: string[] = [
  "8th",
  "10th",
  "12th",
  "ITI",
  "Diploma",
  "Graduate",
  "Post Graduate",
  "Engineering",
  "Medical",
  "Law",
  "PhD",
];

// ─── Core Matching Functions ─────────────────────────────────────────────────

/**
 * Calculates candidate's age in completed years as of a reference date.
 *
 * @param dateOfBirth - Candidate birth date string (YYYY-MM-DD)
 * @param referenceDate - Reference calculation date (defaults to current date)
 * @returns Completed age in years
 */
export function calculateAge(dateOfBirth: string, referenceDate: Date = new Date()): number {
  const dob = new Date(dateOfBirth);
  let age = referenceDate.getFullYear() - dob.getFullYear();
  const monthDiff = referenceDate.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/**
 * Evaluates age eligibility with category-based reservation relaxation.
 *
 * @param profile - Candidate profile containing DOB and reservation category
 * @param criteria - Notification eligibility criteria containing age min/max
 * @returns Evaluated age dimension
 */
export function evaluateAgeDimension(
  profile: CandidateProfile,
  criteria: NotificationEligibilityCriteria
): EligibilityDimension {
  if (!profile.dateOfBirth) {
    return {
      name: "age",
      status: "unknown",
      score: 50,  // Neutral — do not penalize incomplete profiles
      detail: "Date of birth not provided. Complete your profile for accurate matching.",
    };
  }

  if (criteria.ageLimitMin === null && criteria.ageLimitMax === null) {
    return {
      name: "age",
      status: "eligible",
      score: 100,
      detail: "No age restriction for this exam.",
    };
  }

  const referenceDate = new Date(criteria.applicationEndDate);
  const age = calculateAge(profile.dateOfBirth, referenceDate);
  const relaxation = AGE_RELAXATION[profile.category || "GM"] || 0;
  const effectiveMaxAge = (criteria.ageLimitMax || 65) + relaxation;
  const effectiveMinAge = criteria.ageLimitMin || 18;

  if (age >= effectiveMinAge && age <= effectiveMaxAge) {
    const relaxationNote = relaxation > 0
      ? ` (includes +${relaxation} years ${profile.category} relaxation)`
      : "";
    return {
      name: "age",
      status: "eligible",
      score: 100,
      detail: `Age ${age} is within the eligible range ${effectiveMinAge}–${effectiveMaxAge}${relaxationNote}.`,
    };
  }

  return {
    name: "age",
    status: "ineligible",
    score: 0,
    detail: `Age ${age} is outside the eligible range ${effectiveMinAge}–${effectiveMaxAge}.`,
  };
}

/**
 * Evaluates qualification match using hierarchy-based comparison.
 * Higher qualifications qualify candidates for lower prerequisite tiers.
 *
 * @param profile - Candidate profile containing qualifications
 * @param criteria - Notification criteria containing required qualifications
 * @returns Evaluated qualification dimension
 */
export function evaluateQualificationDimension(
  profile: CandidateProfile,
  criteria: NotificationEligibilityCriteria
): EligibilityDimension {
  if (!criteria.qualificationRequired || criteria.qualificationRequired.length === 0) {
    return {
      name: "qualification",
      status: "eligible",
      score: 100,
      detail: "No specific qualification requirement listed.",
    };
  }

  if (!profile.qualifications || profile.qualifications.length === 0) {
    return {
      name: "qualification",
      status: "unknown",
      score: 50,
      detail: "Qualification not provided. Complete your profile for accurate matching.",
    };
  }

  // Normalize for comparison
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  const candidateMaxIndex = Math.max(
    ...profile.qualifications.map((q) => {
      const idx = QUALIFICATION_HIERARCHY.findIndex(
        (h) => normalize(h) === normalize(q)
      );
      return idx >= 0 ? idx : -1;
    })
  );

  const requiredMinIndex = Math.min(
    ...criteria.qualificationRequired.map((q) => {
      const idx = QUALIFICATION_HIERARCHY.findIndex(
        (h) => normalize(h) === normalize(q)
      );
      return idx >= 0 ? idx : QUALIFICATION_HIERARCHY.length;
    })
  );

  if (candidateMaxIndex >= requiredMinIndex) {
    return {
      name: "qualification",
      status: "eligible",
      score: 100,
      detail: `Your qualification meets the requirement (${criteria.qualificationRequired.join(", ")}).`,
    };
  }

  // Check for exact text match fallback (handles non-hierarchical qualifications)
  const candidateNormalized = new Set(profile.qualifications.map(normalize));
  const hasExactMatch = criteria.qualificationRequired.some((q) =>
    candidateNormalized.has(normalize(q))
  );

  if (hasExactMatch) {
    return {
      name: "qualification",
      status: "eligible",
      score: 100,
      detail: "Direct qualification match found.",
    };
  }

  return {
    name: "qualification",
    status: "ineligible",
    score: 0,
    detail: `Required: ${criteria.qualificationRequired.join(", ")}. Your highest: ${profile.qualifications[profile.qualifications.length - 1]}.`,
  };
}

/**
 * Evaluates state/domicile compatibility between candidate and notification.
 * Central/All-India exams are available to all candidates.
 *
 * @param profile - Candidate profile containing state domicile
 * @param criteria - Notification criteria containing exam jurisdiction
 * @returns Evaluated state dimension
 */
export function evaluateStateDimension(
  profile: CandidateProfile,
  criteria: NotificationEligibilityCriteria
): EligibilityDimension {
  // Central exams are open to all states
  const examLoc = (criteria.examStateOrCentral || "").toLowerCase().trim();
  if (examLoc === "central" || examLoc === "all india") {
    return {
      name: "state",
      status: "eligible",
      score: 100,
      detail: "Central/All-India exam — open to all states.",
    };
  }

  if (!profile.state) {
    return {
      name: "state",
      status: "unknown",
      score: 50,
      detail: "State not provided. Complete your profile for accurate matching.",
    };
  }

  const profileState = profile.state.toLowerCase().trim();
  const examState = examLoc;

  if (profileState === examState) {
    return {
      name: "state",
      status: "eligible",
      score: 100,
      detail: `Your state (${profile.state}) matches the exam state.`,
    };
  }

  return {
    name: "state",
    status: "ineligible",
    score: 0,
    detail: `This exam is for ${criteria.examStateOrCentral} domicile. Your state: ${profile.state}.`,
  };
}

/**
 * Evaluates application deadline proximity.
 *
 * @param criteria - Notification criteria containing application end date
 * @returns Evaluated deadline dimension
 */
export function evaluateDeadlineDimension(
  criteria: NotificationEligibilityCriteria
): EligibilityDimension {
  const now = new Date();
  const deadline = new Date(criteria.applicationEndDate);
  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return {
      name: "deadline",
      status: "ineligible",
      score: 0,
      detail: "Application deadline has passed.",
    };
  }

  if (daysLeft <= 3) {
    return {
      name: "deadline",
      status: "expiring",
      score: 30,
      detail: `⚠️ Only ${daysLeft} day(s) left to apply!`,
    };
  }

  if (daysLeft <= 7) {
    return {
      name: "deadline",
      status: "expiring",
      score: 60,
      detail: `${daysLeft} days remaining. Apply soon.`,
    };
  }

  return {
    name: "deadline",
    status: "eligible",
    score: 100,
    detail: `${daysLeft} days remaining to apply.`,
  };
}

/**
 * Computes the composite weighted eligibility score across all dimensions.
 *
 * @param dimensions - List of evaluated dimension objects
 * @returns Composite integer score between 0 and 100
 */
export function computeEligibilityScore(dimensions: EligibilityDimension[]): number {
  let totalWeight = 0;
  let weightedScore = 0;

  for (const dim of dimensions) {
    const weight = DIMENSION_WEIGHTS[dim.name] || 0;
    totalWeight += weight;
    weightedScore += dim.score * weight;
  }

  return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
}

// ─── Main Matching Orchestrator ──────────────────────────────────────────────

/**
 * Matches a candidate profile against a set of notification criteria.
 * Returns sorted eligibility results (highest score first).
 *
 * @param profile - Candidate's profile data
 * @param notifications - Array of notification eligibility criteria
 * @returns Sorted array of eligibility results
 */
export function matchCandidateToNotifications(
  profile: CandidateProfile,
  notifications: NotificationEligibilityCriteria[]
): EligibilityResult[] {
  const results: EligibilityResult[] = [];

  for (const notif of notifications) {
    // Skip non-published notifications
    if (notif.status !== "published") continue;

    const ageDim = evaluateAgeDimension(profile, notif);
    const qualDim = evaluateQualificationDimension(profile, notif);
    const stateDim = evaluateStateDimension(profile, notif);
    const deadlineDim = evaluateDeadlineDimension(notif);

    // Skip expired notifications entirely
    if (deadlineDim.status === "ineligible") continue;

    const dimensions: EligibilityDimension[] = [ageDim, qualDim, stateDim, deadlineDim];
    const overallScore = computeEligibilityScore(dimensions);
    const daysLeft = Math.ceil(
      (new Date(notif.applicationEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    results.push({
      notificationId: notif.notificationId,
      title: notif.title,
      slug: notif.slug,
      overallScore,
      isEligible: overallScore >= ELIGIBILITY_THRESHOLD,
      dimensions,
      applicationEndDate: notif.applicationEndDate,
      daysUntilDeadline: Math.max(0, daysLeft),
    });
  }

  // Sort: eligible first, then by score descending, then by deadline ascending
  return results.sort((a, b) => {
    if (a.isEligible !== b.isEligible) return a.isEligible ? -1 : 1;
    if (a.overallScore !== b.overallScore) return b.overallScore - a.overallScore;
    return a.daysUntilDeadline - b.daysUntilDeadline;
  });
}
