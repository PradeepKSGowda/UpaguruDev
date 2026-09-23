/**
 * @file app/dashboard/profile/page.tsx
 * @description Candidate Profile & KYC Settings Page.
 * Renders demographic, contact, reservation category, and mobile OTP verification settings.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 */

import React from "react";
import type { Metadata } from "next";
import { getCandidateProfileData } from "../actions";
import { CandidateProfileForm } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Candidate Profile & KYC | UPA-GURU",
  description: "Update personal details, contact information, mobile OTP verification, and reservation categories.",
};

export default async function CandidateProfilePage() {
  const profileRes = await getCandidateProfileData();
  const profileData = profileRes.data;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Candidate Profile & Eligibility KYC
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Keep your demographic profile accurate to ensure proper eligibility matching against age relaxations and domicile quotas.
        </p>
      </div>

      <CandidateProfileForm
        initialEmail={profileData?.email || ""}
        initialFullName={profileData?.fullName || ""}
        initialProfile={profileData?.profile || null}
      />
    </div>
  );
}
