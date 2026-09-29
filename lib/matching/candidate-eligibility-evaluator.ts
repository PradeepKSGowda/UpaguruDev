/**
 * @file lib/matching/candidate-eligibility-evaluator.ts
 * @description Advanced multi-dimensional, confidence-aware eligibility evaluation engine (v2.0.0).
 * Consumes candidate KYC profiles and EPIC-04 NotificationExtractedData / Notification models.
 * Evaluates Age, Education, Specialization, Location/Domicile, and Category with full auditable
 * rule breakdowns, rejection explanations, and INDETERMINATE handling for missing or low-confidence data.
 *
 * Enhancement: ENH-CANDIDATE-TEST-MATRIX
 * Version: 2.0.0
 */

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface CandidateKYCProfile {
  candidate_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  date_of_birth: string | null;     // ISO date YYYY-MM-DD
  gender?: string | null;
  marital_status?: string | null;
  category: string | null;          // "GM" | "OBC" | "SC" | "ST" | "EWS"
  qualifications?: string[];        // ["10th", "12th", "Graduate", "Engineering"]
  highest_degree?: string | null;   // "BE", "Diploma", "SSLC"
  specialization?: string | null;   // "Computer Science", "Civil Engineering"
  state: string | null;             // "Karnataka", "Maharashtra"
  district?: string | null;         // "Bengaluru Urban", "Kalaburagi"
  region?: string | null;           // "Kalyana Karnataka", "Non-KK"
  has_domicile_certificate?: boolean; // 371(J) certificate
  is_ex_serviceman?: boolean;
  is_pwd?: boolean;
  is_sports_quota?: boolean;
  is_test_user?: boolean;
}

export interface ExtractedNotificationRule {
  notification_id: string;
  title: string;
  conducting_body?: string;
  notification_number?: string | null;
  state_or_central?: string | null; // "Karnataka" | "Central" | "All India"
  category?: string | null;
  is_published?: boolean;
  is_corrigendum?: boolean;
  corrigendum_details?: string | null;
  revision?: number;
  extraction_confidence_score?: number | null; // 0.0 - 1.0 (EPIC-04 confidence)
  important_dates?: {
    notification_date?: string | null;
    application_start?: string | null;
    application_end?: string | null;
    exam_date?: string | null;
  };
  age_limits?: {
    min_age?: number | null;
    max_age?: number | null;
    cutoff_date?: string | null;   // Reference calculation date YYYY-MM-DD
    relaxation_details?: Record<string, number> | null;
  };
  qualifications?: Array<{
    degree_level: string;
    discipline?: string | null;
    mandatory_certifications?: string[];
    experience_years?: number | null;
  }>;
  quota_reserved_for?: string | null; // e.g. "UR", "SC", "OBC", "Kalyana Karnataka 371(J)"
}

export type RuleStatus = "PASS" | "FAIL" | "INDETERMINATE";

export interface SingleRuleOutcome {
  rule_name: "age" | "education" | "specialization" | "location" | "category" | "experience";
  status: RuleStatus;
  detail: string;
}

export interface CandidateEvaluationResult {
  candidate_id: string;
  candidate_name: string;
  notification_id: string;
  status: "ELIGIBLE" | "INELIGIBLE" | "INDETERMINATE";
  eligible: boolean | null; // true for ELIGIBLE, false for INELIGIBLE, null for INDETERMINATE
  reasons: string[];
  matched_rules: string[];
  failed_rules: string[];
  rule_breakdown: Record<string, SingleRuleOutcome>;
  rule_engine_version: string;
  notification_confidence: number | null;
  corrigendum_revision: number;
  evaluated_at: string;
}

export interface BatchEvaluationSummary {
  notification_id: string;
  total_candidates: number;
  eligible_count: number;
  ineligible_count: number;
  indeterminate_count: number;
  reasons_frequency: Record<string, number>;
  evaluation_duration_ms: number;
  results: CandidateEvaluationResult[];
}

// ─── Constants & Hierarchy ──────────────────────────────────────────────────

export const RULE_ENGINE_VERSION = "2.0.0";
export const CONFIDENCE_VERIFICATION_THRESHOLD = 0.85;

export const STANDARD_AGE_RELAXATION: Record<string, number> = {
  GM: 0,
  General: 0,
  UR: 0,
  OBC: 3,
  SC: 5,
  ST: 5,
  EWS: 0,
  "Ex-Servicemen": 5,
  PwD: 10,
  PwBD: 10,
};

