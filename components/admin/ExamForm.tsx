"use client";

/**
 * @file components/admin/ExamForm.tsx
 * @description Administrative form for creating and updating examination series with live slug
 * generation, Zod inline error handling, and server action submission.
 * 
 * Task ID: TASK-03030101 (Subtask: SUB-0303010102)
 * Architecture Reference: ADR-001 (Frontend Architecture), ADR-002 (Database)
 */

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Globe,
  Building2,
  MapPin,
  Tag,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  RotateCcw,
} from "lucide-react";
import { EXAM_CATEGORIES, ExamCategory, examInputSchema } from "@/lib/schemas/exams";
import { createExamAction, updateExamAction } from "@/app/admin/exams/actions";
import { AdminExamListItem } from "@/lib/data/exams";

export interface ExamFormProps {
  initialData?: AdminExamListItem | null;
  mode: "create" | "edit";
}

const CATEGORY_LABELS: Record<string, string> = {
  civil_services: "Civil Services",
  banking: "Banking & Finance",
  railways: "Railways",
  defense: "Defense",
  state_psc: "State PSC",
  teaching: "Teaching",
  police: "Police",
  other: "Other",
};

const COMMON_STATES = [
  "Central",
  "Karnataka",
  "Maharashtra",
  "Tamil Nadu",
  "Uttar Pradesh",
  "Bihar",
  "Kerala",
  "Rajasthan",
  "Madhya Pradesh",
  "West Bengal",
  "Andhra Pradesh",
  "Telangana",
  "Delhi",
  "Gujarat",
  "Punjab",
  "Haryana",
  "Odisha",
  "Assam",
  "Jharkhand",
];

export default function ExamForm({ initialData, mode }: ExamFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState(initialData?.title || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [slugCustomized, setSlugCustomized] = useState(Boolean(initialData?.slug));
  const [conductingBody, setConductingBody] = useState(initialData?.conducting_body || "");
  const [category, setCategory] = useState<ExamCategory>(
    (initialData?.category as ExamCategory) || "civil_services"
  );
  const [stateOrCentral, setStateOrCentral] = useState(initialData?.state_or_central || "Central");
  const [officialWebsite, setOfficialWebsite] = useState(initialData?.official_website || "");
  const [logoUrl, setLogoUrl] = useState(initialData?.logo_url || "");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Helper to generate URL-safe slug from title
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

    const payload = {
      title,
      slug,
      conducting_body: conductingBody,
      category,
      state_or_central: stateOrCentral,
      official_website: officialWebsite,
      logo_url: logoUrl.trim() ? logoUrl : null,
    };

    // Client-side Zod validation
    const clientValidation = examInputSchema.safeParse(payload);
    if (!clientValidation.success) {
      setFieldErrors(clientValidation.error.flatten().fieldErrors);
      setFormError("Please fix the validation errors below.");
      return;
    }

    startTransition(async () => {
      if (mode === "create") {
        const res = await createExamAction(payload);
        if (res.success) {
          setSuccessMessage("Exam created successfully! Redirecting to list...");
          setTimeout(() => {
            router.push("/admin/exams");
            router.refresh();
          }, 800);
        } else {
          setFormError(res.error || "Failed to create exam");
          if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        }
      } else if (mode === "edit" && initialData?.id) {
        const res = await updateExamAction(initialData.id, payload);
        if (res.success) {
          setSuccessMessage("Exam updated successfully! Redirecting to list...");
          setTimeout(() => {
            router.push("/admin/exams");
            router.refresh();
          }, 800);
        } else {
          setFormError(res.error || "Failed to update exam");
          if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        }
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="exam-form-container">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/exams"
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {mode === "create" ? "Create New Examination Series" : `Edit Examination: ${initialData?.title}`}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {mode === "create"
                ? "Register a new master competitive examination for notification linking"
                : "Update conducting agency, category tags, or official portal URLs"}
            </p>
          </div>
        </div>
      </div>

      {/* Main Form Card */}
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 sm:p-8 space-y-6"
        data-testid="exam-form"
      >
        {/* Alerts */}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Exam Title */}
          <div className="sm:col-span-2 space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
              Exam Title <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={title}
                onChange={handleTitleChange}
                placeholder="e.g. UPSC Civil Services Examination 2026"
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                data-testid="field-title"
                required
              />
            </div>
            {fieldErrors.title && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.title[0]}</p>
            )}
          </div>

          {/* URL Slug */}
          <div className="sm:col-span-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                URL Slug <span className="text-red-500">*</span>
              </label>
              {slugCustomized && (
                <button
                  type="button"
                  onClick={handleResetSlug}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  Auto-sync from title
                </button>
              )}
            </div>
            <div className="flex rounded-lg shadow-sm">
              <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-mono">
                /exams/
              </span>
              <input
                type="text"
                value={slug}
                onChange={handleSlugChange}
                placeholder="upsc-civil-services-2026"
                className="flex-1 px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-r-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                data-testid="field-slug"
                required
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Lowercase alphanumeric characters and hyphens only. Used in canonical URLs.
            </p>
            {fieldErrors.slug && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.slug[0]}</p>
            )}
          </div>

          {/* Conducting Body */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
              Conducting Body <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={conductingBody}
                onChange={(e) => setConductingBody(e.target.value)}
                placeholder="e.g. UPSC, KPSC, SSC, IBPS"
                className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                data-testid="field-conducting-body"
                required
              />
            </div>
            {fieldErrors.conducting_body && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {fieldErrors.conducting_body[0]}
              </p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
              Exam Category <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExamCategory)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 font-medium"
                data-testid="field-category"
              >
                {EXAM_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat] || cat}
                  </option>
                ))}
              </select>
            </div>
            {fieldErrors.category && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {fieldErrors.category[0]}
              </p>
            )}
          </div>

          {/* State or Central */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
              State / Central Jurisdiction <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                list="state-options"
                value={stateOrCentral}
                onChange={(e) => setStateOrCentral(e.target.value)}
                placeholder="e.g. Central or Karnataka"
                className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                data-testid="field-state-central"
                required
              />
              <datalist id="state-options">
                {COMMON_STATES.map((st) => (
                  <option key={st} value={st} />
                ))}
              </datalist>
            </div>
            {fieldErrors.state_or_central && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {fieldErrors.state_or_central[0]}
              </p>
            )}
          </div>

          {/* Official Website */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
              Official Portal URL <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="url"
                value={officialWebsite}
                onChange={(e) => setOfficialWebsite(e.target.value)}
                placeholder="https://upsc.gov.in"
                className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                data-testid="field-official-website"
                required
              />
            </div>
            {fieldErrors.official_website && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {fieldErrors.official_website[0]}
              </p>
            )}
          </div>

          {/* Optional Logo URL */}
          <div className="sm:col-span-2 space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
              Logo / Crest Image URL <span className="text-xs font-normal text-gray-400">(Optional)</span>
            </label>
            <div className="relative">
              <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://images.upaguru.in/logos/upsc.png"
                className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                data-testid="field-logo-url"
              />
            </div>
            {fieldErrors.logo_url && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {fieldErrors.logo_url[0]}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Link
            href="/admin/exams"
            className="px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            data-testid="submit-exam-btn"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isPending ? "Saving Exam..." : mode === "create" ? "Create Exam" : "Save Changes"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
