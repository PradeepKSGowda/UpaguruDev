"use client";

/**
 * @file app/admin/review-queue/review-queue-client.tsx
 * @description Interactive Client Component for Human-in-the-Loop (HITL) review queue.
 * Allows administrators to inspect ambiguous document-to-cycle links, event conflicts,
 * and data quality flags with explainable reasons and approve/reject/reassign them.
 */

import React, { useState } from "react";
import {
  CheckCircle,
  XCircle,
  ExternalLink,
  ShieldCheck,
  Filter,
  RefreshCw,
  GitBranch,
} from "lucide-react";
import { resolveReviewQueueItemAction } from "./actions";

interface ReviewQueueItem {
  id: string;
  item_type: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  confidence: number | null;
  status: string;
  reasons_json: any;
  created_at: string;
  organization?: { id: string; code: string; name: string } | null;
  document?: {
    id: string;
    title: string;
    document_type: string;
    source_url: string;
    publication_date: string | null;
    reference_number: string | null;
  } | null;
  proposed_exam_master?: { id: string; exam_code: string; name: string } | null;
  proposed_exam_cycle?: {
    id: string;
    cycle_code: string;
    cycle_label: string;
    cycle_year: number | null;
  } | null;
  candidate_matches_json?: any;
  extracted_payload_json?: any;
}

interface ReviewQueueClientProps {
  initialItems: ReviewQueueItem[];
}

