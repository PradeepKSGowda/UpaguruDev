/**
 * @file app/dashboard/layout.tsx
 * @description Candidate Personal Workspace layout shell.
 * Enforces session authentication and provides persistent candidate secondary navigation.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 * Architecture Reference: ADR-001 (App Router), ADR-003 (RBAC)
 */

import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/dashboard";
import { UserCheck, Shield, ChevronRight } from "lucide-react";

export const metadata: Metadata = {
  title: {
    template: "%s | Candidate Workspace - UPA-GURU",
    default: "Candidate Workspace | UPA-GURU",
  },
  description: "Manage your government exam profile, bookmarks, preparation notes, and application tracking.",
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If unauthenticated and not in local dev mode, redirect to login
  if (!user && process.env.NODE_ENV !== "development") {
    redirect("/auth/login?returnTo=/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 pb-20">
      {/* Top Header / Breadcrumb banner */}
      <div className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Link href="/" className="hover:text-blue-400 transition-colors">
                  Home
                </Link>
                <ChevronRight className="w-3 h-3 text-slate-500" />
                <span className="text-white font-medium">Candidate Workspace</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Candidate Personal Workspace
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Unified workspace for application milestones, saved circulars, and eligibility matching.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                <span>Candidate Portal</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Workspace Secondary Tab Navigation */}
      <DashboardNav />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {children}
      </main>
    </div>
  );
}
