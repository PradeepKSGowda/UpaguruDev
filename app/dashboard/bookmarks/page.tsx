/**
 * @file app/dashboard/bookmarks/page.tsx
 * @description Candidate Saved Circulars & Bookmarks Page.
 * Renders searchable and filterable bookmarks with direct access to official notification PDFs.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 */

import React from "react";
import type { Metadata } from "next";
import { getCandidateBookmarks } from "../actions";
import { BookmarksList } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Saved Circulars & Bookmarks | UPA-GURU",
  description: "Quick access to all bookmarked government exam circulars and recruitment advertisements.",
};

export default async function CandidateBookmarksPage() {
  const bookmarksRes = await getCandidateBookmarks();
  const bookmarks = bookmarksRes.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Saved Circulars & Notifications
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Access bookmarked official PDFs, exam guidelines, and recruitment circulars in one place.
        </p>
      </div>

      <BookmarksList initialBookmarks={bookmarks} />
    </div>
  );
}
