"use client";

/**
 * @file components/dashboard/BookmarksList.tsx
 * @description Candidate Saved Circulars / Bookmarks interface.
 * Allows candidates to search, view official notification PDFs, and manage saved items.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 */

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  FileText,
  Calendar,
  Users,
  Search,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { toggleBookmarkAction } from "@/app/dashboard/actions";

interface BookmarkItem {
  id: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  details: {
    id?: string;
    slug?: string;
    title?: string;
    total_vacancies?: number | null;
    application_end_date?: string | null;
    official_pdf_url?: string | null;
    category?: string | null;
    state?: string | null;
  };
}

export default function BookmarksList({ initialBookmarks }: { initialBookmarks: BookmarkItem[] }) {
  const [bookmarks, setBookmarks] = useState(initialBookmarks);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isPending, startTransition] = useTransition();

  const handleRemove = (item: BookmarkItem) => {
    startTransition(async () => {
      // Optimistic removal
      setBookmarks((prev) => prev.filter((b) => b.id !== item.id));

      const res = await toggleBookmarkAction({
        entityType: item.entityType as "exam" | "notification",
        entityId: item.entityId,
      });

      if (!res.success) {
        // Rollback if failed
        setBookmarks((prev) => [...prev, item]);
      }
    });
  };

  const filteredBookmarks = bookmarks.filter((b) => {
    const title = b.details?.title?.toLowerCase() || "";
    const matchesSearch = title.includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || b.details?.category?.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search saved circulars & exams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Bookmarks Grid / List */}
      {filteredBookmarks.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
            <Bookmark className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">No saved circulars found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-5">
            You haven't bookmarked any notifications yet. Browse active notifications and click the bookmark icon to save them here.
          </p>
          <Link
            href="/notification"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-xs transition"
          >
            Explore Active Notifications
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBookmarks.map((item) => {
            const notif = item.details;
            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-blue-300 dark:hover:border-blue-700/60 transition group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {notif.category || item.entityType}
                    </span>
                    <button
                      onClick={() => handleRemove(item)}
                      disabled={isPending}
                      className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Remove from saved"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 mb-3">
                    {notif.title || "Government Examination Notification"}
                  </h4>

                  <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 mb-4">
                    {notif.application_end_date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>
                          Apply by: <strong className="text-slate-800 dark:text-slate-200">{notif.application_end_date}</strong>
                        </span>
                      </div>
                    )}
                    {notif.total_vacancies && (
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Vacancies: <strong>{notif.total_vacancies.toLocaleString()}</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  {notif.slug ? (
                    <Link
                      href={`/notification/${notif.slug}`}
                      className="flex-1 text-center py-1.5 px-3 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-lg transition"
                    >
                      View Details
                    </Link>
                  ) : null}

                  {notif.official_pdf_url && (
                    <a
                      href={notif.official_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                      title="Official PDF Circular"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
