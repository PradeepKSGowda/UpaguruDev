"use client";

/**
 * @file components/admin/ParsedFieldsForm.tsx
 * @description Interactive client-side form rendering AI-extracted fields with inline validation,
 * modification support, and Human-In-The-Loop (HITL) approval & rejection workflows.
 * 
 * Task ID: TASK-03020103 (Subtasks: SUB-0302010302, SUB-0302010303)
 * Architecture Reference: ADR-001 (Frontend RSC & Client Components), ADR-013 (Security)
 */

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Building2,
  Calendar,
  Users,
  Link as LinkIcon,
  ShieldCheck,
  FileText,
  Briefcase,
  ExternalLink,
} from "lucide-react";
import {
  draftParsedFieldsSchema,
  draftRejectionSchema,
} from "../../lib/schemas/drafts";
import type { DraftParsedJson, DraftStatus } from "../../types/drafts";
import { approveAndPublishDraftAction, rejectDraftAction } from "../../app/admin/drafts/actions";

export interface ParsedFieldsFormProps {
  draftId: string;
  initialFields: DraftParsedJson;
  status: DraftStatus;
  confidenceScore: number;
}

export default function ParsedFieldsForm({
  draftId,
  initialFields,
  status: initialStatus,
  confidenceScore,
}: ParsedFieldsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Status state
  const [currentStatus, setCurrentStatus] = useState<DraftStatus>(initialStatus);

  // Form field state initialized from AI extraction
  const [fields, setFields] = useState<{
    title: string;
    conducting_body: string;
    exam_name: string;
    notification_number: string;
    category: string;
    total_vacancies: string;
    application_start_date: string;
    application_end_date: string;
    exam_date: string;
    age_limit_min: string;
    age_limit_max: string;
    qualification_required: string;
    official_pdf_url: string;
    apply_online_url: string;
  }>({
    title: initialFields.title || "",
    conducting_body: initialFields.conducting_body || "",
    exam_name: initialFields.exam_name || "",
    notification_number: initialFields.notification_number || "",
    category: initialFields.category || "civil_services",
    total_vacancies: initialFields.total_vacancies !== null && initialFields.total_vacancies !== undefined
      ? String(initialFields.total_vacancies)
      : "",
    application_start_date: initialFields.application_start_date || "",
    application_end_date: initialFields.application_end_date || "",
    exam_date: initialFields.exam_date || "",
    age_limit_min: initialFields.age_limit_min !== null && initialFields.age_limit_min !== undefined
      ? String(initialFields.age_limit_min)
      : "",
    age_limit_max: initialFields.age_limit_max !== null && initialFields.age_limit_max !== undefined
      ? String(initialFields.age_limit_max)
      : "",
    qualification_required: Array.isArray(initialFields.qualification_required)
      ? initialFields.qualification_required.join("\n")
      : typeof initialFields.qualification_required === "string"
      ? initialFields.qualification_required
      : "",
    official_pdf_url: initialFields.official_pdf_url || "",
    apply_online_url: initialFields.apply_online_url || "",
  });

  // Inline validation errors state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Rejection modal state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState<string | null>(null);

  const handleFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));

    // Clear specific field error upon typing
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Human Operator Approval Workflow
  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionFeedback(null);
    setFieldErrors({});

    // Validate using Zod schema
    const validation = draftParsedFieldsSchema.safeParse({
      title: fields.title,
      conducting_body: fields.conducting_body,
      exam_name: fields.exam_name || null,
      notification_number: fields.notification_number || null,
      category: fields.category || null,
      total_vacancies: fields.total_vacancies,
      application_start_date: fields.application_start_date || null,
      application_end_date: fields.application_end_date || null,
      exam_date: fields.exam_date || null,
      age_limit_min: fields.age_limit_min,
      age_limit_max: fields.age_limit_max,
      qualification_required: fields.qualification_required,
      official_pdf_url: fields.official_pdf_url || null,
      apply_online_url: fields.apply_online_url || null,
    });

    if (!validation.success) {
      const formattedErrors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const path = issue.path[0];
        if (typeof path === "string") {
          formattedErrors[path] = issue.message;
        }
      }
      setFieldErrors(formattedErrors);
      setActionFeedback({
        type: "error",
        message: "Please correct the highlighted validation errors before approving.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await approveAndPublishDraftAction(draftId, validation.data);
        if (result.success) {
          setCurrentStatus("approved");
          setActionFeedback({
            type: "success",
            message: result.message,
          });
          // Redirect back to queue after brief feedback
          setTimeout(() => {
            router.push("/admin/drafts");
          }, 1500);
        } else {
          setActionFeedback({
            type: "error",
            message: result.message || "Failed to approve draft.",
          });
        }
      } catch (err) {
        setActionFeedback({
          type: "error",
          message: "A network error occurred. Please try again.",
        });
      }
    });
  };

  // Rejection Submission
  const handleRejectSubmit = () => {
    setRejectionError(null);

    const validation = draftRejectionSchema.safeParse({ reason: rejectionReason });
    if (!validation.success) {
      setRejectionError(validation.error.issues[0]?.message || "Invalid reason");
      return;
    }

    startTransition(async () => {
      try {
        const result = await rejectDraftAction(draftId, validation.data.reason);
        if (result.success) {
          setIsRejectModalOpen(false);
          setCurrentStatus("rejected");
          setActionFeedback({
            type: "success",
            message: result.message,
          });
          setTimeout(() => {
            router.push("/admin/drafts");
          }, 1500);
        } else {
          setRejectionError(result.message || "Failed to reject draft.");
        }
      } catch (err) {
        setRejectionError("A network error occurred while submitting rejection.");
      }
    });
  };

  return (
    <div
      id="parsed-fields-form"
      className="flex flex-col h-full rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 overflow-hidden shadow-sm"
    >
      {/* Header Bar */}
      <div className="p-4 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Structured Notification Fields
          </span>
          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
            ({Math.round(confidenceScore * 100)}% Match)
          </span>
        </div>

        {/* Current Lifecycle Status Pill */}
        <div className="flex items-center gap-2">
          {currentStatus === "pending_review" && (
            <span
              id="draft-status-badge"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"
            >
              <AlertTriangle className="w-3 h-3" />
              Pending Verification
            </span>
          )}
          {currentStatus === "approved" && (
            <span
              id="draft-status-badge"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            >
              <CheckCircle2 className="w-3 h-3" />
              Approved
            </span>
          )}
          {currentStatus === "rejected" && (
            <span
              id="draft-status-badge"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"
            >
              <XCircle className="w-3 h-3" />
              Rejected
            </span>
          )}
        </div>
      </div>

      {/* Global Feedback Banner */}
      {actionFeedback && (
        <div
          id="action-feedback-banner"
          className={`px-4 py-3 text-xs font-medium border-b flex items-center gap-2 ${
            actionFeedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/20 text-rose-300"
          }`}
        >
          {actionFeedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{actionFeedback.message}</span>
        </div>
      )}

      {/* Scrollable Form Body */}
      <form
        onSubmit={handleApprove}
        className="flex-1 p-5 overflow-y-auto max-h-[calc(100vh-320px)] space-y-4 text-xs"
      >
        {/* Title */}
        <div>
          <label htmlFor="field-title" className="block font-semibold text-slate-300 mb-1">
            Notification Title <span className="text-rose-400">*</span>
          </label>
          <input
            id="field-title"
            type="text"
            name="title"
            value={fields.title}
            onChange={handleFieldChange}
            disabled={isPending}
            placeholder="e.g., UPSC Civil Services Examination 2026"
            className={`w-full px-3 py-2 rounded-lg bg-slate-800 border text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 ${
              fieldErrors.title
                ? "border-rose-500 focus:ring-rose-500"
                : "border-slate-700 focus:ring-blue-500"
            }`}
          />
          {fieldErrors.title && (
            <p className="mt-1 text-rose-400 font-medium">{fieldErrors.title}</p>
          )}
        </div>

        {/* Conducting Body & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="field-conducting-body" className="block font-semibold text-slate-300 mb-1">
              Conducting Body <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Building2 className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500 pointer-events-none" />
              <input
                id="field-conducting-body"
                type="text"
                name="conducting_body"
                value={fields.conducting_body}
                onChange={handleFieldChange}
                disabled={isPending}
                placeholder="e.g., UPSC, SSC, IBPS"
                className={`w-full pl-8 pr-3 py-2 rounded-lg bg-slate-800 border text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 ${
                  fieldErrors.conducting_body
                    ? "border-rose-500 focus:ring-rose-500"
                    : "border-slate-700 focus:ring-blue-500"
                }`}
              />
            </div>
            {fieldErrors.conducting_body && (
              <p className="mt-1 text-rose-400 font-medium">{fieldErrors.conducting_body}</p>
            )}
          </div>

          <div>
            <label htmlFor="field-category" className="block font-semibold text-slate-300 mb-1">
              Exam Category
            </label>
            <div className="relative">
              <Briefcase className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500 pointer-events-none" />
              <select
                id="field-category"
                name="category"
                value={fields.category}
                onChange={handleFieldChange}
                disabled={isPending}
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none"
              >
                <option value="civil_services">Civil Services</option>
                <option value="banking">Banking</option>
                <option value="railways">Railways</option>
                <option value="defense">Defense</option>
                <option value="state_psc">State PSC</option>
                <option value="teaching">Teaching</option>
                <option value="police">Police</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Exam Name & Notification Number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="field-exam-name" className="block font-semibold text-slate-300 mb-1">
              Exam Name
            </label>
            <input
              id="field-exam-name"
              type="text"
              name="exam_name"
              value={fields.exam_name}
              onChange={handleFieldChange}
              disabled={isPending}
              placeholder="e.g., Civil Services (Preliminary) Examination"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="field-notification-number" className="block font-semibold text-slate-300 mb-1">
              Notice / Advert Number
            </label>
            <div className="relative">
              <FileText className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500 pointer-events-none" />
              <input
                id="field-notification-number"
                type="text"
                name="notification_number"
                value={fields.notification_number}
                onChange={handleFieldChange}
                disabled={isPending}
                placeholder="e.g., 05/2026-CSP"
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Vacancies & Age Limits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="field-total-vacancies" className="block font-semibold text-slate-300 mb-1">
              Total Vacancies
            </label>
            <div className="relative">
              <Users className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500 pointer-events-none" />
              <input
                id="field-total-vacancies"
                type="number"
                name="total_vacancies"
                value={fields.total_vacancies}
                onChange={handleFieldChange}
                disabled={isPending}
                placeholder="e.g., 1056"
                min="0"
                className={`w-full pl-8 pr-3 py-2 rounded-lg bg-slate-800 border text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 font-mono ${
                  fieldErrors.total_vacancies
                    ? "border-rose-500 focus:ring-rose-500"
                    : "border-slate-700 focus:ring-blue-500"
                }`}
              />
            </div>
            {fieldErrors.total_vacancies && (
              <p className="mt-1 text-rose-400 font-medium">{fieldErrors.total_vacancies}</p>
            )}
          </div>

          <div>
            <label htmlFor="field-age-min" className="block font-semibold text-slate-300 mb-1">
              Min Age (Years)
            </label>
            <input
              id="field-age-min"
              type="number"
              name="age_limit_min"
              value={fields.age_limit_min}
              onChange={handleFieldChange}
              disabled={isPending}
              placeholder="e.g., 21"
              min="0"
              max="100"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 font-mono"
            />
          </div>

          <div>
            <label htmlFor="field-age-max" className="block font-semibold text-slate-300 mb-1">
              Max Age (Years)
            </label>
            <input
              id="field-age-max"
              type="number"
              name="age_limit_max"
              value={fields.age_limit_max}
              onChange={handleFieldChange}
              disabled={isPending}
              placeholder="e.g., 32"
              min="0"
              max="100"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 font-mono"
            />
          </div>
        </div>

        {/* Key Timeline Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="field-start-date" className="block font-semibold text-slate-300 mb-1">
              Application Start
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500 pointer-events-none" />
              <input
                id="field-start-date"
                type="text"
                name="application_start_date"
                value={fields.application_start_date}
                onChange={handleFieldChange}
                disabled={isPending}
                placeholder="YYYY-MM-DD"
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="field-end-date" className="block font-semibold text-slate-300 mb-1">
              Application Deadline
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500 pointer-events-none" />
              <input
                id="field-end-date"
                type="text"
                name="application_end_date"
                value={fields.application_end_date}
                onChange={handleFieldChange}
                disabled={isPending}
                placeholder="YYYY-MM-DD"
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="field-exam-date" className="block font-semibold text-slate-300 mb-1">
              Exam Date
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500 pointer-events-none" />
              <input
                id="field-exam-date"
                type="text"
                name="exam_date"
                value={fields.exam_date}
                onChange={handleFieldChange}
                disabled={isPending}
                placeholder="YYYY-MM-DD"
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Qualifications */}
        <div>
          <label htmlFor="field-qualifications" className="block font-semibold text-slate-300 mb-1">
            Qualifications Required (One per line)
          </label>
          <div className="relative">
            <textarea
              id="field-qualifications"
              name="qualification_required"
              value={fields.qualification_required}
              onChange={handleFieldChange}
              disabled={isPending}
              rows={3}
              placeholder="e.g., Bachelor's Degree in any discipline from a recognized University"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed font-sans"
            />
          </div>
        </div>

        {/* Official URLs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="field-pdf-url" className="block font-semibold text-slate-300 mb-1">
              Official PDF URL
            </label>
            <div className="relative">
              <LinkIcon className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500 pointer-events-none" />
              <input
                id="field-pdf-url"
                type="url"
                name="official_pdf_url"
                value={fields.official_pdf_url}
                onChange={handleFieldChange}
                disabled={isPending}
                placeholder="https://..."
                className={`w-full pl-8 pr-3 py-2 rounded-lg bg-slate-800 border text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 font-mono ${
                  fieldErrors.official_pdf_url
                    ? "border-rose-500 focus:ring-rose-500"
                    : "border-slate-700 focus:ring-blue-500"
                }`}
              />
            </div>
            {fieldErrors.official_pdf_url && (
              <p className="mt-1 text-rose-400 font-medium">{fieldErrors.official_pdf_url}</p>
            )}
          </div>

          <div>
            <label htmlFor="field-apply-url" className="block font-semibold text-slate-300 mb-1">
              Apply Online URL
            </label>
            <div className="relative">
              <ExternalLink className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500 pointer-events-none" />
              <input
                id="field-apply-url"
                type="url"
                name="apply_online_url"
                value={fields.apply_online_url}
                onChange={handleFieldChange}
                disabled={isPending}
                placeholder="https://upsconline.nic.in"
                className={`w-full pl-8 pr-3 py-2 rounded-lg bg-slate-800 border text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 font-mono ${
                  fieldErrors.apply_online_url
                    ? "border-rose-500 focus:ring-rose-500"
                    : "border-slate-700 focus:ring-blue-500"
                }`}
              />
            </div>
            {fieldErrors.apply_online_url && (
              <p className="mt-1 text-rose-400 font-medium">{fieldErrors.apply_online_url}</p>
            )}
          </div>
        </div>

        {/* Action Controls Section */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <button
            id="draft-reject-btn"
            type="button"
            onClick={() => {
              setRejectionError(null);
              setIsRejectModalOpen(true);
            }}
            disabled={isPending || currentStatus === "rejected"}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition disabled:opacity-40 flex items-center gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Reject Draft</span>
          </button>

          <button
            id="draft-approve-btn"
            type="submit"
            disabled={isPending || currentStatus === "approved"}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 transition disabled:opacity-40 flex items-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving & Publishing...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve & Publish</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Rejection Modal Dialog */}
      {isRejectModalOpen && (
        <div
          id="rejection-reason-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          role="dialog"
          aria-labelledby="modal-title"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <h3 id="modal-title" className="text-sm font-bold text-slate-100">
                Reject Draft Notification
              </h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Please provide an actionable reason for rejecting this AI extraction. This explanation
              will be permanently logged in the audit ledger.
            </p>

            <div>
              <textarea
                id="rejection-reason-input"
                rows={4}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this draft is invalid (minimum 10 characters)..."
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
              {rejectionError && (
                <p className="mt-1 text-xs text-rose-400 font-medium">{rejectionError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                id="rejection-cancel-btn"
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                disabled={isPending}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                Cancel
              </button>

              <button
                id="rejection-submit-btn"
                type="button"
                onClick={handleRejectSubmit}
                disabled={isPending || rejectionReason.trim().length < 10}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition disabled:opacity-40 flex items-center gap-1.5"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
