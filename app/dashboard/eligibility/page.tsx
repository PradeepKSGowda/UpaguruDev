/**
 * @file app/dashboard/eligibility/page.tsx
 * @description Candidate Smart Eligibility Matching Page.
 * Server component that computes real-time candidate eligibility against active government exams,
 * renders match score breakdown, and provides qualification preference customization.
 *
 * Enhancement: ENH-0009 (Smart Eligibility Matching Engine)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-003 (RBAC)
 */

import React from "react";
import type { Metadata } from "next";
import { getEligibilityMatches, getEligibilityPreferences } from "./actions";
import { EligibilityMatchesList } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Eligible Government Exams | UPA-GURU",
  description:
    "Discover government exam notifications tailored to your age, reservation category relaxation, state domicile, and qualifications.",
};

export default async function CandidateEligibilityPage() {
  const [matchesRes, prefsRes] = await Promise.all([
    getEligibilityMatches(),
    getEligibilityPreferences(),
  ]);

  const matches = matchesRes.data || [];
  const totalEligible = matchesRes.totalEligible || 0;
  const completeness = matchesRes.profileCompleteness || 0;
  const preferences = prefsRes.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Smart Eligibility Matching
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Real-time evaluation based on your date of birth, reservation category (age relaxation), domicile state, and academic qualifications.
        </p>
      </div>

      <EligibilityMatchesList
        initialResults={matches}
        initialPreferences={preferences}
        profileCompleteness={completeness}
        totalEligible={totalEligible}
      />
    </div>
  );
}
