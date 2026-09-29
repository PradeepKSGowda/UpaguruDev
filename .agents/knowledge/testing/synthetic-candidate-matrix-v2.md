# Synthetic Candidate Test Matrix & Eligibility Evaluation System (v2.0)
**Document Ref**: `ADR-016` / `ENH-CANDIDATE-TEST-MATRIX`  
**Engine Version**: `2.0.0`  
**Date**: `2026-09-26`  
**Dependencies**: `EPIC-01`, `EPIC-02`, `EPIC-03`, `EPIC-04`

---

## 1. Architectural Intent
The `ENH-CANDIDATE-TEST-MATRIX` establishes an isolated, reproducible, mathematical test matrix of 120 deterministic synthetic candidates (`TC-0001` through `TC-0120`) and couples it with Eligibility Rules Engine v2.0.0. The engine natively consumes recruitment rules extracted by the Gemini AI pipeline in `EPIC-04` (`NotificationExtractedData` and `draft_notifications`).

---

## 2. Core Architectural Principles

### 2.1 The Non-Guessing Contract (`INDETERMINATE`)
Unlike basic matching engines that coerce unknown criteria to an automatic pass or fail:
1. **Missing Cutoff Date**: If the notification fails to declare a reference date for age calculation, the age rule resolves to `status: "INDETERMINATE"`. The engine strictly refuses to assume "today's date".
2. **Extraction Confidence Gate**: If `extraction_confidence_score < 0.85` on an unverified notification, the evaluation evaluates to `INDETERMINATE` with an explicit reason citing low AI extraction confidence.
3. **Missing Profile KYC**: Incomplete candidate KYC attributes yield `INDETERMINATE` on the respective rule.

### 2.2 Boundary & Relaxation Stacking
- **Age Calculations**: Evaluated as completed years and days as of the exact reference cutoff date. Boundaries tested: min $\pm 2$d, min $\pm 1$d, min exact; max $\pm 1$d, max $\pm 1$y, max exact.
- **Relaxations**: OBC (+3y), SC/ST (+5y), Ex-Servicemen (+5y), PwBD (+10y).
- **Stacking Policy**: Documented standard rule applies `Math.max(catRelaxation, specialRelaxation)` unless cumulative addition is explicitly mandated by notification clauses.

### 2.3 Article 371(J) Kalyana Karnataka Domicile
The engine separates geographic residence from certified domicile status:
- Candidate residing in Kalaburagi with `has_domicile_certificate = true` qualifies for 371(J) local reservation cadre.
- Candidate residing in Kalaburagi with `has_domicile_certificate = false` is rejected from the local quota with reason *"Candidate resides in Kalyana Karnataka district but lacks mandatory Article 371(J) domicile eligibility certificate"*, though remaining eligible for non-local state quotas.

### 2.4 DPDP Compliance & Isolation
- 100% synthetic mathematical construction (zero sampling of real candidate records).
- Strictly reserved test domain `@upaguru.test` (`tc0001@upaguru.test`).
- Hardcoded safety constraints in `cleanup-test-users.ts` preventing deletion of any record lacking the `@upaguru.test` suffix.

---

## 3. Performance & Scalability
- **Benchmark Target**: < 250 ms for 120 candidates against one notification.
- **Actual Measurement**: **1.47 ms** in-memory batch evaluation via `evaluateCandidateMatrix()`.
- **CI/CD Hook**: Executed on every pull request via `npm run test:eligibility`.
