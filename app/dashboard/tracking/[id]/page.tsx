/**
 * @file app/dashboard/tracking/[id]/page.tsx
 * @description Examination Syllabus & Subject Mastery Tracker detail page.
 * Loads syllabus data, candidate progress, and renders interactive mastery tools.
 *
 * Enhancement: ENH-0011 (Interactive Exam Syllabus & Subject Mastery Tracker)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-002 (Database)
 */

import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { getSyllabusProgressAction } from "@/app/dashboard/tracking/syllabus-actions";
import { getExamLifecycleAction } from "@/app/dashboard/tracking/lifecycle-actions";
import { SyllabusMasteryTracker, ExamLifecycleTimeline } from "@/components/dashboard";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const res = await getSyllabusProgressAction(id);
  const title = res.data?.examTitle || "Exam Syllabus & Lifecycle";

  return {
    title: `${title} — Lifecycle & Preparation Tracker | UPA-GURU`,
    description: `Track admit card releases, exam dates, answer keys, results, and topic preparation for ${title}.`,
  };
}

export default async function ExamSyllabusPage({ params }: PageProps) {
  const { id } = await params;
  const [syllabusRes, lifecycleRes] = await Promise.all([
    getSyllabusProgressAction(id),
    getExamLifecycleAction(id),
  ]);

  if (!syllabusRes.success || !syllabusRes.data) {
    return (
      <div className="p-8 max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Examination Workspace Not Available
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {syllabusRes.error || "Could not retrieve examination details."}
        </p>
        <Link
          href="/dashboard/tracking"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 dark:bg-primary-950/40 rounded-lg transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Return to Application Tracker
        </Link>
      </div>
    );
  }

  const { summary, examTitle, examCategory, notificationSlug } = syllabusRes.data;

  return (
    <div className="space-y-8">
      {/* 1. Exam Lifecycle & Milestone Timeline */}
      {lifecycleRes.success && lifecycleRes.data && (
        <section aria-label="Exam Lifecycle Status">
          <ExamLifecycleTimeline
            timeline={lifecycleRes.data}
            examTitle={examTitle}
          />
        </section>
      )}

      {/* 2. Interactive Syllabus & Subject Mastery Tracker */}
      <section aria-label="Syllabus Mastery Tracker">
        <SyllabusMasteryTracker
          notificationId={id}
          examTitle={examTitle}
          examCategory={examCategory}
          notificationSlug={notificationSlug}
          initialSummary={summary}
        />
      </section>
    </div>
  );
}
