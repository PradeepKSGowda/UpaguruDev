/**
 * @file app/admin/drafts/[id]/page.tsx
 * @description Side-by-side draft review workspace for Human-In-The-Loop (HITL) operators.
 * Renders raw extracted OCR text on the left panel and editable structured fields on the right panel
 * with approval and rejection workflows.
 * 
 * Task ID: TASK-03020103
 * Subtasks:
 * - SUB-0302010301: RawTextPanel component
 * - SUB-0302010302: ParsedFieldsForm component
 * - SUB-0302010303: Wire approve and reject buttons to Server Actions with audit logging
 * 
 * Architecture References: ADR-001 (Next.js 15 RSC), ADR-002 (Database), ADR-003 (RBAC), ADR-013 (Security)
 */

import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { getDraftNotificationById } from "../../../../lib/data/drafts";
import { RawTextPanel, ParsedFieldsForm } from "../../../../components/admin";

interface DraftReviewPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Dynamic metadata generation for administrative draft review
 */
export async function generateMetadata({
  params,
}: DraftReviewPageProps): Promise<Metadata> {
  const { id } = await params;
  const draft = await getDraftNotificationById(id);

  const title = draft?.parsedJson?.title
    ? `Review: ${draft.parsedJson.title}`
    : `Review Draft #${id.slice(0, 8)}`;

  return {
    title,
    description: `Side-by-side verification and approval workspace for draft notification ${id}.`,
  };
}

/**
 * Formats a 0..1 confidence float to a styled percentage badge
 */
function getConfidenceBadge(score: number) {
  const percent = Math.round(score * 100);
  if (percent >= 85) {
    return {
      text: `${percent}% Confidence`,
      classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    };
  }
  if (percent >= 60) {
    return {
      text: `${percent}% Confidence`,
      classes: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    };
  }
  return {
    text: `${percent}% Low Confidence`,
    classes: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };
}

export default async function DraftReviewPage({ params }: DraftReviewPageProps) {
  const { id } = await params;

  // 1. Fetch draft notification by UUID
  const draft = await getDraftNotificationById(id);

  // 2. Fail-safe: Render Not Found if draft record is absent
  if (!draft) {
    return (
      <div
        id="draft-review-not-found"
        className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4"
      >
        <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-100">Draft Notification Not Found</h2>
        <p className="text-sm text-slate-400 max-w-md">
          The requested draft notification ID (<code className="text-blue-400">{id}</code>) does not exist or has been removed from the review queue.
        </p>
        <Link
          href="/admin/drafts"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Draft Queue</span>
        </Link>
      </div>
    );
  }

  const confidence = getConfidenceBadge(draft.extractionConfidenceScore);
  const displayTitle = draft.parsedJson?.title || "Untitled AI Draft Notification";

  return (
    <div
      id="draft-review-page"
      className="space-y-4 max-w-7xl mx-auto pb-10"
    >
      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs text-slate-400"
      >
        <Link
          href="/admin"
          className="hover:text-slate-200 transition"
        >
          Admin
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <Link
          href="/admin/drafts"
          className="hover:text-slate-200 transition"
        >
          Draft Queue
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-slate-200 font-medium truncate max-w-xs sm:max-w-sm">
          {displayTitle}
        </span>
      </nav>

      {/* Top Workspace Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/drafts"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-200 transition mr-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </Link>

            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${confidence.classes}`}
            >
              <Sparkles className="w-3 h-3" />
              {confidence.text}
            </span>

            <span className="text-xs text-slate-500 font-mono">
              ID: {draft.id.slice(0, 8)}
            </span>
          </div>

          <h1 className="text-lg sm:text-xl font-bold text-slate-100 truncate">
            {displayTitle}
          </h1>

          <p className="text-xs text-slate-400">
            Discovered on {new Date(draft.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {/* Action Header Links */}
        <div className="flex items-center gap-3">
          <a
            id="draft-original-source-btn"
            href={draft.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition shadow-sm"
          >
            <span>Source Document</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
        </div>
      </div>

      {/* Side-by-Side Review Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch min-h-[600px]">
        {/* Left Column: Raw OCR Extracted Text Panel */}
        <div className="h-full">
          <RawTextPanel
            rawText={draft.rawExtractedText}
            sourceUrl={draft.sourceUrl}
            confidenceScore={draft.extractionConfidenceScore}
          />
        </div>

        {/* Right Column: Editable Parsed Fields Form */}
        <div className="h-full">
          <ParsedFieldsForm
            draftId={draft.id}
            initialFields={draft.parsedJson}
            status={draft.status}
            confidenceScore={draft.extractionConfidenceScore}
          />
        </div>
      </div>
    </div>
  );
}
