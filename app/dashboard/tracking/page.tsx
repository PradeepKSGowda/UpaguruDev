/**
 * @file app/dashboard/tracking/page.tsx
 * @description Candidate Exam Application & Milestone Tracker Page.
 * Visualizes stages from Application Submitted -> Fee Paid -> Admit Card -> Exam Attended -> Final Result.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 */

import React from "react";
import type { Metadata } from "next";
import { getCandidateTracking } from "../actions";
import { ApplicationTrackerList } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Application & Milestone Tracker | UPA-GURU",
  description: "Track your government exam applications, roll numbers, fees, exam centers, and recruitment results.",
};

export default async function CandidateTrackingPage() {
  const trackingRes = await getCandidateTracking();
  const tracking = trackingRes.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Exam Application & Milestone Tracker
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Keep track of application numbers, fee payment receipts, admit cards, and selection results for all applied examinations.
        </p>
      </div>

      <ApplicationTrackerList initialTracking={tracking} />
    </div>
  );
}