export const EDUCATION_TIER_HIERARCHY: string[] = [
  "8th",
  "10th",
  "12th",
  "iti",
  "diploma",
  "graduate",
  "bachelor",
  "bachelor's degree",
  "post graduate",
  "master",
  "master's degree",
  "engineering",
  "medical",
  "law",
  "phd",
];

const DEGREE_TIER_MAP: Record<string, string> = {
  sslc: "10th",
  "10th": "10th",
  puc: "12th",
  "12th": "12th",
  iti: "iti",
  diploma: "diploma",
  be: "engineering",
  btech: "engineering",
  engineering: "engineering",
  bsc: "graduate",
  bcom: "graduate",
  ba: "graduate",
  graduate: "graduate",
  "bachelor's degree": "graduate",
  bachelor: "graduate",
  ma: "post graduate",
  msc: "post graduate",
  mcom: "post graduate",
  mba: "post graduate",
  mca: "post graduate",
  "post graduate": "post graduate",
  "master's degree": "post graduate",
  master: "post graduate",
  mbbs: "medical",
  medical: "medical",
  llb: "law",
  law: "law",
  phd: "phd",
};

// ─── Utility Calculations ───────────────────────────────────────────────────

/**
 * Calculates completed age in years and remaining days as of a reference date.
 */
export function calculatePreciseAge(
  dobIso: string,
  refDateIso: string
): { completedYears: number; extraDays: number; isUnderage: boolean } {
  const [bYear, bMonth, bDay] = dobIso.split("-").map(Number);
  const [rYear, rMonth, rDay] = refDateIso.split("-").map(Number);

  const dob = new Date(Date.UTC(bYear, bMonth - 1, bDay));
  const ref = new Date(Date.UTC(rYear, rMonth - 1, rDay));

  let years = rYear - bYear;
  let birthdayThisYear = new Date(Date.UTC(rYear, bMonth - 1, bDay));

  if (ref.getTime() < birthdayThisYear.getTime()) {
    years--;
    birthdayThisYear = new Date(Date.UTC(rYear - 1, bMonth - 1, bDay));
  }

  const diffMs = ref.getTime() - birthdayThisYear.getTime();
  const extraDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return {
    completedYears: years,
    extraDays,
    isUnderage: years < 18,
  };
}

/**
 * Evaluates candidate age eligibility against notification age boundaries.
 */
export function evaluateAgeRule(
  candidate: CandidateKYCProfile,
  notification: ExtractedNotificationRule
): SingleRuleOutcome {
  if (!candidate.date_of_birth) {
    return {
      rule_name: "age",
      status: "INDETERMINATE",
      detail: "Candidate profile does not specify date of birth",
    };
  }

  const ageLimits = notification.age_limits;
  if (!ageLimits || (ageLimits.min_age == null && ageLimits.max_age == null)) {
    return {
      rule_name: "age",
      status: "PASS",
      detail: "No age limits specified for this notification",
    };
  }

  // Section 7a: Do NOT default to today if cutoff date is missing
  const cutoffDate = ageLimits.cutoff_date || notification.important_dates?.application_end;
  if (!cutoffDate) {
    return {
      rule_name: "age",
      status: "INDETERMINATE",
      detail: "Notification does not specify reference/cutoff date for age calculation",
    };
  }

  const { completedYears, extraDays } = calculatePreciseAge(candidate.date_of_birth, cutoffDate);

  const minAge = ageLimits.min_age ?? 18;
  const baseMaxAge = ageLimits.max_age ?? 65;

  // Under-age evaluation
  if (completedYears < minAge) {
    return {
      rule_name: "age",
      status: "FAIL",
      detail: `Candidate is below the minimum age of ${minAge} years as of reference date ${cutoffDate}`,
    };
  }

  // Relaxation evaluation with stacking policy (Section 8a: max applicable)
  const candidateCat = (candidate.category || "GM").toUpperCase();
  const catRelaxation =
    notification.age_limits?.relaxation_details?.[candidateCat] ??
    STANDARD_AGE_RELAXATION[candidateCat] ??
    0;

  let specialRelaxation = 0;
  if (candidate.is_ex_serviceman) {
    specialRelaxation = Math.max(
      specialRelaxation,
      notification.age_limits?.relaxation_details?.["Ex-Servicemen"] ?? STANDARD_AGE_RELAXATION["Ex-Servicemen"]
    );
  }
  if (candidate.is_pwd) {
    specialRelaxation = Math.max(
      specialRelaxation,
      notification.age_limits?.relaxation_details?.["PwBD"] ??
        notification.age_limits?.relaxation_details?.["PwD"] ??
        STANDARD_AGE_RELAXATION["PwBD"]
    );
  }

  // Apply maximum applicable relaxation
  const totalRelaxation = Math.max(catRelaxation, specialRelaxation);
  const effectiveMaxAge = baseMaxAge + totalRelaxation;

  // Max age evaluation: candidate must not exceed effectiveMaxAge
  // If completedYears > effectiveMaxAge, or completedYears === effectiveMaxAge with extraDays > 0, they exceeded max age
  if (completedYears > effectiveMaxAge || (completedYears === effectiveMaxAge && extraDays > 0)) {
    const relaxationClause =
      totalRelaxation > 0 ? ` (with ${candidate.category} relaxation)` : "";
    return {
      rule_name: "age",
      status: "FAIL",
      detail: `Candidate exceeds maximum allowed age of ${effectiveMaxAge} years${relaxationClause} as of reference date ${cutoffDate}`,
    };
  }

  return {
    rule_name: "age",
    status: "PASS",
    detail: `Candidate age (${completedYears} years) satisfies permissible range ${minAge}–${effectiveMaxAge} as of ${cutoffDate}`,
  };
}

