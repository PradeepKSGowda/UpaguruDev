/**
 * @file components/admin/DraftCard.tsx
 * @description Card component displaying AI-extracted draft notification summary,
 * confidence score threshold badge, conducting body, extracted fields, and review link.
 * 
 * Task ID: TASK-03020102 (Subtask: SUB-0302010201)
 * Architecture Reference: ADR-001 (Frontend Architecture), ADR-002 (Database)
 */

import React from "react";
import Link from "next/link";
import {
  FileText,
  ExternalLink,
  Calendar,
  Users,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Clock,
} from "lucide-react";
import type { DraftNotification } from "../../types/drafts";

export interface DraftCardProps {
  /** The draft notification domain entity */
  draft: DraftNotification;
}

/**
 * Computes the color scheme and badge indicator based on extraction confidence score.
 * Thresholds:
 * - >= 0.90: Green (High accuracy)
 * - >= 0.85: Amber (Review suggested)
 * - < 0.85: Red with AlertTriangle (Warning: Low confidence OCR extraction)
 */
function getConfidenceBadge(score: number): {
  label: string;
  badgeClass: string;
  cardBorder: string;
  icon: React.ComponentType<{ className?: string }>;
  isWarning: boolean;
} {
  const percentage = Math.round(score * 100);

  if (score >= 0.9) {
    return {
      label: `${percentage}% High Confidence`,
      badgeClass:
        "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
      cardBorder: "border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700",
      icon: CheckCircle2,
      isWarning: false,
    };
  }

  if (score >= 0.85) {
    return {
      label: `${percentage}% Review Suggested`,
      badgeClass:
        "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800",
      cardBorder: "border-amber-200/60 dark:border-amber-900/40 hover:border-amber-300 dark:hover:border-amber-700",
      icon: AlertCircle,
      isWarning: true,
    };
  }

  return {
    label: `${percentage}% Low Confidence`,
    badgeClass:
      "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800",
    cardBorder: "border-red-200/80 dark:border-red-900/60 hover:border-red-400 dark:hover:border-red-600 bg-red-50/20 dark:bg-red-950/10",
    icon: AlertTriangle,
    isWarning: true,
  };
}

export default function DraftCard({ draft }: DraftCardProps) {
  const confidence = getConfidenceBadge(draft.extractionConfidenceScore);
  const ConfidenceIcon = confidence.icon;

  const parsed = draft.parsedJson;
  const title = parsed.title || parsed.exam_name || "Untitled Scraped Notification";
  const conductingBody = parsed.conducting_body || "Official Government Board";
  const vacancies = parsed.total_vacancies;
  const deadline = parsed.application_end_date;

  const formattedDate = new Date(draft.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <article
      id={`draft-card-${draft.id}`}
      data-testid="draft-card"
      className={`rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 border shadow-sm transition-all duration-200 hover:shadow-md ${confidence.cardBorder}`}
    >
      {/* Top Meta: Confidence Badge & Status Tag */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <span
            id={`draft-confidence-badge-${draft.id}`}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${confidence.badgeClass}`}
          >
            <ConfidenceIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{confidence.label}</span>
          </span>

          {confidence.isWarning && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              <span>Verify Fields Carefully</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 font-mono">
          <Clock className="w-3.5 h-3.5" />
          <span>{formattedDate}</span>
        </div>
      </div>

      {/* Main Content: Title & Conducting Body */}
      <div className="py-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {conductingBody}
          </span>
          {parsed.category && (
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold capitalize bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {parsed.category.replace(/_/g, " ")}
            </span>
          )}
        </div>

        <h3 className="text-base sm:text-lg font-heading font-bold text-slate-900 dark:text-white leading-snug">
          {title}
        </h3>

        {/* Source URL Preview */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-1">
          <FileText className="w-4 h-4 shrink-0 text-slate-400" />
          <a
            href={draft.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-sm sm:max-w-md font-mono"
            title={draft.sourceUrl}
          >
            {draft.sourceUrl}
          </a>
          <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
        </div>
      </div>

      {/* Metadata Highlights: Vacancies & Application Deadline */}
      <div className="pt-3 pb-4 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800/80">
        {typeof vacancies === "number" && vacancies > 0 && (
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>
              <strong>{vacancies.toLocaleString("en-IN")}</strong> Vacancies
            </span>
          </div>
        )}

        {deadline && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>
              Deadline: <strong>{deadline}</strong>
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <span className="capitalize font-semibold text-slate-500 dark:text-slate-400">
            Status: {draft.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Card Action CTA */}
      <div className="pt-2 flex items-center justify-between">
        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
          ID: {draft.id.slice(0, 8)}...
        </span>

        <Link
          id={`draft-verify-btn-${draft.id}`}
          href={`/admin/drafts/${draft.id}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition group focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <span>Verify & Review</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </article>
  );
}
