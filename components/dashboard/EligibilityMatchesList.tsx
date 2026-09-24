"use client";

/**
 * @file components/dashboard/EligibilityMatchesList.tsx
 * @description Candidate Smart Eligibility Matching Interface.
 * Displays calculated matches, score breakdown by dimension (age, qualification, state, deadline),
 * filter/sort controls, and qualification preferences configuration.
 *
 * Enhancement: ENH-0009 (Smart Eligibility Matching Engine)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-003 (RBAC)
 */

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Target,
  Sparkles,
  Search,
  SlidersHorizontal,
  Calendar,
  Send,
  GraduationCap,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Settings2,
  Check,
  Award,
} from "lucide-react";
import type { EligibilityResult, EligibilityDimension } from "@/lib/matching/eligibility-engine";
import type { EligibilityPreferencesInput } from "@/lib/schemas/eligibility-matching";
import { saveEligibilityPreferences } from "@/app/dashboard/eligibility/actions";

const AVAILABLE_QUALIFICATIONS = [
  "8th",
  "10th",
  "12th",
  "ITI",
  "Diploma",
  "Graduate",
  "Post Graduate",
  "Engineering",
  "Medical",
  "Law",
  "PhD",
] as const;

interface EligibilityMatchesListProps {
  initialResults: EligibilityResult[];
  initialPreferences?: EligibilityPreferencesInput;
  profileCompleteness: number;
  totalEligible: number;
}

