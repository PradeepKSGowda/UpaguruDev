/**
 * @file components/preferences/StateSelector.tsx
 * @module StateSelector
 * @description Searchable multi-select component for Indian States, Central regions, and Union Territories.
 * Allows candidates to define geographic jurisdiction filters for their push alerts.
 * 
 * Task ID: TASK-05010101 (Subtask: SUB-0501010101)
 * Architecture Reference: ADR-001 (Frontend Component), ADR-007 (Omnichannel Alert Preferences)
 * 
 * Complies with:
 * - TypeScript strict mode (Zero `any`)
 * - Searchable real-time filtering with instant keyboard response
 * - Tag chips with removal handles for selected states
 * - Mobile responsive collapsible selection drawer
 */

"use client";

import React, { useState, useMemo } from "react";
import { Search, MapPin, X, Check, Globe } from "lucide-react";
import { INDIAN_STATES_AND_REGIONS } from "@/lib/constants";

interface StateSelectorProps {
  selectedStates: string[];
  onChange: (states: string[]) => void;
  error?: string;
}

const POPULAR_SHORTCUTS = [
  { label: "Central (All-India)", value: "Central" },
  { label: "Karnataka", value: "Karnataka" },
  { label: "Maharashtra", value: "Maharashtra" },
  { label: "Uttar Pradesh", value: "Uttar Pradesh" },
  { label: "Delhi", value: "Delhi" },
  { label: "Tamil Nadu", value: "Tamil Nadu" },
];

export default function StateSelector({
  selectedStates,
  onChange,
  error,
}: StateSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Filtered list based on real-time query
  const filteredStates = useMemo(() => {
    if (!searchTerm.trim()) return INDIAN_STATES_AND_REGIONS;
    const term = searchTerm.toLowerCase();
    return INDIAN_STATES_AND_REGIONS.filter((state) =>
      state.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const toggleState = (stateName: string) => {
    if (selectedStates.includes(stateName)) {
      onChange(selectedStates.filter((s) => s !== stateName));
    } else {
      onChange([...selectedStates, stateName]);
    }
  };

  const removeState = (stateName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedStates.filter((s) => s !== stateName));
  };

  const selectAll = () => {
    onChange([...INDIAN_STATES_AND_REGIONS]);
  };

  const clearAll = () => {
    onChange([]);
  };

  const selectCentralOnly = () => {
    onChange(["Central"]);
  };

  return (
    <div className="space-y-4" data-testid="state-selector-container">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <span>State & Regional Jurisdictions</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
              {selectedStates.length} selected
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Choose your preferred states/UTs or &apos;Central&apos; for pan-India exam recruitment notices.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectCentralOnly}
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline px-1.5 py-1 rounded transition-colors"
          >
            Central Only
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={selectAll}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline px-1.5 py-1 rounded transition-colors"
          >
            All States
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium text-gray-600 hover:text-gray-800 hover:underline px-1.5 py-1 rounded transition-colors"
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

      {/* Selected State Badges */}
      {selectedStates.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2.5 bg-gray-50 rounded-xl border border-gray-200">
          {selectedStates.map((state) => (
            <span
              key={`selected-tag-${state}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white text-gray-800 border border-gray-200 shadow-2xs"
            >
              <MapPin className="w-3 h-3 text-emerald-600" />
              <span>{state}</span>
              <button
                type="button"
                onClick={(e) => removeState(state, e)}
                className="text-gray-400 hover:text-red-500 rounded p-0.5 transition-colors focus:outline-none"
                aria-label={`Remove ${state}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Quick shortcuts */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs text-gray-600">
        <span className="font-medium text-gray-500 flex-shrink-0 flex items-center gap-1">
          <Globe className="w-3 h-3" /> Quick:
        </span>
        {POPULAR_SHORTCUTS.map((item) => {
          const isSelected = selectedStates.includes(item.value);
          return (
            <button
              key={`shortcut-${item.value}`}
              type="button"
              onClick={() => toggleState(item.value)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                isSelected
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {isSelected ? "✓ " : "+ "}
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search states, union territories, central..."
          className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* States Grid */}
      <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-xl bg-white p-2 divide-y divide-gray-100 shadow-inner">
        {filteredStates.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-500">
            No Indian states or regions matching &quot;{searchTerm}&quot;.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 p-1">
            {filteredStates.map((state) => {
              const isSelected = selectedStates.includes(state);
              return (
                <button
                  key={`state-btn-${state}`}
                  type="button"
                  onClick={() => toggleState(state)}
                  aria-pressed={isSelected}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors ${
                    isSelected
                      ? "bg-emerald-50 text-emerald-900 font-semibold"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="truncate pr-1">{state}</span>
                  {isSelected ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <span className="w-3.5 h-3.5 rounded border border-gray-300 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
