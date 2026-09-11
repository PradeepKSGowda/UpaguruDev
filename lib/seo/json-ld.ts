/**
 * @file lib/seo/json-ld.ts
 * @module StructuredData
 * @description Generates Schema.org compliant JSON-LD structured data objects for
 * government exam notifications, specifically JobPosting, Event, and BreadcrumbList schemas.
 * 
 * Task ID: TASK-02030103 (Subtask: SUB-0203010302)
 * Architecture Reference: ADR-008 (Programmatic SEO & Structured Data), AGENTS.md (Rule 4)
 * 
 * Complies with:
 * - Google Search Central JobPosting Rich Results specifications
 * - Schema.org Event specification for scheduled government competitive exams
 * - TypeScript strict mode (zero `any`)
 * - ISO-8601 date formatting
 */

import type { NotificationDetail } from "@/types/notifications";
import { formatVacancies, formatDisplayDate } from "@/lib/utils";

/**
 * Schema.org Organization definition
 */
export interface SchemaOrganization {
  "@type": "Organization";
  name: string;
  sameAs?: string;
  logo?: string;
}

/**
 * Schema.org PostalAddress definition
 */
export interface SchemaPostalAddress {
  "@type": "PostalAddress";
  addressCountry: string;
  addressRegion?: string;
  addressLocality?: string;
}

/**
 * Schema.org Place definition
 */
export interface SchemaPlace {
  "@type": "Place";
  name?: string;
  address: SchemaPostalAddress;
}

/**
 * Schema.org JobPosting structured data object
 */
export interface SchemaJobPosting {
  "@context": "https://schema.org";
  "@type": "JobPosting";
  title: string;
  description: string;
  datePosted: string;
  validThrough: string;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACTOR" | "OTHER";
  hiringOrganization: SchemaOrganization;
  jobLocation: SchemaPlace;
  totalJobOpenings?: number;
  educationRequirements?: {
    "@type": "EducationalOccupationalCredential";
    credentialCategory: string;
  };
  directApply?: boolean;
  url: string;
}

/**
 * Schema.org Event structured data object
 */
export interface SchemaEvent {
  "@context": "https://schema.org";
  "@type": "Event";
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  eventStatus: string;
  eventAttendanceMode: string;
  location: SchemaPlace;
  organizer: SchemaOrganization;
}

/**
 * Schema.org BreadcrumbList item element
 */
export interface SchemaBreadcrumbItem {
  "@type": "ListItem";
  position: number;
  name: string;
  item: string;
}

/**
 * Schema.org BreadcrumbList structured data object
 */
