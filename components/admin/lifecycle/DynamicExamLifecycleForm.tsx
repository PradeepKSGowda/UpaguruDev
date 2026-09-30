"use client";

/**
 * @file components/admin/lifecycle/DynamicExamLifecycleForm.tsx
 * @description Dynamic Examination Lifecycle Form Engine implementing the 11-step
 * official update workflow across UPSC, KPSC, SSC, RRB, IBPS.
 * 
 * Features:
 * - Master Notification Taxonomy with category grouping and search
 * - Cascading Organization -> Exam Master -> Exam Cycle -> Stage selectors
 * - Organization isolation with strict backend validation
 * - Dynamic field rendering: displays ONLY fields relevant to the chosen notification type
 * - Conditional field toggles (e.g. objection window, new date available, cut-off available)
 * - Live Candidate Timeline preview before publication
 * - Direct publishing to Exam Cycle with non-destructive event versioning and audit trail
 */

import React, { useState, useEffect, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Building2,
  Eye,
  FileText,
  Search,
} from "lucide-react";
import {
  NOTIFICATION_TAXONOMY,
  NotificationTypeMeta,
  getNotificationTypeMeta,
  getStagesForOrganization,
  StageDefinitionMeta,
} from "@/lib/lifecycle/taxonomy";
import {
  getFormFieldsForType,
  DynamicFormFieldConfig,
  validateDynamicLifecycleForm,
} from "@/lib/lifecycle/dynamic-form-engine";
import {
  getOrganizationsAction,
  getExamsByOrganizationAction,
  getCyclesByExamAction,
  getEventsByCycleAction,
  publishLifecycleUpdateAction,
  OrganizationOption,
  ExamMasterOption,
  ExamCycleOption,
} from "@/app/admin/exams/lifecycle-actions";

