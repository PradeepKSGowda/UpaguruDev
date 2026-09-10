/**
 * @file app/auth/login/page.tsx
 * @module LoginPage
 * @description Candidate and admin login page supporting Email/Password and Google OAuth 2.0 PKCE authentication.
 * 
 * Task ID: TASK-01020103 (Subtask: SUB-0102010301)
 * Architecture Reference: ADR-001, ADR-003, ADR-013
 * 
 * Complies with:
 * - Next.js 15 App Router Client Component conventions ("use client")
 * - Zod schema form validation (loginSchema)
 * - WCAG 2.1 AA accessibility standards (aria-invalid, aria-describedby, focus rings)
 * - Unique test locator attributes for Playwright E2E automation
 */

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/";

  const [formData, setFormData] = useState<LoginInput>({
    email: "",
    password: "",
  });

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginInput, string>>>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState<boolean>(false);

  const supabase = createBrowserClient();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name as keyof LoginInput]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    if (authError) setAuthError(null);
  };

  const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);

    // Validate inputs using Zod
    const validation = loginSchema.safeParse(formData);
    if (!validation.success) {
      const errors: Partial<Record<keyof LoginInput, string>> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0] as keyof LoginInput] = err.message;
        }
      });
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: validation.data.email,
        password: validation.data.password,
      });

      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          setAuthError("Please confirm your email address before signing in. Check your inbox for the activation link.");
        } else if (error.message.toLowerCase().includes("invalid login credentials")) {
          setAuthError("Invalid email or password. Please check your credentials and try again.");
        } else {
          setAuthError(error.message);
        }
        setIsSubmitting(false);
        return;
      }

      // Safe navigation to intended route
      router.push(returnTo);
      router.refresh();
    } catch {
      setAuthError("An unexpected network error occurred. Please check your internet connection.");
      setIsSubmitting(false);
    }
  };

  const handleGoogleOAuth = async () => {
    setAuthError(null);
    setIsOAuthLoading(true);

    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      if (returnTo && returnTo !== "/") {
        callbackUrl.searchParams.set("next", returnTo);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        setAuthError(error.message);
        setIsOAuthLoading(false);
      }
    } catch {
      setAuthError("Failed to initiate Google sign-in. Please try again.");
      setIsOAuthLoading(false);
    }
  };

  return (
    <div id="login-page-root" className="space-y-6">
      <div className="text-center">
        <h1
          id="login-heading"
          className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
        >
          Sign In to UPA-GURU
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Don&apos;t have an account?{" "}
          <Link
            id="login-to-register-link"
            href={returnTo !== "/" ? `/auth/register?returnTo=${encodeURIComponent(returnTo)}` : "/auth/register"}
            className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 focus:outline-none focus:underline"
          >
            Create free candidate account
          </Link>
        </p>
      </div>

      {authError && (
        <div
          id="login-error-alert"
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-4 text-sm text-rose-700 dark:text-rose-300 flex items-start gap-3"
        >
          <span className="text-rose-500 font-bold">⚠️</span>
          <span>{authError}</span>
        </div>
      )}

      {/* Google OAuth Button */}
      <div>
        <button
          type="button"
          id="btn-google-oauth"
          data-testid="btn-google-oauth"
          onClick={handleGoogleOAuth}
          disabled={isOAuthLoading || isSubmitting}
          className="w-full flex justify-center items-center gap-3 py-2.5 px-4 border border-slate-300 dark:border-slate-700 rounded-xl shadow-sm bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
            />
          </svg>
          <span>{isOAuthLoading ? "Connecting to Google..." : "Continue with Google"}</span>
        </button>
      </div>

      <div className="relative flex items-center justify-center my-4">
        <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
        <span className="bg-white dark:bg-slate-900 px-3 text-xs uppercase font-medium text-slate-500">
          Or with email
        </span>
      </div>

      {/* Email / Password Form */}
      <form id="login-form" onSubmit={handleEmailLogin} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="login-email-input"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Email Address
          </label>
          <input
            id="login-email-input"
            data-testid="login-email-input"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={formData.email}
            onChange={handleInputChange}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
            placeholder="candidate@example.com"
            className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors ${
              fieldErrors.email
                ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500"
                : "border-slate-300 dark:border-slate-700"
            }`}
          />
          {fieldErrors.email && (
            <p id="login-email-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="login-password-input"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Password
            </label>
            <Link
              id="login-forgot-password-link"
              href="/auth/forgot-password"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 focus:outline-none focus:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="login-password-input"
            data-testid="login-password-input"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={formData.password}
            onChange={handleInputChange}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
            placeholder="••••••••"
            className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors ${
              fieldErrors.password
                ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500"
                : "border-slate-300 dark:border-slate-700"
            }`}
          />
          {fieldErrors.password && (
            <p id="login-password-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
              {fieldErrors.password}
            </p>
          )}
        </div>

        <button
          type="submit"
          id="btn-login-submit"
          data-testid="btn-login-submit"
          disabled={isSubmitting || isOAuthLoading}
          className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-600/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2"
        >
          {isSubmitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
