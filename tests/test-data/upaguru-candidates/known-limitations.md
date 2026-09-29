# UPA-GURU Eligibility Rules Engine — Known Limitations Register
**Enhancement ID**: `ENH-CANDIDATE-TEST-MATRIX`  
**Engine Version**: `2.0.0`  
**Last Updated**: `2026-09-26`  
**Governing Standard**: Prompt Section 31a (Explicit Contract for Evaluated vs. Indeterminate Rules)

---

## 1. Overview
This register documents all recruitment eligibility dimensions and special conditions that are **not fully evaluated** or **mapped to `INDETERMINATE`** by Eligibility Engine v2.0.0. 

In accordance with our strict non-guessing principle:
> If a rule cannot be evaluated with absolute determinism against verified candidate attributes, the engine returns `status: "INDETERMINATE"` with an explanatory reason code, rather than coercing an outcome to `ELIGIBLE` or `INELIGIBLE`.

---

## 2. Unsupported Rule Types & Indeterminate Mappings

| Dimension | Rule Type | Current Behavior | Target Release | Rationale & Remediation |
| :--- | :--- | :--- | :--- | :--- |
| **Experience** | Post-qualification experience (e.g. "3 years mandatory site experience") | Mapped to `INDETERMINATE` with warning *"Work experience criteria not yet modeled in candidate KYC"* | v2.2.0 | Candidate profile KYC currently stores degrees and disciplines, but does not capture granular employer-issued service certificate intervals. |
| **Physical Standards** | Uniform posts (Police, Sub-Inspector, Forest Guard, Excise) requiring height, chest, endurance | Mapped to `INDETERMINATE` with warning *"Physical standards criteria (height/chest) require manual physical test verification"* | v2.3.0 | Physical measurements belong to stage 2 (PST/PET) and are not self-attested candidate KYC fields. |
| **Typing / Shorthand** | Typist, Steno, Data Entry Operator speed certifications | Mapped to `INDETERMINATE` if notification marks speed mandatory | v2.2.0 | Technical board speed certificate numbers will be integrated into the Candidate Skills KYC schema. |
| **Document Validity** | NCL (Non-Creamy Layer) or EWS certificate financial year validity | Assumed valid if candidate profile claims category; flags warning if expired | v2.1.0 | Requires Digilocker API integration to verify actual caste/income certificate issuance dates. |
| **Negative Restrictions** | Debarment history, criminal convictions, pending disciplinary proceedings | Not evaluated | N/A | Government verification stage during Document Verification (DV). Outside automated portal scope. |
| **Dual Stacking Policy** | Unspecified cumulative relaxation (e.g. SC + Ex-Serviceman both claiming additive years) | Resolves to `Math.max(relaxation_A, relaxation_B)` | Documented Policy | Indian recruitment norms default to maximum applicable relaxation unless notification explicitly declares cumulative addition. |

---

## 3. Ambiguous Extraction Handling (EPIC-04 Linkage)
1. **Missing Reference Date**: If the notification's `age_limits.cutoff_date` is `null`, the age dimension immediately returns `INDETERMINATE`. The engine **never** defaults to today's date.
2. **Extraction Confidence < 85%**: If the notification has not been approved in Admin HITL (EPIC-03) and has extraction confidence below 0.85, the overall evaluation is flagged as `INDETERMINATE`.
3. **Ambiguous Qualification**: If notification states "Any Equivalent Qualification" without defining recognized equivalents, candidate profiles with related degrees are marked as `INDETERMINATE (Equivalence Pending Admin Clarification)`.

---

## 4. Contract Revision Log
- **2026-09-26 (v2.0.0)**: Initial register created. Documented experience, physical standards, typing speed, and missing reference date policies.
