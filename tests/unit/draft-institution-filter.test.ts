/**
 * @file tests/unit/draft-institution-filter.test.ts
 * @description Unit tests for institution filtering in the Draft Review Queue.
 */

import { describe, it, expect } from "vitest";
import { draftFilterSchema } from "@/lib/schemas/drafts";

describe("Draft Review Queue Institution Filter", () => {
  it("should default institution to 'all' when not provided", () => {
    const parsed = draftFilterSchema.parse({});
    expect(parsed.institution).toBe("all");
  });

  it("should accept valid institution names such as UPSC, KPSC, SSC, RRB, IBPS", () => {
    const upsc = draftFilterSchema.parse({ institution: "UPSC" });
    expect(upsc.institution).toBe("UPSC");

    const kpsc = draftFilterSchema.parse({ institution: "KPSC" });
    expect(kpsc.institution).toBe("KPSC");

    const ssc = draftFilterSchema.parse({ institution: "SSC" });
    expect(ssc.institution).toBe("SSC");

    const rrb = draftFilterSchema.parse({ institution: "RRB" });
    expect(rrb.institution).toBe("RRB");

    const ibps = draftFilterSchema.parse({ institution: "IBPS" });
    expect(ibps.institution).toBe("IBPS");
  });

  it("should trim whitespace around institution values", () => {
    const trimmed = draftFilterSchema.parse({ institution: "  KPSC  " });
    expect(trimmed.institution).toBe("KPSC");
  });
});
