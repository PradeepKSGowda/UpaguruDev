"use client";

/**
 * @file components/admin/RawTextPanel.tsx
 * @description Scrollable monospace panel displaying OCR raw extracted text with in-text search,
 * copy-to-clipboard, character/word count statistics, and external source link.
 * 
 * Task ID: TASK-03020103 (Subtask: SUB-0302010301)
 * Architecture Reference: ADR-001 (Frontend Architecture)
 */

import React, { useState, useMemo } from "react";
import {
  Search,
  Copy,
  Check,
  ExternalLink,
  FileCode,
  AlertCircle,
} from "lucide-react";

export interface RawTextPanelProps {
  /** The raw OCR / web text extracted by the scraper */
  rawText: string | null;
  /** Direct link to the source document / notification PDF */
  sourceUrl: string;
  /** Extraction confidence score */
  confidenceScore: number;
}

export default function RawTextPanel({
  rawText,
  sourceUrl,
  confidenceScore,
}: RawTextPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const textContent = rawText || "";
  const charCount = textContent.length;
  const wordCount = useMemo(() => {
    return textContent.trim().length > 0
      ? textContent.trim().split(/\s+/).length
      : 0;
  }, [textContent]);

  const handleCopy = async () => {
    if (!textContent) return;
    try {
      await navigator.clipboard.writeText(textContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text to clipboard:", err);
    }
  };

  // Split and highlight search terms
  const renderedContent = useMemo(() => {
    if (!textContent) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
          <AlertCircle className="w-8 h-8 mb-2 opacity-60" />
          <p className="text-sm font-semibold">No Raw Text Available</p>
          <p className="text-xs max-w-xs mt-1 opacity-80">
            The scraper did not preserve raw textual content for this draft. Inspect the source document directly.
          </p>
        </div>
      );
    }

    if (!searchTerm.trim()) {
      return textContent;
    }

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = textContent.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark
          key={index}
          className="bg-amber-400 text-slate-950 font-bold px-0.5 rounded"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  }, [textContent, searchTerm]);

  return (
    <div
      id="raw-text-panel"
      className="flex flex-col h-full rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 overflow-hidden shadow-sm"
    >
      {/* Panel Top Action Bar */}
      <div className="p-3 sm:p-4 bg-slate-950/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Raw Extracted Text
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            ({charCount.toLocaleString("en-IN")} chars • {wordCount.toLocaleString("en-IN")} words • {Math.round(confidenceScore * 100)}% conf)
          </span>
        </div>

        {/* Quick Actions: Source Link & Copy */}
        <div className="flex items-center gap-2">
          <a
            id="raw-text-source-link"
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Open original government notification source in a new tab"
          >
            <span>Original Document</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          <button
            id="raw-text-copy-btn"
            type="button"
            onClick={handleCopy}
            disabled={!textContent}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition disabled:opacity-40"
            aria-label="Copy raw extracted text"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* In-Text Search Filter */}
      <div className="px-3 sm:px-4 py-2 bg-slate-950/40 border-b border-slate-800/60">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-3 text-slate-500 pointer-events-none" />
          <input
            id="raw-text-search-input"
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search within extracted OCR text (e.g., vacancies, qualifications)..."
            className="w-full pl-8 pr-3 py-1.5 text-xs font-mono rounded-lg bg-slate-800/80 border border-slate-700/80 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Scrollable Monospace Body Container */}
      <div
        id="raw-text-content"
        className="flex-1 p-4 overflow-y-auto max-h-[calc(100vh-280px)] font-mono text-xs leading-relaxed break-words whitespace-pre-wrap selection:bg-blue-600 selection:text-white"
        tabIndex={0}
        aria-label="Raw text content"
      >
        {renderedContent}
      </div>
    </div>
  );
}
