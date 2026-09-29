# UPA-GURU Synthetic Candidate Test Matrix & Eligibility Validation System
**Enhancement ID**: `ENH-CANDIDATE-TEST-MATRIX`  
**Engine Version**: `2.0.0`  
**Test Population**: 120 Deterministic Candidates (`TC-0001` – `TC-0120`)

---

## 1. Directory Structure

```
tests/test-data/upaguru-candidates/
├── README.md                          # Usage documentation and workflows
├── CHANGELOG.md                       # Matrix revision log
├── known-limitations.md               # Explicit register of unmodeled/indeterminate rules
├── candidates.json                    # 120 deterministic synthetic candidate profiles (JSON)
├── candidates.csv                     # 120 candidate profiles in CSV format for QA spreadsheets
├── education-matrix.json              # Hierarchy, degrees, and specialization definitions
├── age-matrix.json                    # Reference-date boundary calculations & relaxation rules
├── location-matrix.json               # State, district, and Article 371(J) domicile definitions
├── category-matrix.json               # Reservation quotas, special concessions, and relaxations
├── combination-matrix.json            # Pairwise multi-attribute scenarios & explicit risk cases
├── eligibility-expected-results.json  # Golden standard deterministic outputs for test notifications
├── generate-candidates.ts             # Regenerates candidates.json and candidates.csv deterministically
├── seed-test-users.ts                 # Database seeder for test/staging environments
└── cleanup-test-users.ts              # Teardown script (guaranteed zero-deletion on production users)
```

---

## 2. Test Population Coverage

| Dimension | Scenarios Covered | Candidate Range |
| :--- | :--- | :--- |
| **Age Boundaries** | Min $\pm 2$d, $\pm 1$d, exact; Max $\pm 1$d, $\pm 1$y, exact; Mid-range | `TC-0001` – `TC-0012` |
| **Age Relaxation** | OBC (+3y), SC/ST (+5y), Ex-Servicemen (+5y), PwBD (+10y), Stacked | `TC-0013` – `TC-0025` |
| **Education Tiers** | SSLC, PUC, ITI, Diploma, BE, BTech, BSc, BCom, BA, MA, MSc, MBA, MCA, MBBS, LLB | `TC-0026` – `TC-0045` |
| **Specialization & Equivalence** | Exact match, cross-discipline mismatch, superior degree tier, unspecified | `TC-0046` – `TC-0055` |
| **Location & Domicile** | Karnataka districts, Out-of-state, Central open, 371(J) with/without cert | `TC-0056` – `TC-0075` |
| **Category & Special Quotas** | GM, OBC, SC, ST, EWS, Ex-Servicemen, PwBD, Sports, Women, Transgender | `TC-0076` – `TC-0090` |
| **Multi-Condition Combinations** | Single failures, dual failures, all-three failures, corrigendum re-evaluation | `TC-0091` – `TC-0110` |
| **Name Script & Transliteration** | Kannada script, Telugu script, apostrophe names, hyphenated names | `TC-0111` – `TC-0115` |
| **Indeterminate Source Profiles** | Missing DOB, missing state, missing qualification, incomplete profile | `TC-0116` – `TC-0120` |

---

## 3. Data Privacy & Isolation Safeguards (DPDP Compliance)
1. **Zero Real PII**: Every candidate is synthetically constructed from mathematical boundary rules. No production records were sampled or perturbed.
2. **Domain Isolation**: All synthetic emails strictly use the reserved domain `@upaguru.test`.
3. **Database Flag**: All profiles carry `is_test_user: true`.
4. **Cleanup Safety**: `cleanup-test-users.ts` hardcodes a safety filter matching only `email LIKE '%@upaguru.test'` and aborts immediately if any non-test record is targeted.

---

## 4. Execution Commands

### Run Eligibility Regression Suite:
```bash
npm run test:eligibility
```

### Seed Test Candidates in Test Database:
```bash
npx tsx tests/test-data/upaguru-candidates/seed-test-users.ts
```

### Cleanup Test Candidates:
```bash
npx tsx tests/test-data/upaguru-candidates/cleanup-test-users.ts
```
