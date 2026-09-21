/**
 * @file tests/unit/seo/json-ld.test.ts
 * @description Unit tests for Schema.org JSON-LD structured data generators.
 * 
 * Task ID: TASK-09010103
 * Subtask: SUB-0901010301
 * Architecture Reference: ADR-008 (Programmatic SEO & Structured Data), AGENTS.md (Rule 1, Rule 2 & Rule 4)
 */

import { describe, it, expect } from "vitest";
import {
  generateJobPostingSchema,
  generateEventSchema,
  generateBreadcrumbSchema,
  generateAllNotificationSchemas,
  generateJobPostingJsonLd,
  generateEventJsonLd,
  generateBreadcrumbJsonLd,
} from "@/lib/seo/json-ld";
import type { NotificationDetail } from "@/types/notifications";

describe("JSON-LD Schema Generators (lib/seo/json-ld.ts)", () => {
  const baseNotification: NotificationDetail = {
    id: "770e8400-e29b-41d4-a716-446655440001",
    slug: "upsc-civil-services-2026",
    title: "Civil Services Examination 2026",
    notificationNumber: "01/2026-CSP",
    totalVacancies: 1056,
    applicationStartDate: "2026-02-14T00:00:00.000Z",
    applicationEndDate: "2026-03-05T18:00:00.000Z",
    examDate: "2026-05-24T09:00:00.000Z",
    qualificationRequired: ["Graduate Degree from a recognized university", "Indian Citizen"],
    ageLimitMin: 21,
    ageLimitMax: 32,
    status: "published",
    publishedAt: "2026-02-14T10:00:00.000Z",
    officialPdfUrl: "https://upsc.gov.in/docs/csp-2026.pdf",
    applyOnlineUrl: "https://upsconline.nic.in",
    syllabusSummary: {
      prelims: "General Studies Paper I & CSAT Paper II",
      mains: "Essay, 4 General Studies Papers, 2 Optional Papers",
    },
    selectionProcess: ["Preliminary Examination", "Main Examination", "Personality Test (Interview)"],
    verifiedBy: "admin-user-id",
    createdAt: "2026-02-14T08:00:00.000Z",
    updatedAt: "2026-02-14T10:00:00.000Z",
    exam: {
      id: "550e8400-e29b-41d4-a716-446655440000",
      slug: "upsc-cse",
      title: "Civil Services Examination",
      conductingBody: "Union Public Service Commission",
      category: "civil_services",
      stateOrCentral: "Central",
      officialWebsite: "https://upsc.gov.in",
      logoUrl: "https://upaguru.in/images/logos/upsc.png",
    },
  };

  describe("generateJobPostingSchema / generateJobPostingJsonLd", () => {
    it("TC-JSONLD-JOB-01: should generate valid Google-compliant JobPosting schema with all required properties", () => {
      const jobPosting = generateJobPostingSchema(baseNotification);

      expect(jobPosting["@context"]).toBe("https://schema.org");
      expect(jobPosting["@type"]).toBe("JobPosting");
      expect(jobPosting.title).toBe(baseNotification.title);
      expect(jobPosting.employmentType).toBe("FULL_TIME");
      expect(jobPosting.datePosted).toBe(baseNotification.publishedAt);
      expect(jobPosting.validThrough).toBe(baseNotification.applicationEndDate);
      expect(jobPosting.url).toBe(`https://upaguru.in/notification/${baseNotification.slug}`);
      expect(jobPosting.totalJobOpenings).toBe(1056);
      expect(jobPosting.directApply).toBe(true);

      // Hiring Organization
      expect(jobPosting.hiringOrganization["@type"]).toBe("Organization");
      expect(jobPosting.hiringOrganization.name).toBe("Union Public Service Commission");
      expect(jobPosting.hiringOrganization.sameAs).toBe("https://upsc.gov.in");
      expect(jobPosting.hiringOrganization.logo).toBe("https://upaguru.in/images/logos/upsc.png");

      // Place / Location for Central Exam
      expect(jobPosting.jobLocation["@type"]).toBe("Place");
      expect(jobPosting.jobLocation.address["@type"]).toBe("PostalAddress");
      expect(jobPosting.jobLocation.address.addressCountry).toBe("IN");
      expect(jobPosting.jobLocation.address.addressRegion).toBe("India (All India Service)");

      // Education Requirements
      expect(jobPosting.educationRequirements?.["@type"]).toBe("EducationalOccupationalCredential");
      expect(jobPosting.educationRequirements?.credentialCategory).toContain("Graduate Degree");

      // Description contains key HTML sections
      expect(jobPosting.description).toContain("Total Vacancies:");
      expect(jobPosting.description).toContain("1,056");
      expect(jobPosting.description).toContain("Application Start Date:");
      expect(jobPosting.description).toContain("Application Closing Date:");
      expect(jobPosting.description).toContain("Stage 1: Preliminary Examination");
    });

    it("TC-JSONLD-JOB-02: should format state-specific addressRegion for state exam", () => {
      const stateNotification: NotificationDetail = {
        ...baseNotification,
        exam: {
          ...baseNotification.exam,
          stateOrCentral: "Karnataka",
          conductingBody: "Karnataka Public Service Commission",
        },
      };

      const jobPosting = generateJobPostingSchema(stateNotification);
      expect(jobPosting.jobLocation.address.addressRegion).toBe("Karnataka");
    });

    it("TC-JSONLD-JOB-03: should omit totalJobOpenings when vacancies count is zero", () => {
      const zeroVacanciesNotification: NotificationDetail = {
        ...baseNotification,
        totalVacancies: 0,
      };

      const jobPosting = generateJobPostingSchema(zeroVacanciesNotification);
      expect(jobPosting.totalJobOpenings).toBeUndefined();
    });

    it("TC-JSONLD-JOB-04: should omit educationRequirements when qualification array is empty", () => {
      const noQualsNotification: NotificationDetail = {
        ...baseNotification,
        qualificationRequired: [],
      };

      const jobPosting = generateJobPostingSchema(noQualsNotification);
      expect(jobPosting.educationRequirements).toBeUndefined();
    });

    it("TC-JSONLD-JOB-05: should set directApply to false when applyOnlineUrl is null or empty", () => {
      const noApplyUrlNotification: NotificationDetail = {
        ...baseNotification,
        applyOnlineUrl: null,
      };

      const jobPosting = generateJobPostingSchema(noApplyUrlNotification);
      expect(jobPosting.directApply).toBe(false);
    });

    it("TC-JSONLD-JOB-06: should fallback to default logo when exam.logoUrl is null", () => {
      const noLogoNotification: NotificationDetail = {
        ...baseNotification,
        exam: {
          ...baseNotification.exam,
          logoUrl: null,
        },
      };

      const jobPosting = generateJobPostingSchema(noLogoNotification);
      expect(jobPosting.hiringOrganization.logo).toContain("/images/conducting-bodies/default.png");
    });

    it("TC-JSONLD-JOB-07: should support generateJobPostingJsonLd alias identically", () => {
      const viaAlias = generateJobPostingJsonLd(baseNotification);
      const viaDirect = generateJobPostingSchema(baseNotification);
      expect(viaAlias).toEqual(viaDirect);
    });
  });

  describe("generateEventSchema / generateEventJsonLd", () => {
    it("TC-JSONLD-EVT-01: should generate valid Event schema when examDate is present", () => {
      const event = generateEventSchema(baseNotification);

      expect(event).not.toBeNull();
      if (event) {
        expect(event["@context"]).toBe("https://schema.org");
        expect(event["@type"]).toBe("Event");
        expect(event.name).toBe("Civil Services Examination Examination");
        expect(event.startDate).toBe("2026-05-24T09:00:00.000Z");
        expect(event.endDate).toBe("2026-05-24T09:00:00.000Z");
        expect(event.eventStatus).toBe("https://schema.org/EventScheduled");
        expect(event.eventAttendanceMode).toBe("https://schema.org/OfflineEventAttendanceMode");
        expect(event.location["@type"]).toBe("Place");
        expect(event.location.address.addressCountry).toBe("IN");
        expect(event.location.name).toContain("Designated Examination Centres Across India");
        expect(event.organizer["@type"]).toBe("Organization");
        expect(event.organizer.name).toBe("Union Public Service Commission");
      }
    });

    it("TC-JSONLD-EVT-02: should format state exam centre location appropriately", () => {
      const stateNotification: NotificationDetail = {
        ...baseNotification,
        exam: {
          ...baseNotification.exam,
          stateOrCentral: "Maharashtra",
        },
      };

      const event = generateEventSchema(stateNotification);
      expect(event).not.toBeNull();
      if (event) {
        expect(event.location.name).toBe("Designated Examination Centres in Maharashtra");
        expect(event.location.address.addressRegion).toBe("Maharashtra");
      }
    });

    it("TC-JSONLD-EVT-03: should return null when examDate is null, undefined, or empty", () => {
      const nullExamDateNotif: NotificationDetail = {
        ...baseNotification,
        examDate: null,
      };

      expect(generateEventSchema(nullExamDateNotif)).toBeNull();
    });

    it("TC-JSONLD-EVT-04: should support generateEventJsonLd alias identically", () => {
      const viaAlias = generateEventJsonLd(baseNotification);
      const viaDirect = generateEventSchema(baseNotification);
      expect(viaAlias).toEqual(viaDirect);
    });
  });

  describe("generateBreadcrumbSchema / generateBreadcrumbJsonLd", () => {
    it("TC-JSONLD-BRD-01: should generate valid 3-level BreadcrumbList schema", () => {
      const breadcrumb = generateBreadcrumbSchema(baseNotification);

      expect(breadcrumb["@context"]).toBe("https://schema.org");
      expect(breadcrumb["@type"]).toBe("BreadcrumbList");
      expect(breadcrumb.itemListElement).toHaveLength(3);

      // Home item
      expect(breadcrumb.itemListElement[0]).toEqual({
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://upaguru.in",
      });

      // Category item
      expect(breadcrumb.itemListElement[1]).toEqual({
        "@type": "ListItem",
        position: 2,
        name: "CIVIL SERVICES",
        item: "https://upaguru.in/?category=civil_services",
      });

      // Detail item
      expect(breadcrumb.itemListElement[2]).toEqual({
        "@type": "ListItem",
        position: 3,
        name: baseNotification.title,
        item: `https://upaguru.in/notification/${baseNotification.slug}`,
      });
    });

    it("TC-JSONLD-BRD-02: should support generateBreadcrumbJsonLd alias identically", () => {
      const viaAlias = generateBreadcrumbJsonLd(baseNotification);
      const viaDirect = generateBreadcrumbSchema(baseNotification);
      expect(viaAlias).toEqual(viaDirect);
    });
  });

  describe("generateAllNotificationSchemas", () => {
    it("TC-JSONLD-ALL-01: should include JobPosting, BreadcrumbList, and Event when examDate is present", () => {
      const allSchemas = generateAllNotificationSchemas(baseNotification);
      expect(allSchemas).toHaveLength(3);

      const types = allSchemas.map((s) => s["@type"]);
      expect(types).toContain("JobPosting");
      expect(types).toContain("BreadcrumbList");
      expect(types).toContain("Event");
    });

    it("TC-JSONLD-ALL-02: should exclude Event schema when examDate is null", () => {
      const noExamDateNotif: NotificationDetail = {
        ...baseNotification,
        examDate: null,
      };

      const allSchemas = generateAllNotificationSchemas(noExamDateNotif);
      expect(allSchemas).toHaveLength(2);

      const types = allSchemas.map((s) => s["@type"]);
      expect(types).toContain("JobPosting");
      expect(types).toContain("BreadcrumbList");
      expect(types).not.toContain("Event");
    });
  });
});
