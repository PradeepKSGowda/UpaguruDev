"use client";

/**
 * @file components/admin/PortalUrlEditModal.tsx
 * @description Administrative modal for inspecting, verifying, dry-run testing,
 * and updating recruitment portal target extraction URLs with live parser diagnostics,
 * website change alerts, and full historical transition audit trail.
 * 
 * Architecture Reference: ADR-001 (Frontend RSC/Client), ADR-002 (Database), ADR-003 (RBAC)
 */

import React, { useState, useEffect, useTransition } from "react";
import {
  Globe,
  ExternalLink,
  History,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  ShieldCheck,
  Clock,
  Sparkles,
  FileText,
  AlertCircle,
  Eye,
} from "lucide-react";
import type { PortalUrlHistoryEntry, CrawlerParserTestResult } from "@/lib/scrapers/registry";
import {
  updatePortalTargetUrlAction,
  getPortalUrlHistoryAction,
  verifyPortalUrlAction,
  testCrawlerParserAction,
} from "@/app/admin/scrapers/actions";

export interface PortalUrlEditModalProps {
  portalCode: string;
  portalName: string;
  currentTargetUrl: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newUrl: string) => void;
  initialTab?: "edit" | "preview" | "history";
}

export default function PortalUrlEditModal({
  portalCode,
  portalName,
  currentTargetUrl,
  isOpen,
  onClose,
  onSuccess,
  initialTab = "edit",
}: PortalUrlEditModalProps) {
  const [activeTab, setActiveTab] = useState<"edit" | "preview" | "history">(initialTab);
  const [newUrl, setNewUrl] = useState(currentTargetUrl);
  const [reason, setReason] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    status?: number;
    finalUrl?: string;
    isRedirect?: boolean;
    responseTimeMs?: number;
    message: string;
  } | null>(null);

  // Dry-run parser preview state
  const [isTestingParser, setIsTestingParser] = useState(false);
  const [parserResult, setParserResult] = useState<CrawlerParserTestResult | null>(null);

  const [historyList, setHistoryList] = useState<PortalUrlHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setNewUrl(currentTargetUrl);
      setReason("");
      setVerificationResult(null);
      setSaveMessage(null);
      setParserResult(null);
      setActiveTab(initialTab);
      loadHistory();
      if (initialTab === "preview") {
        runParserTest(currentTargetUrl);
      }
    }
  }, [isOpen, currentTargetUrl, initialTab]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await getPortalUrlHistoryAction(portalCode);
      if (res.success) {
        setHistoryList(res.data);
      }
    } catch {
      // Non-fatal
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleVerify = async () => {
    if (!newUrl.trim()) return;
    setIsVerifying(true);
    setVerificationResult(null);
    try {
      const res = await verifyPortalUrlAction(newUrl.trim());
      setVerificationResult(res);
    } catch (err: any) {
      setVerificationResult({
        success: false,
        message: err.message || "Failed to reach target URL",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const runParserTest = async (testUrl?: string) => {
    const target = testUrl?.trim() || newUrl.trim() || currentTargetUrl;
    if (!target) return;
    setIsTestingParser(true);
    try {
      const res = await testCrawlerParserAction(portalCode, target);
      setParserResult(res);
    } catch (err: any) {
      setParserResult({
        success: false,
        portalCode,
        targetUrl: target,
        finalUrl: target,
        isRedirect: false,
        httpStatus: 0,
        responseTimeMs: 0,
        totalElementsFound: 0,
        structureType: "unrecognized",
        diagnosticMessage: `Dry-run parser test failed: ${err.message || "Network error"}`,
        diagnosticType: "error",
        items: [],
      });
    } finally {
      setIsTestingParser(false);
    }
  };

  const handleSave = () => {
    if (!newUrl.trim()) return;
    setSaveMessage(null);

    startTransition(async () => {
      const res = await updatePortalTargetUrlAction({
        portalCode,
        newUrl: newUrl.trim(),
        reason: reason.trim() || undefined,
      });

      if (res.success) {
        setSaveMessage({ type: "success", text: res.message });
        if (onSuccess) onSuccess(newUrl.trim());
        loadHistory();
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setSaveMessage({ type: "error", text: res.message });
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center text-xs shadow-sm">
              {portalCode}
            </div>
            <div>
              <h2 id="modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                {portalCode} — Target Extraction URL &amp; Parser Diagnostics
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md">
                {portalName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900 px-5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("edit")}
            className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "edit"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Configure &amp; Test URL</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("preview");
              if (!parserResult && !isTestingParser) {
                runParserTest();
              }
            }}
            className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "preview"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Dry-Run Parser Preview</span>
            {parserResult && (
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  parserResult.success
                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                    : "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300"
                }`}
              >
                {parserResult.totalElementsFound}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "history"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>URL Change History ({historyList.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {saveMessage && (
            <div
              className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                saveMessage.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-300"
                  : "bg-red-50 dark:bg-red-950/40 border-red-200 text-red-800 dark:text-red-300"
              }`}
            >
              {saveMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{saveMessage.text}</span>
            </div>
          )}

          {/* TAB 1: CONFIGURE & TEST URL */}
          {activeTab === "edit" && (
            <div className="space-y-4">
              {/* Current URL Readout */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Currently Active Extraction URL
                </span>
                <a
                  href={currentTargetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-blue-600 dark:text-blue-400 hover:underline break-all inline-flex items-center gap-1"
                >
                  <span>{currentTargetUrl}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>

              {/* Edit Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  New Target Extraction URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://www.upsc.gov.in/examinations/active-exams"
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleVerify}
                    disabled={isVerifying || !newUrl.trim()}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        <span>Testing...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Test Link</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("preview");
                      runParserTest(newUrl.trim());
                    }}
                    disabled={isTestingParser || !newUrl.trim()}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition flex items-center gap-1.5 shrink-0"
                    title="Run dry-run extraction preview"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Dry-Run Parser</span>
                  </button>
                </div>
              </div>

              {/* Verification Feedback Banner */}
              {verificationResult && (
                <div
                  className={`p-3 rounded-xl border text-xs ${
                    verificationResult.success
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300"
                      : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    {verificationResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span>{verificationResult.message}</span>
                  </div>

                  {verificationResult.isRedirect && verificationResult.finalUrl && (
                    <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                        Redirect target: <strong className="font-mono">{verificationResult.finalUrl}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setNewUrl(verificationResult.finalUrl!)}
                        className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] shrink-0"
                      >
                        Use Redirect URL
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Reason for Change */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for URL Modification <span className="text-slate-400 font-normal">(saved to audit history)</span>
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. UPSC redirected /examinations/active-examinations to /examinations/active-exams"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* TAB 2: DRY-RUN PARSER PREVIEW & DIAGNOSTICS */}
          {activeTab === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Crawler Parser Live Diagnostics
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Live HTML fetch simulating crawler extraction without modifying database records.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => runParserTest(newUrl.trim())}
                  disabled={isTestingParser}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isTestingParser ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Parsing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Run Test Now</span>
                    </>
                  )}
                </button>
              </div>

              {isTestingParser && (
                <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span>Connecting to target recruitment portal and inspecting DOM structure...</span>
                </div>
              )}

              {parserResult && !isTestingParser && (
                <div className="space-y-3">
                  {/* High-visibility Diagnostic Banner */}
                  <div
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                      parserResult.diagnosticType === "success"
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200"
                        : parserResult.diagnosticType === "warning"
                        ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 text-blue-900 dark:text-blue-200"
                        : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60 text-red-900 dark:text-red-200"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {parserResult.diagnosticType === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : parserResult.diagnosticType === "warning" ? (
                        <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-bold">{parserResult.diagnosticMessage}</p>
                        <div className="text-[11px] opacity-80 mt-1 flex flex-wrap items-center gap-3">
                          <span>Status: <strong>HTTP {parserResult.httpStatus}</strong></span>
                          <span>Response Time: <strong>{parserResult.responseTimeMs}ms</strong></span>
                          <span>Items Detected: <strong>{parserResult.totalElementsFound}</strong></span>
                          <span>Structure: <strong className="uppercase">{parserResult.structureType.replace(/_/g, " ")}</strong></span>
                        </div>
                      </div>
                    </div>

                    {parserResult.isRedirect && (
                      <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-800/60 flex items-center justify-between gap-2">
                        <span className="text-[11px]">
                          Redirected endpoint: <strong className="font-mono">{parserResult.finalUrl}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setNewUrl(parserResult.finalUrl);
                            setActiveTab("edit");
                          }}
                          className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] shrink-0"
                        >
                          Use This URL
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Sample Items Table */}
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Sample Candidate Circulars Discovered ({parserResult.items.length})
                    </h4>
                    {parserResult.items.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-400">
                        No circular links or examination landing pages detected.
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden text-xs">
                        {parserResult.items.map((it, idx) => (
                          <div key={idx} className="p-2.5 flex items-start justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <div className="flex items-start gap-2 min-w-0">
                              <FileText className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {it.title}
                                </p>
                                <a
                                  href={it.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-mono text-blue-600 dark:text-blue-400 hover:underline truncate block"
                                >
                                  {it.url}
                                </a>
                              </div>
                            </div>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 uppercase ${
                                it.isDirectPdf
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              }`}
                            >
                              {it.isDirectPdf ? "Direct PDF" : "Subpage"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AUDIT HISTORY */}
          {activeTab === "history" && (
            <div className="space-y-3">
              {isLoadingHistory ? (
                <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Loading URL history...</span>
                </div>
              ) : historyList.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No historical URL updates recorded yet. Any saved changes will be logged here.
                </div>
              ) : (
                <div className="space-y-3">
                  {historyList.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {new Date(entry.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
                        </span>
                        {entry.changedByEmail && (
                          <span className="font-medium text-slate-600 dark:text-slate-300 truncate max-w-xs">
                            {entry.changedByEmail}
                          </span>
                        )}
                      </div>

                      <div className="font-mono text-[11px] space-y-1">
                        <div className="text-red-600 dark:text-red-400 truncate">
                          - <span className="line-through">{entry.previousUrl}</span>
                        </div>
                        <div className="text-emerald-600 dark:text-emerald-400 truncate">
                          + {entry.newUrl}
                        </div>
                      </div>

                      {entry.reason && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 italic pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                          &ldquo;{entry.reason}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white transition"
          >
            Cancel
          </button>

          {activeTab === "edit" && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !newUrl.trim() || newUrl.trim() === currentTargetUrl}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving &amp; Revalidating...</span>
                </>
              ) : (
                <>
                  <span>Save &amp; Update Target URL</span>
                </>
              )}
            </button>
          )}

          {activeTab === "preview" && (
            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm flex items-center gap-1.5"
            >
              <span>Back to Configure</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