export interface SchemaBreadcrumbList {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  itemListElement: SchemaBreadcrumbItem[];
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://upaguru.in";

/**
 * Safely converts date string to ISO-8601 string
 */
function toIsoDateString(dateStr: string | null | undefined, fallback: string): string {
  if (!dateStr) return fallback;
  try {
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return fallback;
    return parsed.toISOString();
  } catch {
    return fallback;
  }
}

/**
 * Generates clean HTML description string for JobPosting rich snippets
 */
function buildJobPostingDescription(notification: NotificationDetail): string {
  const { exam } = notification;
  const qualifications = notification.qualificationRequired.length > 0 
    ? notification.qualificationRequired.join(", ") 
    : "Refer to official notification";
  
  const selectionSteps = notification.selectionProcess.length > 0
    ? notification.selectionProcess.map((step, idx) => `<li>Stage ${idx + 1}: ${step}</li>`).join("")
    : "<li>As per official recruitment notification rules</li>";

  const ageLimits = notification.ageLimitMin || notification.ageLimitMax
    ? `${notification.ageLimitMin ? `${notification.ageLimitMin} years` : "No min age"} to ${notification.ageLimitMax ? `${notification.ageLimitMax} years` : "No max age"}`
    : "Refer to official notification for age criteria and relaxation rules";

  return `
    <p>Official notification for recruitment to <strong>${notification.title}</strong> conducted by <strong>${exam.conductingBody}</strong>.</p>
    <h3>Key Highlights & Vacancies</h3>
    <ul>
      <li><strong>Total Vacancies:</strong> ${formatVacancies(notification.totalVacancies)}</li>
      <li><strong>Application Start Date:</strong> ${formatDisplayDate(notification.applicationStartDate)}</li>
      <li><strong>Application Closing Date:</strong> ${formatDisplayDate(notification.applicationEndDate)}</li>
      <li><strong>Age Limit:</strong> ${ageLimits}</li>
    </ul>
    <h3>Educational Qualifications</h3>
    <p>${qualifications}</p>
    <h3>Selection Process</h3>
    <ol>${selectionSteps}</ol>
    <p>Apply online, download the official PDF notification, and view complete syllabus details on UPA-GURU.</p>
  `.trim().replace(/\s+/g, " ");
}

/**
 * Generates Schema.org JobPosting JSON-LD object for a notification
 */
export function generateJobPostingSchema(notification: NotificationDetail): SchemaJobPosting {
  const { exam } = notification;
  const nowIso = new Date().toISOString();
  const datePosted = toIsoDateString(notification.publishedAt || notification.applicationStartDate, nowIso);
  const validThrough = toIsoDateString(notification.applicationEndDate, nowIso);
  const canonicalUrl = `${BASE_URL}/notification/${notification.slug}`;

  const isCentral = exam.stateOrCentral?.toLowerCase() === "central";

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: notification.title,
    description: buildJobPostingDescription(notification),
    datePosted,
    validThrough,
    employmentType: "FULL_TIME",
    hiringOrganization: {
      "@type": "Organization",
      name: exam.conductingBody,
      sameAs: exam.officialWebsite || undefined,
      logo: exam.logoUrl || `${BASE_URL}/images/conducting-bodies/default.png`
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressCountry: "IN",
        addressRegion: isCentral ? "India (All India Service)" : exam.stateOrCentral
      }
    },
    totalJobOpenings: notification.totalVacancies > 0 ? notification.totalVacancies : undefined,
    educationRequirements: notification.qualificationRequired.length > 0 ? {
      "@type": "EducationalOccupationalCredential",
      credentialCategory: notification.qualificationRequired.join(", ")
    } : undefined,
    directApply: !!notification.applyOnlineUrl,
    url: canonicalUrl
  };
}

/**
 * Generates Schema.org Event JSON-LD object if an examination date is scheduled
 */
export function generateEventSchema(notification: NotificationDetail): SchemaEvent | null {
  if (!notification.examDate) {
    return null;
  }

  const { exam } = notification;
  const isCentral = exam.stateOrCentral?.toLowerCase() === "central";
  const examStartIso = toIsoDateString(notification.examDate, "");
  if (!examStartIso) return null;

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: `${exam.title} Examination`,
    description: `Official competitive examination for ${notification.title} conducted by ${exam.conductingBody}.`,
    startDate: examStartIso,
    endDate: examStartIso,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: isCentral ? "Designated Examination Centres Across India" : `Designated Examination Centres in ${exam.stateOrCentral}`,
      address: {
        "@type": "PostalAddress",
        addressCountry: "IN",
        addressRegion: isCentral ? "India" : exam.stateOrCentral
      }
    },
    organizer: {
      "@type": "Organization",
      name: exam.conductingBody,
      sameAs: exam.officialWebsite || undefined
    }
  };
}

/**
 * Generates Schema.org BreadcrumbList JSON-LD object
 */
export function generateBreadcrumbSchema(notification: NotificationDetail): SchemaBreadcrumbList {
  const { exam } = notification;
  const canonicalUrl = `${BASE_URL}/notification/${notification.slug}`;

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: BASE_URL
      },
      {
        "@type": "ListItem",
        position: 2,
        name: exam.category ? exam.category.replace(/_/g, " ").toUpperCase() : "Notifications",
        item: `${BASE_URL}/?category=${exam.category}`
      },
      {
        "@type": "ListItem",
        position: 3,
        name: notification.title,
        item: canonicalUrl
      }
    ]
  };
}

/**
 * Collects all applicable JSON-LD schemas for a notification detail page
 */
export function generateAllNotificationSchemas(notification: NotificationDetail): Array<Record<string, unknown>> {
  const schemas: Array<Record<string, unknown>> = [
    generateJobPostingSchema(notification) as unknown as Record<string, unknown>,
    generateBreadcrumbSchema(notification) as unknown as Record<string, unknown>
  ];

  const eventSchema = generateEventSchema(notification);
  if (eventSchema) {
    schemas.push(eventSchema as unknown as Record<string, unknown>);
  }

  return schemas;
}
