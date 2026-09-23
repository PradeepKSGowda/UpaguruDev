/**
 * @file app/dashboard/page.tsx
 * @description Candidate Personal Workspace Overview.
 * Displays profile readiness score, upcoming exam application deadlines,
 * ongoing application status, saved circulars, and quick notes.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 */

import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  getCandidateProfileData,
  getCandidateBookmarks,
  getCandidateNotes,
  getCandidateTracking,
} from "./actions";
import {
  ProfileCompletionBar,
  BookmarksList,
  ApplicationTrackerList,
} from "@/components/dashboard";
import {
  Bookmark,
  FileText,
  Milestone,
  Calendar,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Clock,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard Overview | UPA-GURU",
  description: "Candidate workspace overview tracking profile completion, bookmarks, and deadlines.",
};

export default async function CandidateDashboardPage() {
  const [profileRes, bookmarksRes, notesRes, trackingRes] = await Promise.all([
    getCandidateProfileData(),
    getCandidateBookmarks(),
    getCandidateNotes(),
    getCandidateTracking(),
  ]);

  const profileData = profileRes.data;
  const bookmarks = bookmarksRes.data || [];
  const notes = notesRes.data || [];
  const tracking = trackingRes.data || [];

  const completionPercentage = profileData?.completionPercentage || 25;
  const displayName = profileData?.fullName || profileData?.email?.split("@")[0] || "Candidate";

  return (
    <div className="space-y-6">
      {/* Welcome & Quick Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-linear-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
              Welcome back
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Hello, {displayName}!
          </h2>
          <p className="text-xs text-blue-200 mt-1 max-w-xl leading-relaxed">
            Stay on top of critical registration closing dates, exam admit cards, and recruitment notices across India.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/notification"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <Sparkles className="w-3.5 h-3.5" /> Explore Notifications
          </Link>
        </div>
      </div>

      {/* Profile Completion Gauge */}
      <ProfileCompletionBar
        percentage={completionPercentage}
        profile={profileData?.profile || null}
      />

      {/* KPI Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/dashboard/bookmarks"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-blue-400 dark:hover:border-blue-600 transition group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Bookmark className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">{bookmarks.length}</h3>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Saved Circulars</p>
        </Link>

        <Link
          href="/dashboard/tracking"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-emerald-400 dark:hover:border-emerald-600 transition group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Milestone className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Tracker <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">{tracking.length}</h3>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Active Applications</p>
        </Link>

        <Link
          href="/dashboard/notes"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-600 transition group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Notes <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">{notes.length}</h3>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Personal Notes</p>
        </Link>
      </div>

      {/* Two Column Layout: Recent Applications & Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Ongoing Application Milestones */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Milestone className="w-5 h-5 text-emerald-600" /> Application Milestones
            </h3>
            <Link
              href="/dashboard/tracking"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Manage all
            </Link>
          </div>

          {tracking.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <p className="text-xs">No exams currently tracked.</p>
              <Link
                href="/notification"
                className="text-xs text-blue-600 font-semibold hover:underline mt-1 inline-block"
              >
                Track an exam application
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {tracking.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                      {item.notification?.title || "Exam"}
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      Reg: {item.application_number || "Pending"} • Fee: {item.fee_paid ? "Paid" : "Unpaid"}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      item.result_status === "qualified"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
                    }`}
                  >
                    {item.result_status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Quick Personal Notes */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" /> Quick Revision Notes
            </h3>
            <Link
              href="/dashboard/notes"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              All notes
            </Link>
          </div>

          {notes.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <p className="text-xs">No notes captured yet.</p>
              <Link
                href="/dashboard/notes"
                className="text-xs text-blue-600 font-semibold hover:underline mt-1 inline-block"
              >
                Create your first note
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.slice(0, 3).map((note) => (
                <div
                  key={note.id}
                  className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40"
                >
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 mb-1">
                    {note.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
