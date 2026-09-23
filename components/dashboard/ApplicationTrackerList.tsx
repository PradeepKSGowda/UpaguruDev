"use client";

/**
 * @file components/dashboard/ApplicationTrackerList.tsx
 * @description Milestone-driven Application Tracker for Candidate Workspace.
 * Tracks exam application lifecycle: Application Submitted -> Fee Paid -> Hall Ticket -> Attended -> Result.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 */

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Milestone,
  CheckCircle2,
  Circle,
  Clock,
  Award,
  AlertCircle,
  ChevronRight,
  ExternalLink,
  Edit2,
  Save,
} from "lucide-react";
import { updateExamTrackingAction } from "@/app/dashboard/actions";

interface TrackingItem {
  id: string;
  notification_id: string;
  application_submitted: boolean;
  application_number: string | null;
  fee_paid: boolean;
  fee_amount: number | null;
  hall_ticket_downloaded: boolean;
  exam_attended: boolean;
  result_status: "pending" | "qualified" | "disqualified" | "waitlisted";
  custom_notes: string | null;
  notification: {
    id?: string;
    title?: string;
    slug?: string;
    application_end_date?: string | null;
    category?: string | null;
    state?: string | null;
  };
}

export default function ApplicationTrackerList({ initialTracking }: { initialTracking: TrackingItem[] }) {
  const [items, setItems] = useState<TrackingItem[]>(initialTracking);
  const [activeEditingId, setActiveEditingId] = useState<string | null>(null);
  const [appNumber, setAppNumber] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleToggleStage = (
    item: TrackingItem,
    field: "application_submitted" | "fee_paid" | "hall_ticket_downloaded" | "exam_attended"
  ) => {
    const updated = {
      ...item,
      [field]: !item[field],
    };

    setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));

    startTransition(async () => {
      await updateExamTrackingAction({
        notificationId: item.notification_id,
        applicationSubmitted: updated.application_submitted,
        applicationNumber: updated.application_number,
        feePaid: updated.fee_paid,
        feeAmount: updated.fee_amount ? Number(updated.fee_amount) : null,
        hallTicketDownloaded: updated.hall_ticket_downloaded,
        examAttended: updated.exam_attended,
        resultStatus: updated.result_status,
        customNotes: updated.custom_notes,
      });
    });
  };

  const handleSetResultStatus = (item: TrackingItem, status: "pending" | "qualified" | "disqualified" | "waitlisted") => {
    const updated = { ...item, result_status: status };
    setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));

    startTransition(async () => {
      await updateExamTrackingAction({
        notificationId: item.notification_id,
        applicationSubmitted: updated.application_submitted,
        applicationNumber: updated.application_number,
        feePaid: updated.fee_paid,
        feeAmount: updated.fee_amount ? Number(updated.fee_amount) : null,
        hallTicketDownloaded: updated.hall_ticket_downloaded,
        examAttended: updated.exam_attended,
        resultStatus: status,
        customNotes: updated.custom_notes,
      });
    });
  };

  const handleSaveDetails = (item: TrackingItem) => {
    const updated = {
      ...item,
      application_number: appNumber || null,
      fee_amount: feeAmount ? parseFloat(feeAmount) : null,
      custom_notes: notes || null,
    };

    setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    setActiveEditingId(null);

    startTransition(async () => {
      await updateExamTrackingAction({
        notificationId: item.notification_id,
        applicationSubmitted: updated.application_submitted,
        applicationNumber: updated.application_number,
        feePaid: updated.fee_paid,
        feeAmount: updated.fee_amount,
        hallTicketDownloaded: updated.hall_ticket_downloaded,
        examAttended: updated.exam_attended,
        resultStatus: updated.result_status,
        customNotes: updated.custom_notes,
      });
    });
  };

  const startEditDetails = (item: TrackingItem) => {
    setActiveEditingId(item.id);
    setAppNumber(item.application_number || "");
    setFeeAmount(item.fee_amount ? String(item.fee_amount) : "");
    setNotes(item.custom_notes || "");
  };

  if (items.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
          <Milestone className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">No active exam applications</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-5">
          Track registration numbers, fee receipts, hall tickets, and results in one place.
        </p>
        <Link
          href="/notification"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-xs transition"
        >
          Browse Notifications to Track
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {items.map((item) => {
        const notif = item.notification;
        const isEditing = activeEditingId === item.id;

        const stages = [
          { key: "application_submitted", label: "Applied", done: item.application_submitted },
          { key: "fee_paid", label: "Fee Paid", done: item.fee_paid },
          { key: "hall_ticket_downloaded", label: "Admit Card", done: item.hall_ticket_downloaded },
          { key: "exam_attended", label: "Attended", done: item.exam_attended },
        ];

        return (
          <div
            key={item.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 mb-1">
                  {notif.category || "Exam"}
                </span>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  {notif.title || "Government Exam Application"}
                </h4>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {notif.slug && (
                  <Link
                    href={`/notification/${notif.slug}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                  >
                    Circular Details <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </Link>
                )}
                <button
                  onClick={() => (isEditing ? handleSaveDetails(item) : startEditDetails(item))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition"
                >
                  {isEditing ? (
                    <>
                      <Save className="w-3.5 h-3.5" /> Save
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-3.5 h-3.5" /> Edit Info
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Visual Stepper */}
            <div className="py-5">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Milestone Progress
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {stages.map((stg) => (
                  <button
                    key={stg.key}
                    onClick={() =>
                      handleToggleStage(
                        item,
                        stg.key as "application_submitted" | "fee_paid" | "hall_ticket_downloaded" | "exam_attended"
                      )
                    }
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition ${
                      stg.done
                        ? "bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                        : "bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    {stg.done ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0" />
                    )}
                    <div>
                      <span className="text-xs font-bold block">{stg.label}</span>
                      <span className="text-[10px] opacity-75">{stg.done ? "Completed" : "Click to mark done"}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Result Status & Application Details */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Left Details */}
              {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Application / Reg No
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. UPSC2026/89432"
                      value={appNumber}
                      onChange={(e) => setAppNumber(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Fee Paid Amount (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 100"
                      value={feeAmount}
                      onChange={(e) => setFeeAmount(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Reg / App No</span>
                    <strong className="text-slate-900 dark:text-white font-mono">
                      {item.application_number || "Not added"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Fee Paid</span>
                    <strong className="text-slate-900 dark:text-white">
                      {item.fee_paid ? (item.fee_amount ? `₹${item.fee_amount}` : "Yes") : "Pending"}
                    </strong>
                  </div>
                </div>
              )}

              {/* Result Status Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Result Status:</span>
                <select
                  value={item.result_status}
                  onChange={(e) =>
                    handleSetResultStatus(
                      item,
                      e.target.value as "pending" | "qualified" | "disqualified" | "waitlisted"
                    )
                  }
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="pending">Pending</option>
                  <option value="qualified">Qualified 🎉</option>
                  <option value="disqualified">Not Qualified</option>
                  <option value="waitlisted">Waitlisted</option>
                </select>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
