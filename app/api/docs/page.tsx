"use client";

/**
 * @file app/api/docs/page.tsx
 * @module ApiDocsPage
 * @description Interactive OpenAPI 3.0 documentation page for UPA-GURU Public REST API.
 * Embeds Swagger UI with real-time test execution, schema inspection,
 * downloadable OpenAPI YAML/JSON specs, and rate-limit documentation.
 * 
 * Task ID: TASK-08020101 (Subtask: SUB-0802010101)
 * Architecture Reference: ADR-001 (Frontend), ADR-014 (API Design)
 * Complies with: AGENTS.md (Rule 1: Next.js 15 App Router conventions & strict TypeScript)
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Code2, Download, ShieldCheck, Zap, ExternalLink, CheckCircle } from "lucide-react";

export default function ApiDocsPage() {
  const [swaggerLoaded, setSwaggerLoaded] = useState(false);
  const [swaggerError, setSwaggerError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Inject Swagger UI CSS
    const linkId = "swagger-ui-css";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.18.2/swagger-ui.css";
      document.head.appendChild(link);
    }

    // 2. Inject Swagger UI Bundle Script
    const scriptId = "swagger-ui-bundle-js";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const initSwagger = () => {
      try {
        const win = window as unknown as {
          SwaggerUIBundle?: (config: Record<string, unknown>) => unknown;
        };

        if (win.SwaggerUIBundle) {
          win.SwaggerUIBundle({
            url: "/openapi.json",
            dom_id: "#swagger-ui",
            deepLinking: true,
            presets: [],
            layout: "BaseLayout",
            docExpansion: "list",
            defaultModelsExpandDepth: 2,
            defaultModelExpandDepth: 2,
            showExtensions: true,
            showCommonExtensions: true,
            supportedSubmitMethods: ["get"],
          });
          setSwaggerLoaded(true);
        }
      } catch (err) {
        console.error("Failed to initialize Swagger UI:", err);
        setSwaggerError("Could not initialize interactive Swagger UI.");
      }
    };

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.18.2/swagger-ui-bundle.js";
      script.async = true;
      script.onload = () => {
        initSwagger();
      };
      script.onerror = () => {
        setSwaggerError("Failed to load Swagger UI dependencies from CDN.");
      };
      document.body.appendChild(script);
    } else {
      initSwagger();
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  OpenAPI 3.0.3
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  REST API v1
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  60 req/min
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight font-heading text-white">
                UPA-GURU Developer API Reference
              </h1>
              <p className="mt-2 text-slate-300 max-w-2xl text-sm leading-relaxed">
                Programmatic REST access to India&apos;s authoritative government exam recruitment feeds,
                conducting body directories, and full-text search indexing.
              </p>
            </div>

            {/* Spec Download Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/openapi.yaml"
                download="upaguru-openapi.yaml"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-medium border border-slate-700 transition shadow-sm"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>openapi.yaml</span>
              </a>
              <a
                href="/openapi.json"
                download="upaguru-openapi.json"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-medium border border-slate-700 transition shadow-sm"
              >
                <Download className="w-4 h-4 text-blue-400" />
                <span>openapi.json</span>
              </a>
            </div>
          </div>

          {/* Quick Technical Specs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800 text-xs">
            <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-lg border border-slate-700/50">
              <Zap className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-white block">Rate Limit Window</span>
                <span className="text-slate-400">60 requests/minute per client IP via Upstash Redis</span>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-lg border border-slate-700/50">
              <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-white block">Error Protocol</span>
                <span className="text-slate-400">RFC 7807 application/problem+json compliant</span>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-lg border border-slate-700/50">
              <Code2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-white block">Payload Encoding</span>
                <span className="text-slate-400">Strict JSON UTF-8 with ISO-8601 timestamps</span>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-lg border border-slate-700/50">
              <BookOpen className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-white block">Edge CDN Caching</span>
                <span className="text-slate-400">300s shared max-age with stale-while-revalidate</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Documentation Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Fallback & Loading Indicator */}
        {!swaggerLoaded && !swaggerError && (
          <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800 mb-4"></div>
            <p className="text-sm font-medium text-slate-700">Loading interactive Swagger UI documentation...</p>
            <p className="text-xs text-slate-400 mt-1">Fetching OpenAPI 3.0 schema from /openapi.json</p>
          </div>
        )}

        {swaggerError && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-900 mb-6">
            <p className="font-semibold text-sm">{swaggerError}</p>
            <p className="text-xs mt-1 text-amber-700">
              You can inspect the raw schema directly via{" "}
              <a href="/openapi.yaml" className="underline font-mono">/openapi.yaml</a> or{" "}
              <a href="/openapi.json" className="underline font-mono">/openapi.json</a>.
            </p>
          </div>
        )}

        {/* Swagger UI Mount Container */}
        <div
          id="swagger-ui"
          className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden p-4 sm:p-6"
        />

        {/* Quick Endpoint Overview Card */}
        <div className="mt-10 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 font-heading flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span>Endpoint Summary Matrix</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Method</th>
                  <th className="py-3 px-4 font-semibold">Path</th>
                  <th className="py-3 px-4 font-semibold">Description</th>
                  <th className="py-3 px-4 font-semibold">Cache Policy</th>
                  <th className="py-3 px-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                <tr className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">GET</span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900">/api/v1/notifications</td>
                  <td className="py-3 px-4 font-sans text-slate-600 text-xs">
                    List published notifications with category, state, and deadline filters.
                  </td>
                  <td className="py-3 px-4 font-sans text-slate-500 text-xs">s-maxage=300</td>
                  <td className="py-3 px-4 font-sans">
                    <Link
                      href="/api/v1/notifications?limit=5"
                      target="_blank"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-semibold"
                    >
                      <span>Test</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">GET</span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900">/api/v1/exams</td>
                  <td className="py-3 px-4 font-sans text-slate-600 text-xs">
                    List canonical exam entities with conducting commission metadata and active counts.
                  </td>
                  <td className="py-3 px-4 font-sans text-slate-500 text-xs">s-maxage=600</td>
                  <td className="py-3 px-4 font-sans">
                    <Link
                      href="/api/v1/exams?limit=5"
                      target="_blank"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-semibold"
                    >
                      <span>Test</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">GET</span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900">/api/v1/search</td>
                  <td className="py-3 px-4 font-sans text-slate-600 text-xs">
                    PostgreSQL GIN full-text keyword search across published notices.
                  </td>
                  <td className="py-3 px-4 font-sans text-slate-500 text-xs">s-maxage=60</td>
                  <td className="py-3 px-4 font-sans">
                    <Link
                      href="/api/v1/search?q=civil&limit=5"
                      target="_blank"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-semibold"
                    >
                      <span>Test</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