/**
 * Evaluates candidate educational qualifications & specialization.
 */
export function evaluateEducationRule(
  candidate: CandidateKYCProfile,
  notification: ExtractedNotificationRule
): SingleRuleOutcome {
  const reqQuals = notification.qualifications;
  if (!reqQuals || reqQuals.length === 0) {
    return {
      rule_name: "education",
      status: "PASS",
      detail: "No mandatory educational qualification prescribed",
    };
  }

  const candidateDegree = (candidate.highest_degree || "").toLowerCase().trim();
  const candidateQuals = (candidate.qualifications || []).map((q) => q.toLowerCase().trim());

  if (!candidateDegree && candidateQuals.length === 0) {
    return {
      rule_name: "education",
      status: "INDETERMINATE",
      detail: "Candidate profile does not specify educational qualification",
    };
  }

  const normalizeTier = (val: string) => DEGREE_TIER_MAP[val.toLowerCase()] || val.toLowerCase();
  const getTierIndex = (tier: string) => {
    const normalized = normalizeTier(tier);
    return EDUCATION_TIER_HIERARCHY.indexOf(normalized);
  };

  // Determine highest candidate tier
  const candidateTiers = [candidateDegree, ...candidateQuals].map(getTierIndex).filter((idx) => idx >= 0);
  const candidateMaxTier = candidateTiers.length > 0 ? Math.max(...candidateTiers) : -1;

  for (const req of reqQuals) {
    const reqTierIndex = getTierIndex(req.degree_level);
    const reqLevelName = req.degree_level;

    // Check tier hierarchy
    if (candidateMaxTier < reqTierIndex && candidateMaxTier !== -1) {
      const candidateDisplayName = candidate.highest_degree || candidateQuals[candidateQuals.length - 1] || "None";
      return {
        rule_name: "education",
        status: "FAIL",
        detail: `Candidate qualification (${candidateDisplayName}) does not meet the minimum requirement of ${reqLevelName}`,
      };
    }

    // Check specialization if explicitly required
    if (req.discipline) {
      const reqDiscipline = req.discipline.toLowerCase().trim();
      const candSpecialization = (candidate.specialization || "").toLowerCase().trim();

      if (!candSpecialization) {
        return {
          rule_name: "education",
          status: "FAIL",
          detail: `Required specialization is ${req.discipline}. Candidate has no specialization specified.`,
        };
      }

      if (!candSpecialization.includes(reqDiscipline) && !reqDiscipline.includes(candSpecialization)) {
        return {
          rule_name: "education",
          status: "FAIL",
          detail: `Required specialization is ${req.discipline}. Candidate has ${candidate.specialization}.`,
        };
      }
    }
  }

  return {
    rule_name: "education",
    status: "PASS",
    detail: "Candidate educational qualifications meet notification requirements",
  };
}

/**
 * Evaluates state jurisdiction, location, and Article 371(J) local cadre rules.
 */
