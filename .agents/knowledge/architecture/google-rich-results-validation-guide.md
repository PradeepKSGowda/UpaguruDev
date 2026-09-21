# Standard Operating Procedure: Google Rich Results Validation Guide

**Status**: Standard Architecture Knowledge  
**Module**: Testing, QA & Lighthouse Performance Validation (`EPIC-09` / `FEAT-0903`)  
**Applicable Tasks**: `TASK-09030102` (Subtask: `SUB-0903010201`)  
**Author**: SEO Engineer / QA Engineer  
**Last Updated**: 2026-09-20  

---

## 1. Executive Summary
This document defines the formal verification procedure for validating Schema.org structured data across UPA-GURU public pages against Google Search Central specifications.

Per **`AGENTS.md` Rule 4 (SEO & Performance Rules)**:
> **Structured Data**: All public notification pages (`/notification/[slug]`) must include valid Google-compliant `JobPosting` and `Event` JSON-LD schema tags.

Structured data empowers Google Search to render enhanced SERP rich snippets (Google for Jobs cards, carousel listings, event calendars, and hierarchical breadcrumb trails), dramatically elevating organic Click-Through Rates (CTR).

---

## 2. Supported Structured Data Schemas

### 2.1. `JobPosting` Schema (Candidate Notification Detail)
Rendered on `/notification/[slug]` to surface exam vacancies in the **Google for Jobs** interactive experience.

| Property | Level | Data Type | Expected Content / Format |
| :--- | :--- | :--- | :--- |
| `@context` | Mandatory | `Text` | `"https://schema.org"` |
| `@type` | Mandatory | `Text` | `"JobPosting"` |
| `title` | Mandatory | `Text` | Full official examination name (e.g., `"UPSC Civil Services Examination 2026"`) |
| `description` | Mandatory | `Text` | HTML-formatted or sanitized plaintext overview with eligibility, conducting body, and vacancies |
| `datePosted` | Mandatory | `DateTime` | ISO-8601 string (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ssZ`) |
| `validThrough` | Mandatory | `DateTime` | Application deadline in ISO-8601 format |
| `employmentType` | Mandatory | `Text` | `"FULL_TIME"` |
| `hiringOrganization`| Mandatory | `Organization` | Object with `name`, `sameAs` (official portal URL), and `logo` |
| `jobLocation` | Mandatory | `Place` | Official headquarters or administrative jurisdiction (`PostalAddress`) |
| `totalJobOpenings` | Recommended | `Integer` | Numerical vacancy count (omitted if 0 or unannounced) |
| `directApply` | Recommended | `Boolean` | `true` when direct application URL exists |
| `url` | Mandatory | `URL` | Canonical UPA-GURU notification URL (`https://upaguru.in/notification/[slug]`) |

### 2.2. `Event` Schema (Examination Schedule)
Rendered on `/notification/[slug]` when an examination date is scheduled.

| Property | Level | Data Type | Expected Content / Format |
| :--- | :--- | :--- | :--- |
| `@context` | Mandatory | `Text` | `"https://schema.org"` |
| `@type` | Mandatory | `Text` | `"Event"` |
| `name` | Mandatory | `Text` | Notification title + `" - Preliminary / Main Examination"` |
| `startDate` | Mandatory | `DateTime` | Exam date in ISO-8601 format |
| `eventStatus` | Mandatory | `Text` | `"https://schema.org/EventScheduled"` |
| `eventAttendanceMode`| Mandatory | `Text` | `"https://schema.org/OfflineEventAttendanceMode"` |
| `location` | Mandatory | `Place` | Examination regional centres across India |
| `organizer` | Mandatory | `Organization` | Official exam conducting board |

### 2.3. `BreadcrumbList` Schema (Hierarchical Navigation)
Rendered on all notification and category listing pages to generate Google SERP breadcrumb trails.

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://upaguru.in"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Civil Services",
      "item": "https://upaguru.in/?category=civil_services"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "UPSC Civil Services Examination 2026",
      "item": "https://upaguru.in/notification/upsc-civil-services-examination-2026"
    }
  ]
}
```

---

## 3. Step-by-Step Validation Procedure

### Step 1: Automated Unit Test Verification (Pre-Commit)
Before submitting code or staging deployments, verify that all JSON-LD generators pass unit validation:
```bash
npm run test -- tests/unit/seo/json-ld.test.ts
```
*Expected Outcome*: All test cases pass, confirming strict ISO-8601 formatting, valid entity nesting, and optional property omission handling.

### Step 2: Google Rich Results Test (Code Snippet Validation)
1. Open the [Google Rich Results Test Tool](https://search.google.com/test/rich-results).
2. Select the **`< > CODE`** tab.
3. Fetch or paste the rendered HTML (or JSON-LD payload) from `http://localhost:3000/notification/[slug]`:
   ```html
   <script type="application/ld+json">
   {
     "@context": "https://schema.org",
     "@type": "JobPosting",
     "title": "UPSC Civil Services Examination 2026",
     "description": "Union Public Service Commission (UPSC) has released the notification for UPSC Civil Services Examination 2026 with 1056 vacancies.",
     "datePosted": "2026-02-14T00:00:00.000Z",
     "validThrough": "2026-03-05T18:00:00.000Z",
     "employmentType": "FULL_TIME",
     "hiringOrganization": {
       "@type": "Organization",
       "name": "Union Public Service Commission",
       "sameAs": "https://upsc.gov.in"
     },
     "jobLocation": {
       "@type": "Place",
       "name": "Union Public Service Commission",
       "address": {
         "@type": "PostalAddress",
         "addressCountry": "IN",
         "addressRegion": "All India"
       }
     },
     "totalJobOpenings": 1056,
     "directApply": true,
     "url": "https://upaguru.in/notification/upsc-civil-services-examination-2026"
   }
   </script>
   ```
