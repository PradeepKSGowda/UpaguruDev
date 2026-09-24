"use client";

/**
 * @file components/dashboard/ExamLifecycleTimeline.tsx
 * @description Visual timeline component rendering exam lifecycle stages:
 * Application -> Admit Card -> Exam Day -> Answer Key & Objections -> Result.
 *
 * Enhancement: ENH-0012 (Exam Lifecycle Automated Status Tracker)
 * Architecture Reference: ADR-001 (App Router RSC)
 */

import React from "react";
import Link from "next/link";
import {
  FileText,
  CreditCard,
  Calendar,
  Key,
  Award,
  CheckCircle2,
  Clock,
  Circle,
  ExternalLink,
  AlertTriangle,
  Download,
  AlertCircle,
} from "lucide-react";
import type { ExamLifecycleTimelineSummary, LifecyclePhaseDetail } from "@/lib/lifecycle/lifecycle-service";

interface Props {
  timeline: ExamLifecycleTimelineSummary;
  examTitle: string;
}

const PHASE_ICONS: Record<LifecyclePhaseDetail["id"], React.ComponentType<{ className?: string }>> = {
  notification: FileText,
  admit_card: CreditCard,
  exam_day: Calendar,
  answer_key: Key,
  result: Award,
};

export default function ExamLifecycleTimeline({ timeline, examTitle }: Props) {
  const { currentActivePhase, overallStatusLabel, phases, urgentAlert, events } = timeline;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
      {/* Header and Current Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Recruitment Lifecycle Status
          </span>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
            {overallStatusLabel}
          </h3>
        </div>

        {urgentAlert && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-semibold animate-pulse">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{urgentAlert.message}</span>
            {urgentAlert.url && (
              <a
                href={urgentAlert.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-amber-950 dark:hover:text-white ml-1 inline-flex items-center gap-0.5"
              >
                Go <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Visual Stepper Progression */}
      <div className="relative">
        {/* Connecting track line */}
        <div className="hidden md:block absolute top-1/2 left-8 right-8 h-1 bg-slate-100 dark:bg-slate-800 -translate-y-1/2 z-0" />

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative z-10">
          {phases.map((phase, idx) => {
            const Icon = PHASE_ICONS[phase.id];
            const isCompleted = phase.status === "completed";
            const isActive = phase.status === "active";

            return (
              <div
                key={phase.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  isActive
                    ? "bg-primary-50/60 dark:bg-primary-950/40 border-primary-500/80 shadow-sm ring-2 ring-primary-500/20"
                    : isCompleted
                    ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60"
                    : "bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-70"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isActive
                          ? "bg-primary-600 text-white shadow-md shadow-primary-500/20"
                          : isCompleted
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : isActive ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-primary-600 animate-ping" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                    )}
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {phase.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                    {phase.subtitle}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 font-medium">{phase.dateDisplay}</span>
                  {phase.officialUrl && (
                    <a
                      href={phase.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 dark:text-primary-400 font-semibold hover:underline inline-flex items-center gap-0.5"
                    >
                      Link <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Banner for Active Phase with Direct Link */}
      {phases.map((phase) => {
        if (phase.status !== "active" || !phase.officialUrl) return null;

        return (
          <div
            key={phase.id}
            className="p-4 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md"
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full inline-block mb-1">
                Active Official Portal
              </span>
              <h4 className="text-sm font-bold">
                {phase.id === "admit_card"
                  ? "Hall Ticket / Admit Card Download is Live"
                  : phase.id === "answer_key"
                  ? "Answer Key & Objection Portal is Live"
                  : phase.id === "result"
                  ? "Official Result & Scorecard is Live"
                  : "Portal is Active"}
              </h4>
              <p className="text-xs text-white/80 mt-0.5">
                {phase.closingDateDisplay
                  ? `Window closes on ${phase.closingDateDisplay}. Ensure you download before the deadline.`
                  : "Click below to visit the conducting authority's official portal."}
              </p>
            </div>

            <a
              href={phase.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-white text-primary-700 hover:bg-slate-100 font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow-sm transition shrink-0"
            >
              <Download className="w-4 h-4" /> Download / Access Official Link
            </a>
          </div>
        );
      })}

      {/* Lifecycle Notices & Official Updates List */}
      {events.length > 0 && (
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Official Milestone Announcements &amp; Notices ({events.length})
          </h4>
          <div className="space-y-2">
            {events.map((evt) => (
              <div
                key={evt.id}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {evt.title}
                    </span>
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {evt.event_type.replace("_", " ")}
                    </span>
                  </div>
                  {evt.description && (
                    <p className="text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {evt.description}
                    </p>
                  )}
                  <div className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-3">
                    <span>
                      Released: {new Date(evt.release_date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    {evt.closing_date && (
                      <span className="text-red-500 font-medium">
                        Deadline: {new Date(evt.closing_date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>

                {evt.official_url && (
                  <a
                    href={evt.official_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 text-[11px] font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/40 hover:bg-primary-100 rounded-lg inline-flex items-center gap-1 transition shrink-0"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
