"use client";

/**
 * @file components/admin/NotificationForm.tsx
 * @description Administrative form for authoring and amending job notifications manually,
 * featuring parent exam selector, live slug auto-generation, Zod validation, and server action dispatch.
 * 
 * Task ID: TASK-03030102 (Subtask: SUB-0303010201)
 * Architecture Reference: ADR-001 (App Router), ADR-002 (Database)
 */

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Users,
  FileText,
  Globe,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  RotateCcw,
} from "lucide-react";
import { NOTIFICATION_STATUSES, NotificationStatus, adminNotificationInputSchema } from "@/lib/schemas/admin-notifications";
import { createNotificationAction, updateNotificationAction } from "@/app/admin/notifications/actions";
import { AdminNotificationListItem, ExamOption } from "@/lib/data/admin-notifications";

export interface NotificationFormProps {
  initialData?: AdminNotificationListItem | null;
  examOptions: ExamOption[];
  mode: "create" | "edit";
}

const STATUS_LABELS: Record<string, string> = {
  published: "Published (Visible on Candidate Portal)",
  under_review: "Under Review (Staged for Verification)",
  draft: "Draft (Internal Work-in-Progress)",
  archived: "Archived (Past / Closed)",
};

export default function NotificationForm({
  initialData,
  examOptions,
  mode,
}: NotificationFormProps) {
  const router = useRouter();

  const [examId, setExamId] = useState(initialData?.exam_id || (examOptions[0]?.id || ""));
  const [title, setTitle] = useState(initialData?.title || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [slugCustomized, setSlugCustomized] = useState(Boolean(initialData?.slug));
  const [notificationNumber, setNotificationNumber] = useState(initialData?.notification_number || "");
  const [totalVacancies, setTotalVacancies] = useState<number | string>(
    initialData?.total_vacancies ?? 0
  );
  const [applicationStartDate, setApplicationStartDate] = useState(
    initialData?.application_start_date || new Date().toISOString().slice(0, 10)
  );
  const [applicationEndDate, setApplicationEndDate] = useState(
    initialData?.application_end_date ||
      new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
  const [examDate, setExamDate] = useState(initialData?.exam_date || "");
  const [qualificationText, setQualificationText] = useState(
    Array.isArray(initialData?.qualification_required)
      ? initialData.qualification_required.join("\n")
      : ""
  );
  const [ageLimitMin, setAgeLimitMin] = useState<number | string>(initialData?.age_limit_min ?? "");
  const [ageLimitMax, setAgeLimitMax] = useState<number | string>(initialData?.age_limit_max ?? "");
  const [officialPdfUrl, setOfficialPdfUrl] = useState(initialData?.official_pdf_url || "");
  const [applyOnlineUrl, setApplyOnlineUrl] = useState(initialData?.apply_online_url || "");
  const [status, setStatus] = useState<NotificationStatus>(
    (initialData?.status as NotificationStatus) || "published"
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const generateSlug = (val: string) => {
    return val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (!slugCustomized || !slug) {
      setSlug(generateSlug(val));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugCustomized(true);
    setSlug(e.target.value);
  };

  const handleResetSlug = () => {
    setSlugCustomized(false);
    setSlug(generateSlug(title));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSuccessMessage(null);

    const qualifications = qualificationText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      exam_id: examId,
      title,
      slug,
      notification_number: notificationNumber.trim() || null,
      total_vacancies: totalVacancies === "" ? 0 : Number(totalVacancies),
      application_start_date: applicationStartDate,
      application_end_date: applicationEndDate,
      exam_date: examDate.trim() ? examDate : null,
      qualification_required: qualifications,
      age_limit_min: ageLimitMin === "" ? null : Number(ageLimitMin),
      age_limit_max: ageLimitMax === "" ? null : Number(ageLimitMax),
      official_pdf_url: officialPdfUrl.trim() || null,
      apply_online_url: applyOnlineUrl.trim() || null,
      status,
    };

    // Client-side Zod validation
    const clientValidation = adminNotificationInputSchema.safeParse(payload);
    if (!clientValidation.success) {
      setFieldErrors(clientValidation.error.flatten().fieldErrors);
      setFormError("Please fix the validation errors below.");
      return;
    }

    startTransition(async () => {
      if (mode === "create") {
        const res = await createNotificationAction(payload);
        if (res.success) {
          setSuccessMessage("Notification created successfully! Redirecting to list...");
          setTimeout(() => {
            router.push("/admin/notifications");
            router.refresh();
          }, 800);
        } else {
          setFormError(res.error || "Failed to create notification");
          if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        }
      } else if (mode === "edit" && initialData?.id) {
        const res = await updateNotificationAction(initialData.id, payload);
        if (res.success) {
          setSuccessMessage("Notification updated successfully! Redirecting to list...");
          setTimeout(() => {
            router.push("/admin/notifications");
            router.refresh();
          }, 800);
        } else {
          setFormError(res.error || "Failed to update notification");
          if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        }
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="notification-form-container">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/notifications"
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {mode === "create"
                ? "Author New Job Notification"
                : `Edit Notification: ${initialData?.title}`}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {mode === "create"
                ? "Directly author and publish government notifications outside the AI scraper feed"
                : "Modify dates, vacancies, eligibility criteria, or publication lifecycle"}
            </p>
          </div>
        </div>
      </div>

      {/* Main Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 sm:p-8 space-y-8"
        data-testid="notification-form"
      >
        {formError && (
          <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm text-emerald-700 dark:text-emerald-300 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Section 1: Classification & Entity Association */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-800 pb-2">
            1. Parent Examination & Core Identity
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Parent Exam Selector */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                Parent Examination Series <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={examId}
                  onChange={(e) => setExamId(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 font-medium"
                  data-testid="field-exam-id"
                  required
                >
                  <option value="" disabled>
                    -- Select Examination Series --
                  </option>
                  {examOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.title} ({opt.conducting_body} - {opt.state_or_central})
                    </option>
                  ))}
                </select>
              </div>
              {fieldErrors.exam_id && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.exam_id[0]}</p>
              )}
            </div>

            {/* Notification Title */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                Notification Headline / Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={handleTitleChange}
                placeholder="e.g. UPSC Civil Services (Preliminary) Examination 2026 Notification"
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                data-testid="field-title"
                required
              />
              {fieldErrors.title && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.title[0]}</p>
              )}
            </div>

            {/* URL Slug */}
            <div className="sm:col-span-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Canonical URL Slug <span className="text-red-500">*</span>
                </label>
                {slugCustomized && (
                  <button
                    type="button"
                    onClick={handleResetSlug}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Auto-sync from headline
                  </button>
                )}
              </div>
              <div className="flex rounded-lg shadow-sm">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-mono">
                  /notification/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={handleSlugChange}
                  placeholder="upsc-civil-services-prelims-2026"
                  className="flex-1 px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-r-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                  data-testid="field-slug"
                  required
                />
              </div>
              {fieldErrors.slug && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.slug[0]}</p>
              )}
            </div>

            {/* Notification Reference Number */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                Official Reference / Advt. No.
              </label>
              <input
                type="text"
                value={notificationNumber}
                onChange={(e) => setNotificationNumber(e.target.value)}
                placeholder="e.g. 05/2026-CSP"
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                data-testid="field-notification-number"
              />
              {fieldErrors.notification_number && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {fieldErrors.notification_number[0]}
                </p>
              )}
            </div>

            {/* Total Vacancies */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                Total Declared Vacancies <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  value={totalVacancies}
                  onChange={(e) => setTotalVacancies(e.target.value)}
                  placeholder="1056"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 font-semibold"
                  data-testid="field-vacancies"
                  required
                />
              </div>
              {fieldErrors.total_vacancies && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {fieldErrors.total_vacancies[0]}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Important Dates & Age Limit */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-800 pb-2">
            2. Application Deadlines & Eligibility Limits
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Start Date */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                Opening Date (Start) <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={applicationStartDate}
                onChange={(e) => setApplicationStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                data-testid="field-start-date"
                required
              />
              {fieldErrors.application_start_date && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {fieldErrors.application_start_date[0]}
                </p>
              )}
            </div>

            {/* End Date */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                Deadline (Closing Date) <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={applicationEndDate}
                onChange={(e) => setApplicationEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 font-semibold"
                data-testid="field-end-date"
                required
              />
              {fieldErrors.application_end_date && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {fieldErrors.application_end_date[0]}
                </p>
              )}
            </div>

            {/* Exam Date */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                Scheduled Exam Date <span className="text-xs font-normal text-gray-400">(Optional)</span>
              </label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                data-testid="field-exam-date"
              />
              {fieldErrors.exam_date && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {fieldErrors.exam_date[0]}
                </p>
              )}
            </div>

            {/* Minimum Age */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                Minimum Age (Years)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={ageLimitMin}
                onChange={(e) => setAgeLimitMin(e.target.value)}
                placeholder="21"
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                data-testid="field-age-min"
              />
              {fieldErrors.age_limit_min && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {fieldErrors.age_limit_min[0]}
                </p>
              )}
            </div>

            {/* Maximum Age */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                Maximum Age (Years)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={ageLimitMax}
                onChange={(e) => setAgeLimitMax(e.target.value)}
                placeholder="32"
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                data-testid="field-age-max"
              />
              {fieldErrors.age_limit_max && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {fieldErrors.age_limit_max[0]}
                </p>
              )}
            </div>

            {/* Lifecycle Status */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                Publication Status <span className="text-red-500">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as NotificationStatus)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 font-semibold"
                data-testid="field-status"
              >
                {NOTIFICATION_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {STATUS_LABELS[st] || st}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Qualifications & URLs */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-800 pb-2">
            3. Eligibility Criteria & External Links
          </h2>

          <div className="space-y-6">
            {/* Qualifications textarea */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                Qualifications Required (One per line)
              </label>
              <textarea
                rows={3}
                value={qualificationText}
                onChange={(e) => setQualificationText(e.target.value)}
                placeholder="Bachelor's Degree in any discipline from a recognized university&#10;Equivalent qualification recognized by Government of India"
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 font-mono"
                data-testid="field-qualifications"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Enter each qualification on a separate line.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Official PDF URL */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Official PDF Notification URL
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="url"
                    value={officialPdfUrl}
                    onChange={(e) => setOfficialPdfUrl(e.target.value)}
                    placeholder="https://upsc.gov.in/sites/default/files/CSP-2026.pdf"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                    data-testid="field-pdf-url"
                  />
                </div>
                {fieldErrors.official_pdf_url && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {fieldErrors.official_pdf_url[0]}
                  </p>
                )}
              </div>

              {/* Apply Online URL */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Online Application Portal URL
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="url"
                    value={applyOnlineUrl}
                    onChange={(e) => setApplyOnlineUrl(e.target.value)}
                    placeholder="https://upsconline.nic.in"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                    data-testid="field-apply-url"
                  />
                </div>
                {fieldErrors.apply_online_url && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {fieldErrors.apply_online_url[0]}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Link
            href="/admin/notifications"
            className="px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            data-testid="submit-notification-btn"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>
              {isPending
                ? "Saving Notification..."
                : mode === "create"
                ? "Create Notification"
                : "Save Changes"}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