export function ReviewQueueClient({ initialItems }: ReviewQueueClientProps) {
  const [items, setItems] = useState<ReviewQueueItem[]>(initialItems);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeNotes, setActiveNotes] = useState<{ [key: string]: string }>({});
  const [targetCycleInput, setTargetCycleInput] = useState<{ [key: string]: string }>({});
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const filteredItems = items.filter((item) => {
    if (filterType === "ALL") return true;
    return item.item_type === filterType;
  });

  const handleResolve = async (
    itemId: string,
    action: "APPROVE" | "REJECT" | "REASSIGN_CYCLE"
  ) => {
    setProcessingId(itemId);
    setFeedback(null);

    const notes = activeNotes[itemId] || "";
    const targetCycleId = targetCycleInput[itemId]?.trim();

    if (action === "REASSIGN_CYCLE" && !targetCycleId) {
      setFeedback({ type: "error", message: "Please provide a valid Target Exam Cycle ID to reassign." });
      setProcessingId(null);
      return;
    }

    try {
      const res = await resolveReviewQueueItemAction({
        itemId,
        action,
        resolutionNotes: notes,
        targetExamCycleId: targetCycleId || undefined,
      });

      if (!res.success) {
        setFeedback({ type: "error", message: res.error || "Failed to resolve item" });
      } else {
        setFeedback({
          type: "success",
          message: `Successfully resolved item (${action})`,
        });
        // Remove from pending list
        setItems((prev) => prev.filter((it) => it.id !== itemId));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error executing action";
      setFeedback({ type: "error", message: msg });
    } finally {
      setProcessingId(null);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "HIGH":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">HIGH</span>;
      case "MEDIUM":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">MEDIUM</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">LOW</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between border ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-sm font-semibold underline ml-4 hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-2 text-slate-700">
          <Filter className="w-5 h-5 text-indigo-600" />
          <span className="font-semibold text-sm">Filter Category:</span>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "All Items", value: "ALL" },
              { label: "Document-Cycle Link", value: "DOCUMENT_CYCLE_LINK" },
              { label: "Event Conflicts", value: "EVENT_CONFLICT" },
              { label: "Corrigenda", value: "CORRIGENDUM_CHANGE" },
              { label: "Data Quality", value: "DATA_QUALITY_FLAG" },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilterType(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterType === tab.value
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing {filteredItems.length} of {items.length} pending items
        </div>
      </div>

      {/* List of Review Items */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm">
          <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-900">Review Queue is Clear!</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
            All crawled recruitment documents, dates, and event changes have either been verified
            automatically (confidence ≥ 85%) or resolved by an administrator.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const reasons: string[] = Array.isArray(item.reasons_json)
              ? item.reasons_json
              : [];
            const isProcessing = processingId === item.id;

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition-all space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {item.item_type}
                      </span>
                      {getPriorityBadge(item.priority)}
                      {item.organization && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {item.organization.code}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                    <h3 className="font-semibold text-base text-slate-900 leading-snug">
                      {item.document?.title || "Untitled Document Notice"}
                    </h3>
                  </div>

                  {/* Confidence Gauge */}
                  <div className="text-right">
                    <div className="text-xs text-slate-500 font-medium">Confidence</div>
                    <div
                      className={`text-lg font-bold ${
                        (item.confidence ?? 0) >= 80
                          ? "text-emerald-600"
                          : (item.confidence ?? 0) >= 65
                          ? "text-amber-600"
                          : "text-red-600"
                      }`}
                    >
                      {item.confidence != null ? `${item.confidence.toFixed(1)}%` : "N/A"}
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <div>
                    <h4 className="font-semibold text-slate-700 text-xs uppercase tracking-wider mb-2">
                      Document Evidence
                    </h4>
                    <div className="space-y-1 text-slate-600">
                      <div>
                        <span className="font-medium text-slate-800">Doc Type:</span>{" "}
                        {item.document?.document_type || "N/A"}
                      </div>
                      <div>
                        <span className="font-medium text-slate-800">Reference No:</span>{" "}
                        <span className="font-mono">{item.document?.reference_number || "Not detected"}</span>
                      </div>
                      <div>
                        <span className="font-medium text-slate-800">Publication Date:</span>{" "}
                        {item.document?.publication_date || "Unknown"}
                      </div>
                      {item.document?.source_url && (
                        <div className="pt-1">
                          <a
                            href={item.document.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
                          >
                            <span>Inspect Official Source PDF / Page</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-700 text-xs uppercase tracking-wider mb-2">
                      Proposed Resolution Link
                    </h4>
                    <div className="space-y-1 text-slate-600">
                      <div>
                        <span className="font-medium text-slate-800">Proposed Exam:</span>{" "}
                        {item.proposed_exam_master?.name || "Ambiguous"} (
                        <span className="font-mono text-xs">{item.proposed_exam_master?.exam_code || "N/A"}</span>)
                      </div>
                      <div>
                        <span className="font-medium text-slate-800">Proposed Cycle:</span>{" "}
                        {item.proposed_exam_cycle?.cycle_label || item.proposed_exam_cycle?.cycle_code || "New Cycle / Unresolved"}
                      </div>
                      <div className="pt-2">
                        <span className="text-xs font-semibold text-slate-700 block mb-1">
                          Algorithmic Signals:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {reasons.length > 0 ? (
                            reasons.map((r, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded text-xs bg-white text-slate-700 border border-slate-200"
                              >
                                {r}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">No signals recorded</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Candidate Matches if Ambiguous */}
                {Array.isArray(item.candidate_matches_json) && item.candidate_matches_json.length > 0 && (
                  <div className="border border-indigo-100 bg-indigo-50/50 p-3 rounded-lg text-xs space-y-1">
                    <span className="font-semibold text-indigo-900 block">
                      Top Cycle Candidates Considered:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-indigo-800">
                      {item.candidate_matches_json.map((cand: any, idx: number) => (
                        <li key={idx}>
                          <span className="font-mono font-medium">{cand.cycle_code}</span> ({cand.cycle_label}) — Score:{" "}
                          <span className="font-bold">{cand.score}%</span> [Reasons: {cand.reasons?.join(", ")}]
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Resolution Action Form */}
                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Add resolution notes (optional)..."
                      value={activeNotes[item.id] || ""}
                      onChange={(e) =>
                        setActiveNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      className="flex-1 min-w-[240px] px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                    <input
                      type="text"
                      placeholder="Target Cycle ID (if reassigning)..."
                      value={targetCycleInput[item.id] || ""}
                      onChange={(e) =>
                        setTargetCycleInput((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      className="w-56 px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => handleResolve(item.id, "REASSIGN_CYCLE")}
                      disabled={isProcessing}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors inline-flex items-center space-x-1 disabled:opacity-50"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>Reassign Cycle</span>
                    </button>

                    <button
                      onClick={() => handleResolve(item.id, "REJECT")}
                      disabled={isProcessing}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors inline-flex items-center space-x-1 disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>

                    <button
                      onClick={() => handleResolve(item.id, "APPROVE")}
                      disabled={isProcessing}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-colors inline-flex items-center space-x-1 disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle className="w-3.5 h-3.5" />
                      )}
                      <span>Approve & Verify</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
