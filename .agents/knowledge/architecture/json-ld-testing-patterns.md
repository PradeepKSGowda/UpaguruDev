# Architecture Knowledge: Schema.org JSON-LD Testing Patterns

**Status**: Standard Architecture Knowledge  
**Module**: Testing, QA & Lighthouse Performance Validation (`EPIC-09` / `FEAT-0901`)  
**Applicable Tasks**: `TASK-09010103`, `TASK-09030102`  
**Last Updated**: 2026-09-20  

---

## 1. Overview
Government competitive examinations and recruitment notifications rely on high-fidelity structured data to secure Google Rich Results (JobPosting rich snippets, Event schedules, Breadcrumbs). This document outlines the testing patterns, schema specifications, and fallback rules governing Schema.org structured data generators.

---

## 2. Established Testing Patterns

### Pattern 1: Google JobPosting Rich Results Conformance
Every `JobPosting` schema must be tested against Google Search Central requirements:
1. **Required Fields**:
   - `@context`: `"https://schema.org"`
   - `@type`: `"JobPosting"`
   - `title`: Clean exam title (e.g. "Civil Services Examination 2026").
   - `description`: Comprehensive HTML block containing vacancies, opening/closing dates, qualifications, and selection stages.
   - `datePosted`: ISO-8601 string.
   - `validThrough`: ISO-8601 string representing the application deadline.
   - `employmentType`: `"FULL_TIME"`.
   - `hiringOrganization`: `@type: "Organization"` with `name`, `sameAs`, and `logo`.
   - `jobLocation`: `@type: "Place"` with `PostalAddress` (`addressCountry: "IN"`).
2. **Conditional & Optional Enhancements**:
   - `totalJobOpenings`: Must be tested to confirm inclusion when vacancies $> 0$ and omission when vacancies $\le 0$.
   - `educationRequirements`: Must be tested to confirm inclusion when `qualificationRequired` has items and omission when empty.
   - `directApply`: Must evaluate to `true` if `applyOnlineUrl` exists, and `false` if `null` or empty string.

### Pattern 2: Regional Jurisdiction Mapping
Tests must verify administrative hierarchy differences:
- **Central Government Exams**: When `exam.stateOrCentral.toLowerCase() === "central"`, `addressRegion` must resolve to `"India (All India Service)"` and event centres must reference `"Across India"`.
- **State Government Exams**: State-specific exams (e.g. "Karnataka", "Maharashtra") must resolve `addressRegion` to the exact state name and localized test centre names.

### Pattern 3: Event Schema Null Safety
- Examination dates are frequently announced post-notification release.
- When `notification.examDate` is `null`, `undefined`, or empty string:
  - `generateEventSchema()` must return `null` rather than generating malformed empty `Event` JSON-LD.
  - `generateAllNotificationSchemas()` must exclude the `Event` schema, emitting only `JobPosting` and `BreadcrumbList`.
- When `examDate` is set:
  - `eventStatus` must equal `"https://schema.org/EventScheduled"`.
  - `eventAttendanceMode` must equal `"https://schema.org/OfflineEventAttendanceMode"`.

### Pattern 4: 3-Tier Breadcrumb Navigation
Breadcrumbs must be tested for strict 3-tier sequence:
- Position 1: `Home` (`https://upaguru.in`).
- Position 2: Exam Category (humanized label with uppercase and space formatting, linking to `/?category=...`).
- Position 3: Notification Title (canonical `/notification/[slug]`).

### Pattern 5: Generator Function Aliasing
Both direct generator function names (`generateJobPostingSchema`, `generateEventSchema`, `generateBreadcrumbSchema`) and alias names (`generateJobPostingJsonLd`, `generateEventJsonLd`, `generateBreadcrumbJsonLd`) must remain exported and tested for strict parity (`toEqual`).