export function evaluateLocationRule(
  candidate: CandidateKYCProfile,
  notification: ExtractedNotificationRule
): SingleRuleOutcome {
  const examScope = (notification.state_or_central || "central").toLowerCase().trim();

  // Central / All-India posts are open to candidates across all states
  if (examScope === "central" || examScope === "all india") {
    return {
      rule_name: "location",
      status: "PASS",
      detail: "Central / All-India exam open to candidates from all states",
    };
  }

  if (!candidate.state) {
    return {
      rule_name: "location",
      status: "INDETERMINATE",
      detail: "Candidate profile does not specify state domicile",
    };
  }

  const candState = candidate.state.toLowerCase().trim();
  if (candState !== examScope) {
    return {
      rule_name: "location",
      status: "FAIL",
      detail: `This exam is for ${notification.state_or_central} domicile. Candidate state is ${candidate.state}.`,
    };
  }

  // Kalyana Karnataka 371(J) Domicile Quota Check
  if (notification.quota_reserved_for?.toLowerCase().includes("kalyana karnataka") ||
      notification.quota_reserved_for?.includes("371(J)")) {
    const isKKRegion = candidate.region === "Kalyana Karnataka";
    const hasCert = candidate.has_domicile_certificate === true;

    if (!isKKRegion) {
      return {
        rule_name: "location",
        status: "FAIL",
        detail: "Candidate is from non-Kalyana Karnataka region and not eligible for 371(J) local reservation",
      };
    }

    if (!hasCert) {
      return {
        rule_name: "location",
        status: "FAIL",
        detail: "Candidate resides in Kalyana Karnataka district but lacks mandatory Article 371(J) domicile eligibility certificate",
      };
    }
  }

  return {
    rule_name: "location",
    status: "PASS",
    detail: `Candidate state (${candidate.state}) matches required exam jurisdiction`,
  };
}

/**
 * Evaluates candidate reservation category against notification quotas.
 */
export function evaluateCategoryRule(
  candidate: CandidateKYCProfile,
  notification: ExtractedNotificationRule
): SingleRuleOutcome {
  const quota = (notification.quota_reserved_for || "UR").toUpperCase();

  // General / UR seats are open to all categories on merit
  if (quota === "UR" || quota === "GM" || quota === "GENERAL") {
    return {
      rule_name: "category",
      status: "PASS",
      detail: "Candidate is eligible to compete for Unreserved (UR) seats",
    };
  }

  // Regional / domicile quotas (e.g. Article 371(J)) are governed by location rules
  if (quota.includes("371(J)") || quota.includes("KALYANA KARNATAKA") || quota.includes("LOCAL CADRE")) {
    return {
      rule_name: "category",
      status: "PASS",
      detail: "Regional / Article 371(J) local quota post — caste category not restricted",
    };
  }

  const candCategory = (candidate.category || "GM").toUpperCase();
  if (candCategory !== quota) {
    return {
      rule_name: "category",
      status: "FAIL",
      detail: `Post is exclusively reserved for ${quota} candidates. Candidate category is ${candCategory}.`,
    };
  }

  return {
    rule_name: "category",
    status: "PASS",
    detail: `Candidate category (${candCategory}) matches post reservation quota (${quota})`,
  };
}

// ─── Main Single Evaluation Engine ──────────────────────────────────────────

/**
 * Evaluates a single candidate profile against a recruitment notification.
 *
 * @param candidate - Candidate KYC record
 * @param notification - Extracted recruitment notification rules
 * @returns Fully auditable CandidateEvaluationResult
 */
