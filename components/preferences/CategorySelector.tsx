/**
 * @file components/preferences/CategorySelector.tsx
 * @module CategorySelector
 * @description Interactive multi-select category chips and cards component for candidate
 * alert subscriptions. Allows toggling competitive exam categories with visual feedback.
 * 
 * Task ID: TASK-05010101 (Subtask: SUB-0501010101)
 * Architecture Reference: ADR-001 (Frontend Component), ADR-007 (Omnichannel Alert Preferences)
 * 
 * Complies with:
 * - TypeScript strict mode (Zero `any`)
 * - WCAG 2.1 AA accessible button toggles (`aria-pressed`, keyboard navigation)
 * - Mobile responsive responsive grid
 * - Quick batch actions: "Select All" & "Clear All"
 */

"use client";

import React from "react";
import { Check, Landmark, GraduationCap, Train, Shield, Briefcase, Award, ShieldAlert, Sparkles } from "lucide-react";
import type { ExamCategoryEnum } from "@/types/database.types";

interface CategoryMeta {
  id: ExamCategoryEnum;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CATEGORY_DEFINITIONS: CategoryMeta[] = [
  {
    id: "civil_services",
    label: "Civil Services (UPSC & Central)",
    shortLabel: "Civil Services",
    description: "IAS, IPS, IFS, CDS, and Central Staff exams",
    icon: Landmark,
  },
  {
    id: "state_psc",
    label: "State PSC Examinations",
    shortLabel: "State PSC",
    description: "KPSC, MPSC, UPPSC, TNPSC, and State Administrative",
    icon: Award,
  },
  {
    id: "banking",
    label: "Banking & Financial Institutions",
    shortLabel: "Banking & IBPS",
    description: "IBPS PO/Clerk, SBI, RBI, and NABARD recruits",
    icon: Briefcase,
  },
  {
    id: "railways",
    label: "Railways Recruitment Boards",
    shortLabel: "Railways (RRB)",
    description: "RRB NTPC, Group D, ALP, and Technical posts",
    icon: Train,
  },
  {
    id: "defense",
    label: "Defence, Paramilitary & Police",
    shortLabel: "Defence & Police",
    description: "NDA, CDS, AFCAT, CAPF, and State Police Forces",
    icon: Shield,
  },
  {
    id: "teaching",
    label: "Teaching & Faculty Posts",
    shortLabel: "Teaching & UGC",
    description: "CTET, UGC NET, KVS, NVS, and University Faculty",
    icon: GraduationCap,
  },
  {
    id: "police",
    label: "Police & Law Enforcement",
    shortLabel: "Police & Security",
    description: "Sub-Inspector, Constable, and Intelligence bureaus",
    icon: ShieldAlert,
  },
  {
    id: "other",
    label: "Other Engineering & Scientific",
    shortLabel: "Other Recruitment",
    description: "ISRO, DRDO, BARC, SSC CGL/CHSL, and PSUs",
    icon: Sparkles,
  },
];

interface CategorySelectorProps {
  selectedCategories: ExamCategoryEnum[];
  onChange: (categories: ExamCategoryEnum[]) => void;
  error?: string;
}

export default function CategorySelector({
  selectedCategories,
  onChange,
  error,
}: CategorySelectorProps) {
  const isAllSelected = selectedCategories.length === CATEGORY_DEFINITIONS.length;

  const toggleCategory = (catId: ExamCategoryEnum) => {
    if (selectedCategories.includes(catId)) {
      onChange(selectedCategories.filter((id) => id !== catId));
    } else {
      onChange([...selectedCategories, catId]);
    }
  };

  const selectAll = () => {
    onChange(CATEGORY_DEFINITIONS.map((c) => c.id));
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className="space-y-4" data-testid="category-selector-container">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <span>Target Exam Categories</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {selectedCategories.length} selected
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Select the categories you are actively preparing for to filter instant alerts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline px-2 py-1 rounded transition-colors"
          >
            Select All
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium text-gray-600 hover:text-gray-800 hover:underline px-2 py-1 rounded transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 font-medium" role="alert">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {CATEGORY_DEFINITIONS.map((category) => {
          const isSelected = selectedCategories.includes(category.id);
          const Icon = category.icon;

          return (
            <button
              key={category.id}
              type="button"
              id={`cat-chip-${category.id}`}
              onClick={() => toggleCategory(category.id)}
              aria-pressed={isSelected}
              className={`relative flex items-start p-3.5 rounded-xl border text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                isSelected
                  ? "border-blue-600 bg-blue-50/70 text-blue-900 shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/60 text-gray-800"
              }`}
            >
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
                  isSelected
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 group-hover:bg-gray-200"
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0 pr-5">
                <div className="text-sm font-semibold truncate leading-tight">
                  {category.shortLabel}
                </div>
                <div className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                  {category.description}
                </div>
              </div>

              <div
                className={`absolute top-3 right-3 w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                  isSelected
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-gray-300 bg-white"
                }`}
              >
                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