export default function EligibilityMatchesList({
  initialResults,
  initialPreferences,
  profileCompleteness,
  totalEligible,
}: EligibilityMatchesListProps) {
  const [results] = useState<EligibilityResult[]>(initialResults);
  const [searchQuery, setSearchQuery] = useState("");
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [sortBy, setSortBy] = useState<"score" | "deadline">("score");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  // Preference form state
  const [selectedQualifications, setSelectedQualifications] = useState<string[]>(
    initialPreferences?.qualifications || ["Graduate"]
  );
  const [includeAllIndia, setIncludeAllIndia] = useState<boolean>(
    initialPreferences?.includeAllIndiaExams ?? true
  );
  const [includeState, setIncludeState] = useState<boolean>(
    initialPreferences?.includeStateExams ?? true
  );
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleQualification = (qual: string) => {
    setSelectedQualifications((prev) =>
      prev.includes(qual) ? prev.filter((q) => q !== qual) : [...prev, qual]
    );
  };

  const handleSavePreferences = () => {
    if (selectedQualifications.length === 0) {
      setSaveStatus("Select at least one qualification");
      return;
    }

    startSaveTransition(async () => {
      setSaveStatus(null);
      const res = await saveEligibilityPreferences({
        qualifications: selectedQualifications as any,
        includeAllIndiaExams: includeAllIndia,
        includeStateExams: includeState,
        preferredCategories: initialPreferences?.preferredCategories || [],
        showExpiringSoonOnly: false,
      });

      if (res.success) {
        setSaveStatus("Preferences updated! Refreshing matches...");
        setTimeout(() => {
          setIsPreferencesOpen(false);
          setSaveStatus(null);
          window.location.reload();
        }, 1000);
      } else {
        setSaveStatus(res.error || "Failed to update preferences");
      }
    });
  };

  // Filter and sort
  const filteredResults = results
    .filter((r) => {
      const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesScore = r.overallScore >= minScoreFilter;
      return matchesSearch && matchesScore;
    })
    .sort((a, b) => {
      if (sortBy === "deadline") return a.daysUntilDeadline - b.daysUntilDeadline;
      return b.overallScore - a.overallScore;
    });

  const getDimensionIcon = (name: EligibilityDimension["name"]) => {
    switch (name) {
      case "age":
        return <Calendar className="w-3.5 h-3.5" />;
      case "qualification":
        return <GraduationCap className="w-3.5 h-3.5" />;
      case "state":
        return <MapPin className="w-3.5 h-3.5" />;
      case "deadline":
        return <Clock className="w-3.5 h-3.5" />;
    }
  };

  const getStatusBadge = (status: EligibilityDimension["status"]) => {
    switch (status) {
      case "eligible":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
            <CheckCircle2 className="w-3 h-3" /> Eligible
          </span>
        );
      case "ineligible":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md">
            <XCircle className="w-3 h-3" /> Ineligible
          </span>
        );
      case "expiring":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md">
            <AlertTriangle className="w-3 h-3" /> Ending Soon
          </span>
        );
      case "unknown":
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
            <HelpCircle className="w-3 h-3" /> Incomplete
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI & Profile Readiness Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Total Eligible */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200/60 dark:border-emerald-800/40">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                Eligible Government Exams
              </p>
              <h3 className="text-2xl font-black text-emerald-950 dark:text-emerald-100 mt-0.5">
                {totalEligible}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-2">
            Based on your age, category relaxation & qualifications
          </p>
        </div>

        {/* Metric 2: Profile Match Accuracy */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-200/60 dark:border-blue-800/40">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                Match Profile Accuracy
              </p>
              <h3 className="text-2xl font-black text-blue-950 dark:text-blue-100 mt-0.5">
                {profileCompleteness}%
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="w-full bg-blue-200/50 dark:bg-blue-900/50 rounded-full h-1.5 mt-3">
            <div
              className="bg-blue-600 dark:bg-blue-400 h-1.5 rounded-full transition-all"
              style={{ width: `${profileCompleteness}%` }}
            />
          </div>
        </div>

        {/* Metric 3: Quick Preferences */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Active Qualifications
              </p>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {selectedQualifications.length} selected
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
              {selectedQualifications.join(", ") || "None selected"}
            </p>
          </div>
          <button
            onClick={() => setIsPreferencesOpen(!isPreferencesOpen)}
            className="mt-3 flex items-center justify-center gap-1.5 w-full py-1.5 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            {isPreferencesOpen ? "Close Settings" : "Configure Qualifications"}
          </button>
        </div>
      </div>

      {/* Preferences Configuration Drawer / Section */}
      {isPreferencesOpen && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/60 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Configure Eligibility Preferences
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Select all qualifications you hold. The engine uses qualification hierarchy to match higher tiers.
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
              Select Your Completed Education / Qualifications:
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_QUALIFICATIONS.map((q) => {
                const isSelected = selectedQualifications.includes(q);
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => toggleQualification(q)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    {q}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeAllIndia}
                onChange={(e) => setIncludeAllIndia(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Include Central / All-India Exams
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeState}
                onChange={(e) => setIncludeState(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Include Domicile State Exams
            </label>
          </div>

          {saveStatus && (
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
              {saveStatus}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsPreferencesOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSavePreferences}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Preferences & Recalculate"}
            </button>
          </div>
        </div>
      )}

      {/* Telegram Alert Notification Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-950/40 dark:to-indigo-950/30 border border-sky-200/80 dark:border-sky-800/60 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
            <Send className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-sky-950 dark:text-sky-100">
              Instant Telegram Eligibility Alerts
            </p>
            <p className="text-[11px] text-sky-800/80 dark:text-sky-300">
              Get direct alerts on your phone the moment new notifications matching your profile are published.
            </p>
          </div>
        </div>
        <Link
          href="/preferences"
          className="self-start sm:self-auto px-3.5 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-200 bg-white dark:bg-slate-900 hover:bg-sky-100 dark:hover:bg-slate-800 border border-sky-300/80 dark:border-sky-700 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
        >
          <span>Connect Telegram</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search matching exams by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-900 dark:text-white placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Minimum Score Filter */}
          <select
            value={minScoreFilter}
            onChange={(e) => setMinScoreFilter(Number(e.target.value))}
            className="px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value={0}>All Matches (0%+)</option>
            <option value={50}>Eligible Only (50%+)</option>
            <option value={80}>High Fit (80%+)</option>
            <option value={100}>Perfect 100% Fit</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="score">Sort by Match Score</option>
            <option value="deadline">Sort by Deadline Soonest</option>
          </select>
        </div>
      </div>

      {/* Results Listing */}
      {filteredResults.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Target className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            No Exam Matches Found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            No active exams match your currently selected score filter or search terms. Try lowering the match threshold or adding more qualifications.
          </p>
          <button
            onClick={() => {
              setMinScoreFilter(0);
              setSearchQuery("");
            }}
            className="px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredResults.map((result) => {
            const isExpanded = expandedCards[result.notificationId];
            const scoreColor =
              result.overallScore >= 80
                ? "bg-emerald-500"
                : result.overallScore >= 50
                ? "bg-blue-500"
                : "bg-amber-500";

            return (
              <div
                key={result.notificationId}
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Title & Overview */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[11px] font-bold text-white px-2 py-0.5 rounded-full ${scoreColor}`}
                      >
                        {result.overallScore}% Match
                      </span>
                      {result.isEligible ? (
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                          Eligible to Apply
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md">
                          Review Requirements
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {result.daysUntilDeadline > 0
                          ? `${result.daysUntilDeadline} days left`
                          : "Deadline passed"}
                      </span>
                    </div>

                    <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      {result.title}
                    </h4>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <button
                      onClick={() => toggleExpand(result.notificationId)}
                      className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-1 transition-colors"
                      aria-label="Toggle criteria breakdown"
                    >
                      <span>Criteria</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <Link
                      href={`/notification/${result.slug}`}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                      <span>View & Apply</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>

                {/* Dimension Breakdown Bar (Always summary view) */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {result.dimensions.map((dim) => (
                    <div
                      key={dim.name}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60"
                    >
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 capitalize">
                        {getDimensionIcon(dim.name)}
                        <span className="text-[11px] font-medium">{dim.name}</span>
                      </div>
                      {getStatusBadge(dim.status)}
                    </div>
                  ))}
                </div>

                {/* Expanded Detailed Explanations */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Eligibility Evaluation Breakdown:
                    </p>
                    <div className="space-y-1.5">
                      {result.dimensions.map((dim) => (
                        <div
                          key={dim.name}
                          className="flex items-start gap-2 text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40"
                        >
                          <div className="mt-0.5 text-slate-500">{getDimensionIcon(dim.name)}</div>
                          <div className="flex-1">
                            <span className="font-semibold capitalize text-slate-900 dark:text-white mr-1.5">
                              {dim.name}:
                            </span>
                            <span className="text-slate-600 dark:text-slate-400">
                              {dim.detail}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
