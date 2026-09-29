# Synthetic Candidate Test Matrix — Changelog & Document Control

All modifications to the candidate population, boundary definitions, or expectation fixtures must be documented here.

---

## [2.0.0] — 2026-09-26
### Added
- Created 120 deterministic synthetic candidate profiles (`TC-0001` through `TC-0120`) in `candidates.json` and `candidates.csv`.
- Added age boundary matrices covering $\pm 2$ days, $\pm 1$ day, exact boundaries, and category relaxations (OBC, SC, ST, Ex-Servicemen, PwBD).
- Added Kalyana Karnataka (Article 371(J)) domicile test cases distinguishing geographic residency from certified domicile certificate status.
- Added regional script candidates (Kannada, Telugu) and transliteration edge cases (apostrophes, hyphenated names).
- Added indeterminate source profiles for missing candidate KYC data (`TC-0116` to `TC-0120`).
- Created golden expectation fixture `eligibility-expected-results.json` mapping test notifications to deterministic outcomes.
- Linked engine directly to EPIC-04 `NotificationExtractedData` schema with strict `INDETERMINATE` status for null reference dates or confidence $< 0.85$.
- Created `seed-test-users.ts` and `cleanup-test-users.ts` with strict safety guards protecting production data.
- Created `known-limitations.md` detailing unsupported criteria (experience, physical standards).
