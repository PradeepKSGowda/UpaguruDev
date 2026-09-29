/**
 * @file app/admin/review-queue/page.tsx
 * @description Next.js 15 React Server Component (RSC) for Admin Review Queue.
 * Human-in-the-Loop triage dashboard for:
 * - Low-confidence document-to-cycle links (<85%)
 * - Corrigenda & Vacancy deltas
 * - Invariant violations / Data quality flags
 * 
 * Architecture Reference: Master Prompt Section 10.1, ADR-001, ADR-003 (RBAC)
 */

import React from "react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getReviewQueueItemsAction } from "./actions";
import { ReviewQueueClient } from "./review-queue-client";
import { ShieldAlert, CheckCircle2, Clock, AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Review Queue | UPA-GURU Admin",
  description: "Human-in-the-Loop review and verification queue for recruitment document intelligence.",
};

export default async function AdminReviewQueuePage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/admin/review-queue");
  }

  const role = user.app_metadata?.role;
  if (role !== "admin" && role !== "super_admin") {
    redirect("/dashboard");
  }

  const res = await getReviewQueueItemsAction({ status: "PENDING", limit: 50 });
  const items = res.success && res.data ? (res.data as any[]) : [];

  // Summary counts
  const highPriorityCount = items.filter((it) => it.priority === "HIGH").length;
  const mediumPriorityCount = items.filter((it) => it.priority === "MEDIUM").length;
  const dataQualityCount = items.filter((it) => it.item_type === "DATA_QUALITY_FLAG").length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Title & KPI row */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <ShieldAlert className="w-7 h-7 text-indigo-600" />
              <span>Document Intelligence Review Queue</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Human-in-the-Loop quality verification gate. Unresolved documents, candidate ambiguous
              matches, and data invariant alerts are routed here for official verification.
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Pending Review</div>
              <div className="text-xl font-bold text-slate-900">{items.length}</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">High Priority</div>
              <div className="text-xl font-bold text-rose-600">{highPriorityCount}</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Medium Priority</div>
              <div className="text-xl font-bold text-amber-600">{mediumPriorityCount}</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Data Quality Flags</div>
              <div className="text-xl font-bold text-slate-900">{dataQualityCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Review Queue Client Component */}
      <ReviewQueueClient initialItems={items} />
    </div>
  );
}
