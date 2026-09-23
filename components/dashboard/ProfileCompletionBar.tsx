"use client";

/**
 * @file components/dashboard/ProfileCompletionBar.tsx
 * @description Visual gauge and checklist for candidate profile completion status.
 * Encourages candidates to complete demographic, contact, and category preferences
 * for accurate exam eligibility matching.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 */

import React from "react";
import Link from "next/link";
import { CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";

interface ProfileCompletionProps {
  percentage: number;
  profile: {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    is_phone_verified?: boolean | null;
    date_of_birth?: string | null;
    category?: string | null;
    state?: string | null;
    district?: string | null;
  } | null;
}

export default function ProfileCompletionBar({ percentage, profile }: ProfileCompletionProps) {
  const missingItems = [];

  if (!profile?.first_name || !profile?.last_name) {
    missingItems.push({ label: "Full legal name", weight: 15, href: "/dashboard/profile" });
  }
  if (!profile?.phone || !profile?.is_phone_verified) {
    missingItems.push({ label: "Verified mobile number (for SMS/WhatsApp alerts)", weight: 20, href: "/dashboard/profile" });
  }
  if (!profile?.date_of_birth || !profile?.category) {
    missingItems.push({ label: "DOB & Reservation Category (for age eligibility checks)", weight: 20, href: "/dashboard/profile" });
  }
  if (!profile?.state || !profile?.district) {
    missingItems.push({ label: "Domicile State & District", weight: 15, href: "/dashboard/profile" });
  }

  const isComplete = percentage >= 95;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Profile Readiness Score</h3>
            {isComplete ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5" /> High Readiness
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                <AlertCircle className="w-3.5 h-3.5" /> Needs Completion
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Complete your profile to unlock auto-eligibility evaluation and instant application alerts.
          </p>
        </div>

        <div className="text-right shrink-0">
          <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{percentage}%</span>
          <span className="text-xs text-slate-400 block">completed</span>
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mb-4">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            percentage >= 90
              ? "bg-emerald-500"
              : percentage >= 50
              ? "bg-linear-to-r from-blue-500 to-indigo-600"
              : "bg-amber-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Checklist items if not complete */}
      {missingItems.length > 0 && (
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
            Recommended next steps:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {missingItems.slice(0, 2).map((item, idx) => (
              <Link
                key={idx}
                href={item.href}
                className="flex items-center justify-between p-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-950/30 text-xs text-slate-700 dark:text-slate-300 transition group"
              >
                <span className="truncate pr-2">{item.label}</span>
                <span className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 shrink-0 text-[11px]">
                  +{item.weight}% <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
