/**
 * @file tests/unit/data/scrapers.test.ts
 * @description Unit tests for Scraper Registry, dynamic discovery config fallback,
 * application ongoing date checking logic, and server action input validation.
 * 
 * Task ID: TASK-03010103
 * Complies with: AGENTS.md (Rule 2: Test Code Generation)
 */

import { describe, it, expect } from "vitest";
import {
  KNOWN_PORTALS,
  getKnownPortalConfig,
  isDateOngoing,
  portalTriggerSchema,
  type PortalConfig,
} from "@/lib/scrapers/registry";

describe("Scraper Registry & Portal Configuration", () => {
  it("should have all primary government examination portals registered", () => {
    expect(KNOWN_PORTALS.length).toBeGreaterThanOrEqual(5);
    const codes = KNOWN_PORTALS.map((p: PortalConfig) => p.code);
    expect(codes).toContain("KPSC");
    expect(codes).toContain("UPSC");
    expect(codes).toContain("RRB");
    expect(codes).toContain("SSC");
    expect(codes).toContain("IBPS");
  });

  it("should look up known portals case-insensitively", () => {
    const kpsc = getKnownPortalConfig("kpsc");
    expect(kpsc.code).toBe("KPSC");
    expect(kpsc.name).toBe("Karnataka Public Service Commission");
    expect(kpsc.officialWebsite).toContain("kpsc.kar.nic.in");

    const upsc = getKnownPortalConfig("UpSc");
    expect(upsc.code).toBe("UPSC");
    expect(upsc.name).toBe("Union Public Service Commission");

    const ibps = getKnownPortalConfig("IBPS");
    expect(ibps.code).toBe("IBPS");
    expect(ibps.name).toBe("Institute of Banking Personnel Selection");
  });

  it("should provide dynamic fallback configuration for newly discovered portals", () => {
    const customPortal = getKnownPortalConfig("MPSC");
    expect(customPortal.code).toBe("MPSC");
    expect(customPortal.name).toBe("MPSC Examination Board");
    expect(customPortal.stateOrCentral).toBe("State");

    const anotherPortal = getKnownPortalConfig("BPSC_PATNA");
    expect(anotherPortal.code).toBe("BPSC_PATNA");
    expect(anotherPortal.officialWebsite).toContain("bpsc_patna.gov.in");
  });
});

describe("Date Ongoing / Expired Evaluation", () => {
  it("should mark future dates as ongoing", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 15);
    expect(isDateOngoing(futureDate.toISOString())).toBe(true);
    expect(isDateOngoing(futureDate.toISOString().split("T")[0])).toBe(true);
  });

  it("should mark past dates as not ongoing (expired)", () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);
    expect(isDateOngoing(pastDate.toISOString())).toBe(false);
    expect(isDateOngoing("2020-01-01")).toBe(false);
  });

  it("should safely handle null, undefined, or invalid date strings", () => {
    expect(isDateOngoing(null)).toBe(false);
    expect(isDateOngoing(undefined)).toBe(false);
    expect(isDateOngoing("not-a-valid-date")).toBe(false);
  });
});

describe("Manual Extraction Server Action Zod Validation", () => {
  it("should validate and normalize valid portal codes", () => {
    const valid = portalTriggerSchema.safeParse({ portalCode: "  kpsc  " });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.portalCode).toBe("KPSC");
    }
  });

  it("should reject invalid or excessively long portal codes", () => {
    const empty = portalTriggerSchema.safeParse({ portalCode: "" });
    expect(empty.success).toBe(false);

    const tooLong = portalTriggerSchema.safeParse({ portalCode: "A".repeat(50) });
    expect(tooLong.success).toBe(false);
  });
});