export function evaluateCandidateEligibility(
  candidate: CandidateKYCProfile,
  notification: ExtractedNotificationRule
): CandidateEvaluationResult {
  const reasons: string[] = [];
  const matchedRules: string[] = [];
  const failedRules: string[] = [];
  const ruleBreakdown: Record<string, SingleRuleOutcome> = {};

  // Section 22a: Confidence Score Gate
  const confidence = notification.extraction_confidence_score ?? 1.0;
  if (confidence < CONFIDENCE_VERIFICATION_THRESHOLD && notification.is_published !== true) {
    const confidencePct = Math.round(confidence * 100);
    return {
      candidate_id: candidate.candidate_id,
      candidate_name: candidate.full_name,
      notification_id: notification.notification_id,
      status: "INDETERMINATE",
      eligible: null,
      reasons: [
        `Notification extraction confidence (${confidencePct}%) is below verification threshold (${Math.round(CONFIDENCE_VERIFICATION_THRESHOLD * 100)}%)`,
        ...(notification.age_limits?.cutoff_date == null
          ? ["Notification does not specify reference/cutoff date for age calculation"]
          : []),
      ],
      matched_rules: [],
      failed_rules: [],
      rule_breakdown: {},
      rule_engine_version: RULE_ENGINE_VERSION,
      notification_confidence: confidence,
      corrigendum_revision: notification.revision ?? 1,
      evaluated_at: new Date().toISOString(),
    };
  }

  // 1. Evaluate Age
  const ageOutcome = evaluateAgeRule(candidate, notification);
  ruleBreakdown.age = ageOutcome;
  if (ageOutcome.status === "FAIL") {
    failedRules.push("age");
    reasons.push(ageOutcome.detail);
  } else if (ageOutcome.status === "PASS") {
    matchedRules.push("age");
    if (candidate.category && candidate.category !== "GM") {
      matchedRules.push("category_relaxation");
    }
  } else if (ageOutcome.status === "INDETERMINATE") {
    reasons.push(ageOutcome.detail);
  }

  // 2. Evaluate Education
  const eduOutcome = evaluateEducationRule(candidate, notification);
  ruleBreakdown.education = eduOutcome;
  if (eduOutcome.status === "FAIL") {
    failedRules.push("education");
    reasons.push(eduOutcome.detail);
  } else if (eduOutcome.status === "PASS") {
    matchedRules.push("education");
  } else if (eduOutcome.status === "INDETERMINATE") {
    reasons.push(eduOutcome.detail);
  }

  // 3. Evaluate Location
  const locOutcome = evaluateLocationRule(candidate, notification);
  ruleBreakdown.location = locOutcome;
  if (locOutcome.status === "FAIL") {
    failedRules.push("location");
    reasons.push(locOutcome.detail);
  } else if (locOutcome.status === "PASS") {
    matchedRules.push("location");
  } else if (locOutcome.status === "INDETERMINATE") {
    reasons.push(locOutcome.detail);
  }

  // 4. Evaluate Category
  const catOutcome = evaluateCategoryRule(candidate, notification);
  ruleBreakdown.category = catOutcome;
  if (catOutcome.status === "FAIL") {
    failedRules.push("category");
    reasons.push(catOutcome.detail);
  } else if (catOutcome.status === "PASS") {
    if (!matchedRules.includes("category")) {
      matchedRules.push("category");
    }
  }

  // Determine overall status
  const hasIndeterminate = Object.values(ruleBreakdown).some((r) => r.status === "INDETERMINATE");
  const hasFail = failedRules.length > 0;

  let overallStatus: "ELIGIBLE" | "INELIGIBLE" | "INDETERMINATE";
  let isEligible: boolean | null;

  if (hasFail) {
    overallStatus = "INELIGIBLE";
    isEligible = false;
  } else if (hasIndeterminate) {
    overallStatus = "INDETERMINATE";
    isEligible = null;
  } else {
    overallStatus = "ELIGIBLE";
    isEligible = true;
  }

  return {
    candidate_id: candidate.candidate_id,
    candidate_name: candidate.full_name,
    notification_id: notification.notification_id,
    status: overallStatus,
    eligible: isEligible,
    reasons,
    matched_rules: matchedRules,
    failed_rules: failedRules,
    rule_breakdown: ruleBreakdown,
    rule_engine_version: RULE_ENGINE_VERSION,
    notification_confidence: confidence,
    corrigendum_revision: notification.revision ?? 1,
    evaluated_at: new Date().toISOString(),
  };
}

// ─── Batch Evaluation Orchestrator ──────────────────────────────────────────

/**
 * Evaluates an entire candidate population against a notification.
 * Measures duration and generates categorized failure frequencies.
 */
export function evaluateCandidateMatrix(
  candidates: CandidateKYCProfile[],
  notification: ExtractedNotificationRule
): BatchEvaluationSummary {
  const startTime = performance.now();
  const results: CandidateEvaluationResult[] = [];
  const reasonsFrequency: Record<string, number> = {};

  let eligibleCount = 0;
  let ineligibleCount = 0;
  let indeterminateCount = 0;

  for (const candidate of candidates) {
    const res = evaluateCandidateEligibility(candidate, notification);
    results.push(res);

    if (res.status === "ELIGIBLE") {
      eligibleCount++;
    } else if (res.status === "INELIGIBLE") {
      ineligibleCount++;
      for (const r of res.reasons) {
        reasonsFrequency[r] = (reasonsFrequency[r] || 0) + 1;
      }
    } else {
      indeterminateCount++;
      for (const r of res.reasons) {
        reasonsFrequency[r] = (reasonsFrequency[r] || 0) + 1;
      }
    }
  }

  const endTime = performance.now();

  return {
    notification_id: notification.notification_id,
    total_candidates: candidates.length,
    eligible_count: eligibleCount,
    ineligible_count: ineligibleCount,
    indeterminate_count: indeterminateCount,
    reasons_frequency: reasonsFrequency,
    evaluation_duration_ms: Math.round((endTime - startTime) * 100) / 100,
    results,
  };
}