4. Click **TEST CODE**.
5. **Expected Results Checklist**:
   - Status: **Page is eligible for rich results** (Green checkmark).
   - Detected Items:
     - `JobPosting` (Valid, 0 errors).
     - `Event` (Valid, 0 errors).
     - `Breadcrumbs` (Valid, 0 errors).
   - Click **PREVIEW RESULTS** to verify the Google for Jobs snippet card rendering.

### Step 3: Schema Markup Validator (Semantic Compliance)
1. Open [Schema Markup Validator (validator.schema.org)](https://validator.schema.org/).
2. Paste the extracted JSON-LD script and run the validator.
3. Confirm **0 Errors** and **0 Warnings**.

---

## 4. Troubleshooting & Warning Remediation Matrix

| Warning / Issue | Root Cause | Remediation in `lib/seo/json-ld.ts` |
| :--- | :--- | :--- |
| `Missing field "baseSalary"` | Government exam notifications do not always define fixed base salaries prior to appointment. | This is an optional recommendation for JobPosting. It does not prevent rich results eligibility. If available in parsed payload, pass `baseSalary`. |
| `Missing field "validThrough"` | Application deadline was null or unannounced. | `lib/seo/json-ld.ts` falls back to `new Date(Date.now() + 30*86400000).toISOString()` if deadline is absent. |
| `Bad date format in "datePosted"` | Date string was unparseable. | Use `new Date(dateString).toISOString()` to guarantee valid ISO-8601 formatting. |
| `Missing field "applicantLocationRequirements"` | Telecommute / remote job properties missing. | Government competitive exams are physical appointments; `jobLocation` is specified with `addressCountry: "IN"`. |

---

## 5. Audit & Compliance Sign-Off Checklist

- [x] All public notification detail pages render valid `<script type="application/ld+json">` tags.
- [x] `JobPosting` contains mandatory `title`, `datePosted`, `validThrough`, `hiringOrganization`, and `jobLocation`.
- [x] Scheduled exams include accompanying `Event` schema with `startDate` and `eventStatus`.
- [x] Breadcrumbs represent correct three-tier site hierarchy with sequential 1-based indexing.
- [x] Google Rich Results Test passes with zero critical errors.