export default function DynamicExamLifecycleForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Step 1: Notification Type
  const [selectedTypeCode, setSelectedTypeCode] = useState<string>("APPLICATION_EXTENSION");
  const [taxonomySearch, setTaxonomySearch] = useState<string>("");

  // Step 2, 3, 4: Cascading Selectors
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");

  const [exams, setExams] = useState<ExamMasterOption[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");

  const [cycles, setCycles] = useState<ExamCycleOption[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>("");

  // Step 5: Stage & Existing Event
  const [stages, setStages] = useState<StageDefinitionMeta[]>([]);
  const [selectedStageCode, setSelectedStageCode] = useState<string>("");
  const [existingEvents, setExistingEvents] = useState<Array<{ id: string; event_name: string; date_text_original: string; status: string }>>([]);
  const [targetEventId, setTargetEventId] = useState<string>("");

  // Step 6 & 7: Dynamic Field Values & Errors
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({
    new_date_available: true,
    objection_window_available: true,
    cut_off_available: true,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Step 8: Preview Mode
  const [showPreview, setShowPreview] = useState<boolean>(false);

  // Current metadata for chosen notification type
  const typeMeta: NotificationTypeMeta = useMemo(() => {
    return getNotificationTypeMeta(selectedTypeCode);
  }, [selectedTypeCode]);

  // Selected entities summary
  const selectedOrg = organizations.find((o) => o.id === selectedOrgId);
  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const selectedCycle = cycles.find((c) => c.id === selectedCycleId);

  // 1. Initial Load: Organizations
  useEffect(() => {
    getOrganizationsAction().then((res) => {
      if (res.success && res.data) {
        setOrganizations(res.data);
        if (res.data.length > 0 && res.data[0]) {
          setSelectedOrgId(res.data[0].id);
        }
      }
    });
  }, []);

  // 2. Cascade: Org -> Exams & Stages
  useEffect(() => {
    if (!selectedOrgId) {
      setExams([]);
      setSelectedExamId("");
      return;
    }
    const currentOrg = organizations.find((o) => o.id === selectedOrgId);
    setStages(getStagesForOrganization(currentOrg?.code));

    getExamsByOrganizationAction(selectedOrgId).then((res) => {
      if (res.success && res.data) {
        setExams(res.data);
        setSelectedExamId(res.data[0]?.id || "");
      }
    });
  }, [selectedOrgId, organizations]);

  // 3. Cascade: Exam -> Cycles
  useEffect(() => {
    if (!selectedExamId) {
      setCycles([]);
      setSelectedCycleId("");
      return;
    }
    getCyclesByExamAction(selectedExamId).then((res) => {
      if (res.success && res.data) {
        setCycles(res.data);
        setSelectedCycleId(res.data[0]?.id || "");
      }
    });
  }, [selectedExamId]);

  // 4. Cascade: Cycle -> Existing Events & Prepopulate
  useEffect(() => {
    if (!selectedCycleId) {
      setExistingEvents([]);
      return;
    }
    const cycle = cycles.find((c) => c.id === selectedCycleId);
    if (cycle) {
      // Pre-fill original dates for Application Extension
      if (cycle.end_date) {
        setFieldValues((prev) => ({
          ...prev,
          original_closing_date: prev.original_closing_date || cycle.end_date,
        }));
      }
      if (cycle.total_vacancies_current) {
        setFieldValues((prev) => ({
          ...prev,
          previous_vacancies: prev.previous_vacancies || cycle.total_vacancies_current,
        }));
      }
    }

    getEventsByCycleAction(selectedCycleId).then((res) => {
      if (res.success && res.data) {
        setExistingEvents(res.data);
      }
    });
  }, [selectedCycleId, cycles]);

  // Dynamic field definitions for the current type
  const dynamicFields: DynamicFormFieldConfig[] = useMemo(() => {
    return getFormFieldsForType(selectedTypeCode);
  }, [selectedTypeCode]);

  // Handle generic field change
  const handleFieldValueChange = (fieldName: string, value: any) => {
    setFieldValues((prev) => ({ ...prev, [fieldName]: value }));
    if (fieldErrors[fieldName]) {
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated[fieldName];
        return updated;
      });
    }
  };

  // Filter taxonomy for search
  const filteredTaxonomy = useMemo(() => {
    const list = Object.values(NOTIFICATION_TAXONOMY);
    if (!taxonomySearch.trim()) return list;
    const q = taxonomySearch.toLowerCase();
    return list.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q)
    );
  }, [taxonomySearch]);

  // Submit Handler (Step 11: Publish)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setSuccessMessage(null);

    // Validation
    const validation = validateDynamicLifecycleForm({
      notificationTypeCode: selectedTypeCode,
      organizationCode: selectedOrg?.code || "",
      examMasterId: selectedExamId,
      examCycleId: selectedCycleId,
      stageCode: selectedStageCode,
      values: fieldValues,
      originalCycleData: {
        application_end_date: selectedCycle?.end_date,
        exam_date: selectedCycle?.start_date,
        total_vacancies: selectedCycle?.total_vacancies_current,
      },
    });

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      setGeneralError("Please resolve the highlighted validation errors.");
      return;
    }

    startTransition(async () => {
      const response = await publishLifecycleUpdateAction({
        notificationTypeCode: selectedTypeCode,
        organizationId: selectedOrgId,
        examMasterId: selectedExamId,
        examCycleId: selectedCycleId,
        stageCode: selectedStageCode || null,
        targetEventId: targetEventId || null,
        values: fieldValues,
      });

      if (!response.success) {
        setGeneralError(response.error || "Failed to publish update.");
        if (response.fieldErrors) setFieldErrors(response.fieldErrors);
      } else {
        setSuccessMessage(response.message || "Notification published and timeline updated successfully!");
        setTimeout(() => {
          router.push("/admin/review-queue");
        }, 2000);
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Top Banner Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Dynamic Lifecycle Engine
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Add Examination Lifecycle Update
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Connect official circulars, admit cards, deadline extensions, and results directly to canonical Exam Cycles.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition"
          >
            <Eye className="w-4 h-4 text-cyan-400" />
            {showPreview ? "Hide Live Preview" : "Show Candidate Preview"}
          </button>
        </div>
      </div>

      {generalError && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Action Blocked: </span>
            {generalError}
          </div>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ========================================================================= */}
        {/* STEP 1: What type of notification is this? */}
        {/* ========================================================================= */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold">1</span>
              <h2 className="text-base font-bold text-white">What type of notification / update is this?</h2>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search taxonomy..."
                value={taxonomySearch}
                onChange={(e) => setTaxonomySearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto pr-1">
            {filteredTaxonomy.map((item) => {
              const isSelected = item.code === selectedTypeCode;
              return (
                <button
                  type="button"
                  key={item.code}
                  onClick={() => {
                    setSelectedTypeCode(item.code);
                    setFieldErrors({});
                  }}
                  className={`text-left p-3 rounded-xl border transition flex flex-col justify-between ${
                    isSelected
                      ? "bg-indigo-600/15 border-indigo-500 text-white shadow-lg shadow-indigo-500/10"
                      : "bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold leading-snug">{item.label}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide ${
                        item.operationType === "CREATE"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      }`}
                    >
                      {item.operationType}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 line-clamp-1">{item.description}</span>
                </button>
              );
            })}
          </div>

          {typeMeta && (
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Selected: <strong className="text-white">{typeMeta.label}</strong> ({typeMeta.category})
              </span>
              <span className="text-slate-400">
                Mode: <span className="text-indigo-400 font-semibold">{typeMeta.operationType === "CREATE" ? "New Examination Series" : "Lifecycle Milestone on Existing Exam"}</span>
              </span>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* STEP 2, 3, 4: Cascading Selectors with Organization Isolation */}
        {/* ========================================================================= */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold">2-4</span>
            <h2 className="text-base font-bold text-white">Target Examination Cycle</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 2: Organization */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Step 2: Conducting Organization <span className="text-rose-400">*</span>
              </label>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.code} — {org.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500">Restricts exams to this commission.</p>
            </div>

            {/* Step 3: Exam Master */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Step 3: Examination Series <span className="text-rose-400">*</span>
              </label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                disabled={exams.length === 0}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              >
                {exams.length === 0 ? (
                  <option value="">No active exams found for {selectedOrg?.code}</option>
                ) : (
                  exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} ({ex.exam_code})
                    </option>
                  ))
                )}
              </select>
              <p className="text-[11px] text-slate-500">Canonical exam identity.</p>
            </div>

            {/* Step 4: Exam Cycle */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Step 4: Examination Cycle / Year <span className="text-rose-400">*</span>
              </label>
              <select
                value={selectedCycleId}
                onChange={(e) => setSelectedCycleId(e.target.value)}
                disabled={cycles.length === 0}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              >
                {cycles.length === 0 ? (
                  <option value="">No cycle found</option>
                ) : (
                  cycles.map((cyc) => (
                    <option key={cyc.id} value={cyc.id}>
                      {cyc.cycle_year || cyc.cycle_code} — {cyc.cycle_label} ({cyc.status})
                    </option>
                  ))
                )}
              </select>
              {fieldErrors.examCycleId && (
                <p className="text-xs text-rose-400 mt-1">{fieldErrors.examCycleId}</p>
              )}
            </div>
          </div>

          {/* Section 29: Existing Exam Summary Card */}
          {selectedCycle && selectedExam && selectedOrg && (
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Organization</span>
                <span className="font-bold text-white flex items-center gap-1.5 mt-0.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  {selectedOrg.code} ({selectedOrg.short_name})
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Exam & Year</span>
                <span className="font-bold text-white block mt-0.5">
                  {selectedExam.name} - {selectedCycle.cycle_year || selectedCycle.cycle_code}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Current Status</span>
                <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {selectedCycle.status}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Current Application Window</span>
                <span className="text-slate-300 font-medium block mt-0.5">
                  {selectedCycle.end_date ? `Closes: ${selectedCycle.end_date}` : "Not Set"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* STEP 5: Affected Stage & Event (Only if applicable) */}
        {/* ========================================================================= */}
        {typeMeta.requiresStage && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold">5</span>
              <h2 className="text-base font-bold text-white">Which Stage or Event is affected?</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Select Applicable Stage <span className="text-rose-400">*</span>
                </label>
                <select
                  value={selectedStageCode}
                  onChange={(e) => setSelectedStageCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose Stage ({selectedOrg?.code}) --</option>
                  {stages.map((stg) => (
                    <option key={stg.stageCode} value={stg.stageCode}>
                      {stg.stageLabel}
                    </option>
                  ))}
                </select>
                {fieldErrors.stageCode && (
                  <p className="text-xs text-rose-400 mt-1">{fieldErrors.stageCode}</p>
                )}
              </div>

              {/* Existing event rescheduling */}
              {existingEvents.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    Reschedule Existing Event? (Non-Destructive Supersession)
                  </label>
                  <select
                    value={targetEventId}
                    onChange={(e) => setTargetEventId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Create Fresh Event (Don't Supersede) --</option>
                    {existingEvents.map((evt) => (
                      <option key={evt.id} value={evt.id}>
                        {evt.event_name} (Current: {evt.date_text_original})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500">
                    Superseded events preserve history and audit trail automatically.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 6 & 7: Dynamic Form Engine (Display ONLY relevant fields!) */}
        {/* ========================================================================= */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold">6-7</span>
            <div>
              <h2 className="text-base font-bold text-white">{typeMeta.label} — Field Data</h2>
              <p className="text-xs text-slate-400">
                Tailored fields dynamically generated for {typeMeta.category}. Non-relevant fields are completely hidden.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {dynamicFields.map((field) => {
              // Conditional check
              if (
                field.conditionalOnField &&
                fieldValues[field.conditionalOnField] !== field.conditionalValue
              ) {
                return null;
              }

              const value = fieldValues[field.fieldName] ?? "";
              const error = fieldErrors[field.fieldName];

              if (field.fieldType === "boolean") {
                return (
                  <div key={field.fieldName} className="space-y-2 md:col-span-2 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
                    <label className="block text-xs font-semibold text-slate-300">
                      {field.fieldLabel} {field.isRequired && <span className="text-rose-400">*</span>}
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleFieldValueChange(field.fieldName, true)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition ${
                          value === true
                            ? "bg-indigo-600 text-white border-indigo-500"
                            : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"
                        }`}
                      >
                        YES
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFieldValueChange(field.fieldName, false)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition ${
                          value === false
                            ? "bg-rose-600 text-white border-rose-500"
                            : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"
                        }`}
                      >
                        NO
                      </button>
                    </div>
                    {field.helperText && <p className="text-[11px] text-slate-500">{field.helperText}</p>}
                  </div>
                );
              }

              if (field.fieldType === "select") {
                return (
                  <div key={field.fieldName} className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-300">
                      {field.fieldLabel} {field.isRequired && <span className="text-rose-400">*</span>}
                    </label>
                    <select
                      value={value}
                      onChange={(e) => handleFieldValueChange(field.fieldName, e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">-- {field.placeholder || "Select"} --</option>
                      {field.options?.map((opt: { label: string; value: string | number }) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
                    {field.helperText && <p className="text-[11px] text-slate-500">{field.helperText}</p>}
                  </div>
                );
              }

              if (field.fieldType === "textarea") {
                return (
                  <div key={field.fieldName} className="space-y-2 md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300">
                      {field.fieldLabel} {field.isRequired && <span className="text-rose-400">*</span>}
                    </label>
                    <textarea
                      rows={3}
                      value={value}
                      placeholder={field.placeholder}
                      onChange={(e) => handleFieldValueChange(field.fieldName, e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                    {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
                    {field.helperText && <p className="text-[11px] text-slate-500">{field.helperText}</p>}
                  </div>
                );
              }

              return (
                <div key={field.fieldName} className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    {field.fieldLabel} {field.isRequired && <span className="text-rose-400">*</span>}
                  </label>
                  <input
                    type={field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : "text"}
                    value={value}
                    placeholder={field.placeholder}
                    onChange={(e) => handleFieldValueChange(field.fieldName, e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                  {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
                  {field.helperText && <p className="text-[11px] text-slate-500">{field.helperText}</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* STEP 8: Live Candidate Timeline Preview */}
        {/* ========================================================================= */}
        {showPreview && (
          <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Eye className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-white">Live Candidate Timeline Preview</h2>
            </div>
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{selectedOrg?.code} • {selectedExam?.name}</span>
                <span className="font-mono text-cyan-400">Cycle {selectedCycle?.cycle_year || selectedCycle?.cycle_code}</span>
              </div>
              <div className="flex items-start gap-3 p-3 bg-slate-900 rounded-lg border border-slate-800">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 mt-1 animate-pulse" />
                <div>
                  <h4 className="text-sm font-bold text-white">{typeMeta.label}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {fieldValues.new_closing_date
                      ? `Application Deadline: Extended to ${fieldValues.new_closing_date}`
                      : fieldValues.exam_date
                      ? `Exam Date: ${fieldValues.exam_date}`
                      : fieldValues.release_date
                      ? `Published: ${fieldValues.release_date}`
                      : "Milestone Verified"}
                  </p>
                  {fieldValues.official_pdf_url && (
                    <a
                      href={fieldValues.official_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:underline mt-1"
                    >
                      <FileText className="w-3 h-3" />
                      View Official Document
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 9, 10, 11: Submit, Verify & Publish */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={() => router.push("/admin/review-queue")}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition"
          >
            Cancel & Return
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="submit"
              disabled={isPending}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 transition disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying & Publishing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Verify & Publish Update
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
