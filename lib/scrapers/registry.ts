/**
 * @file lib/scrapers/registry.ts
 * @description Centralized, extensible registry for recruitment portal crawlers and scrapers.
 * Supports static registry definitions (KPSC, UPSC, SSC, RRB, IBPS) and dynamic discovery
 * when new portal crawlers or database entries are detected.
 * 
 * Architecture Reference: ADR-001 (Frontend RSC), ADR-002 (Database), ADR-011 (Observability)
 */

import { z } from "zod";

export interface PortalConfig {
  code: string;
  name: string;
  category: "state" | "central" | "banking" | "railways" | "defence" | "other";
  officialWebsite: string;
  stateOrCentral: "State" | "Central";
  logoUrl?: string;
  description: string;
}

export interface ManualExtractResult {
  success: boolean;
  portal: string;
  message: string;
  runId?: string;
  timestamp: string;
}

export const portalTriggerSchema = z.object({
  portalCode: z
    .string()
    .trim()
    .min(1, "Portal code cannot be empty")
    .max(30, "Portal code exceeds maximum length")
    .transform((val) => val.toUpperCase()),
});

/**
 * Built-in registry of supported government recruitment portals.
 * Adding a new portal here (e.g., IBPS, BPSC, MPSC) automatically surfaces it in the dashboard.
 */
export const PORTAL_REGISTRY: Record<string, PortalConfig> = {
  KPSC: {
    code: "KPSC",
    name: "Karnataka Public Service Commission",
    category: "state",
    officialWebsite: "https://kpsc.kar.nic.in",
    stateOrCentral: "State",
    description: "State civil services, gazetted probationers, and departmental exams for Karnataka.",
  },
  UPSC: {
    code: "UPSC",
    name: "Union Public Service Commission",
    category: "central",
    officialWebsite: "https://upsc.gov.in",
    stateOrCentral: "Central",
    description: "Central civil services (IAS, IPS, IFS), Engineering Services, NDA, and CDS exams.",
  },
  SSC: {
    code: "SSC",
    name: "Staff Selection Commission",
    category: "central",
    officialWebsite: "https://ssc.gov.in",
    stateOrCentral: "Central",
    description: "Combined Graduate Level (CGL), CHSL, MTS, and Central Police Organization recruitment.",
  },
  RRB: {
    code: "RRB",
    name: "Railway Recruitment Boards",
    category: "railways",
    officialWebsite: "https://rrbcdg.gov.in",
    stateOrCentral: "Central",
    description: "Indian Railways non-technical popular categories (NTPC), Group D, and ALP vacancies.",
  },
  IBPS: {
    code: "IBPS",
    name: "Institute of Banking Personnel Selection",
    category: "banking",
    officialWebsite: "https://www.ibps.in",
    stateOrCentral: "Central",
    description: "Public sector bank probationary officers, clerks, and specialist officer recruitments.",
  },
};

/**
 * Normalizes portal code to uppercase
 */
export function normalizePortalCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Retrieves portal metadata with a graceful fallback for dynamically discovered portals
 */
export function getPortalConfig(code: string): PortalConfig {
  const normalized = normalizePortalCode(code);
  if (PORTAL_REGISTRY[normalized]) {
    return PORTAL_REGISTRY[normalized];
  }

  // Fallback for dynamically discovered portals not yet in the static registry
  return {
    code: normalized,
    name: `${normalized} Examination Board`,
    category: "other",
    officialWebsite: `https://${normalized.toLowerCase()}.gov.in`,
    stateOrCentral: "State",
    description: `Government exam notifications extracted from ${normalized} portal.`,
  };
}

/**
 * Array of all statically known government recruitment portals.
 */
export const KNOWN_PORTALS: PortalConfig[] = Object.values(PORTAL_REGISTRY);

/**
 * Lookup helper alias for getPortalConfig.
 */
export function getKnownPortalConfig(code: string): PortalConfig {
  return getPortalConfig(code);
}

/**
 * Helper to determine whether an application end date is in the future.
 */
export function isDateOngoing(dateString?: string | null): boolean {
  if (!dateString) return false;
  const parsed = new Date(dateString);
  if (isNaN(parsed.getTime())) return false;
  return parsed.getTime() >= Date.now();
}
