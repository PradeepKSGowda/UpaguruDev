# Notification SEO & Structured Data Architecture Design

**Document ID**: `DESIGN-NOTIF-SEO-001`  
**Task Reference**: `TASK-02030103` (Subtasks: `SUB-0203010301`, `SUB-0203010302`)  
**Route**: `/notification/[slug]` (`app/notification/[slug]/page.tsx`, `lib/seo/json-ld.ts`)  
**Status**: Implemented  
**Date**: September 11, 2026  

---

## 1. Executive Summary & Goals

Government job notifications and competitive exam releases generate massive search volumes from aspirants searching for terms such as *"KPSC Gazetted Probationers 2026 notification"*, *"SSC CGL apply online last date"*, or *"UPSC Civil Services syllabus PDF"*.

This module delivers programmatic SEO optimization for every public notification landing page (`/notification/[slug]`), fulfilling:
1. **Dynamic Native Metadata API**: Automated generation of contextual HTML title, meta description, canonical URLs, and OpenGraph/Twitter card image tags.
2. **Google Rich Results Qualification**: Schema.org JSON-LD structured data generation for `JobPosting`, `BreadcrumbList`, and scheduled competitive `Event` schemas.
3. **Core Web Vitals Integrity**: Zero client-side computation overhead; JSON-LD schemas are generated server-side during RSC execution and pre-rendered via ISR.

---

## 2. Dynamic Metadata Specifications (SUB-0203010301)

### 2.1 Metadata Structure
- **Title Formula**:
  `{notification.title} - Apply Online | UPA-GURU`
- **Meta Description Formula**:
  `{notification.title}. Conducted by {exam.conductingBody}. Total Vacancies: {formatVacancies(vacancies)}. Last Date to Apply: {formatDisplayDate(applicationEndDate)}. Check eligibility, syllabus, exam pattern, and apply online.`
- **Canonical URL**:
  `https://upaguru.in/notification/{slug}`
- **OpenGraph Tags**:
  - `og:title`: Same as dynamic title
  - `og:description`: Same as dynamic description
  - `og:url`: Absolute canonical URL
  - `og:site_name`: `UPA-GURU`
  - `og:locale`: `en_IN`
  - `og:type`: `article`
  - `og:image`: Dynamic OpenGraph endpoint (`/api/og?title=...&body=...&vacancies=...`) formatted at 1200x630.
- **Robots Directives**:
  - Published notifications: `index: true, follow: true`, with Googlebot specific `max-image-preview: large`, `max-snippet: -1`.
  - Non-existent / unpublished slugs (404): `index: false, follow: false`.

---

## 3. Structured Data Specifications (SUB-0203010302)

Generated via `lib/seo/json-ld.ts` and injected into the `<head>` / root layout of `app/notification/[slug]/page.tsx`:

### 3.1 Schema.org `JobPosting`
Enables Google Search Jobs Rich Snippets (showing salary, closing date, vacancy count, and direct apply link in Google SERPs):
```json
{
  "@context": "https://schema.org",
  "@type": "JobPosting",
  "title": "KPSC Gazetted Probationers 2026",
  "description": "<p>Official notification for recruitment to KPSC Gazetted Probationers...</p>",
  "datePosted": "2026-09-01T00:00:00.000Z",
  "validThrough": "2026-10-15T23:59:59.000Z",
  "employmentType": "FULL_TIME",
  "hiringOrganization": {
    "@type": "Organization",
    "name": "Karnataka Public Service Commission",
    "sameAs": "https://kpsc.kar.nic.in",
    "logo": "https://upaguru.in/images/conducting-bodies/kpsc.png"
  },
  "jobLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "IN",
      "addressRegion": "Karnataka"
    }
  },
  "totalJobOpenings": 384,
  "educationRequirements": {
    "@type": "EducationalOccupationalCredential",
    "credentialCategory": "Bachelor's Degree in any discipline"
  },
  "directApply": true,
  "url": "https://upaguru.in/notification/kpsc-gazetted-probationers-2026"
}
```

### 3.2 Schema.org `Event` (Examination Event)
Generated dynamically when `notification.examDate` is available, qualifying the exam for Google Search Event listings:
```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "KPSC Gazetted Probationers Examination",
  "description": "Official competitive examination for KPSC Gazetted Probationers 2026 conducted by Karnataka Public Service Commission.",
  "startDate": "2026-12-10T00:00:00.000Z",
  "endDate": "2026-12-10T00:00:00.000Z",
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "location": {
    "@type": "Place",
    "name": "Designated Examination Centres in Karnataka",
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "IN",
      "addressRegion": "Karnataka"
    }
  },
  "organizer": {
    "@type": "Organization",
    "name": "Karnataka Public Service Commission",
    "sameAs": "https://kpsc.kar.nic.in"
  }
}
```

### 3.3 Schema.org `BreadcrumbList`
Communicates hierarchy to search engines (`Home > Category > Exam Notification`), replacing raw URL paths with structured breadcrumb rich snippets.

---

## 4. Architectural Safeguards
- **Null Safety**: When `applyOnlineUrl`, `officialPdfUrl`, or `examDate` are null, schema fields cleanly omit or degrade gracefully without emitting `undefined` values.
- **HTML Sanitization**: JobPosting HTML descriptions strip leading/trailing whitespace and invalid tags, meeting Google Rich Results Test formatting requirements.
