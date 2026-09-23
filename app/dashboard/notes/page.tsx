/**
 * @file app/dashboard/notes/page.tsx
 * @description Candidate Personal Exam Notes Page.
 * Renders notes organized by tags, markdown content, and fast authoring.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 */

import React from "react";
import type { Metadata } from "next";
import { getCandidateNotes } from "../actions";
import { NotesList } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Personal Exam Notes | UPA-GURU",
  description: "Create and organize personal exam notes, formulas, syllabus checklists, and revision summaries.",
};

export default async function CandidateNotesPage() {
  const notesRes = await getCandidateNotes();
  const notes = notesRes.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Personal Exam Revision Notes
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Jot down formulas, syllabus highlights, and preparation strategies organized with custom hashtags.
        </p>
      </div>

      <NotesList initialNotes={notes} />
    </div>
  );
}
