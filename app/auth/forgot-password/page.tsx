/**
 * @file app/auth/forgot-password/page.tsx
 * @module ForgotPasswordPage
 * @description Password reset and passwordless Magic Link dispatch page with Zod validation.
 * 
 * Task ID: TASK-01020103 (Subtask: SUB-0102010303)
 * Architecture Reference: ADR-001, ADR-003, ADR-013
 * 
 * Complies with:
 * - Next.js 15 App Router Client Component conventions ("use client")
 * - Zod schema form validation (forgotPasswordSchema, magicLinkSchema)
 * - Supabase Auth resetPasswordForEmail & signInWithOtp
 * - WCAG 2.1 AA accessibility standards
 */

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import { forgotPasswordSchema } from "@/lib/schemas/auth";

type AuthMode = "password_reset" | "magic_link";

export default function ForgotPasswordPage() {
  const [authMode, setAuthMode] = useState<AuthMode>("password_reset");
  const [email, setEmail] = useState<string>("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const supabase = createBrowserClient();

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (emailError) setEmailError(null);
    if (authError) setAuthError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);

    // Validate with Zod
    const validation = forgotPasswordSchema.safeParse({ email });
    if (!validation.success) {
      setEmailError(validation.error.errors[0]?.message || "Invalid email address");
      return;
    }

    setIsSubmitting(true);

    try {
      if (authMode === "password_reset") {
        const callbackUrl = new URL("/auth/callback?next=/auth/reset-password", window.location.origin).toString();
        const { error } = await supabase.auth.resetPasswordForEmail(validation.data.email, {
          redirectTo: callbackUrl,
        });

        if (error) {
          setAuthError(error.message);
          setIsSubmitting(false);
          return;
        }
      } else {
        // Passwordless Magic Link OTP
        const callbackUrl = new URL("/auth/callback", window.location.origin).toString();
        const { error } = await supabase.auth.signInWithOtp({
          email: validation.data.email,
          options: {
            emailRedirectTo: callbackUrl,
            shouldCreateUser: false, // Prevents unauthorized account creation via OTP
          },
        });

        if (error) {
          setAuthError(error.message);
          setIsSubmitting(false);
          return;
        }
      }

      setIsSuccess(true);
      setIsSubmitting(false);
    } catch {
      setAuthError("Failed to send email. Please check your network and try again.");
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div id="forgot-password-success-view" className="text-center space-y-4 py-4">
        <div className="w-14 h-14 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto text-2xl">
          📬
        </div>
        <h1
          id="forgot-password-success-heading"
          className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
        >
          {authMode === "password_reset" ? "Reset Link Sent" : "Magic Link Sent"}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          We have dispatched {authMode === "password_reset" ? "a password recovery email" : "a secure magic sign-in link"} to{" "}
          <span className="font-semibold text-slate-800 dark:text-slate-200">{email}</span>.
        </p>
        <p className="text-xs text-slate-500">
          Please check your inbox (and spam folder) and follow the link to proceed.
        </p>
        <div className="pt-4 flex flex-col gap-2">
          <Link
            id="forgot-to-login-btn"
            href="/auth/login"
            className="inline-flex justify-center items-center py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md transition-colors"
          >
            Back to Sign In
          </Link>
          <button
            type="button"
            id="btn-resend-link"
            onClick={() => setIsSuccess(false)}
            className="text-xs text-slate-600 dark:text-slate-400 hover:underline pt-2"
          >
            Didn&apos;t receive email? Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="forgot-password-page-root" className="space-y-6">
      <div className="text-center">
        <h1
          id="forgot-password-heading"
          className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
        >
          {authMode === "password_reset" ? "Recover Your Password" : "Passwordless Sign In"}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Remembered your password?{" "}
          <Link
            id="forgot-to-login-link"
            href="/auth/login"
            className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 focus:outline-none focus:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
        <button
          type="button"
          id="tab-mode-reset"
          data-testid="tab-mode-reset"
          onClick={() => {
            setAuthMode("password_reset");
            setAuthError(null);
            setEmailError(null);
          }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            authMode === "password_reset"
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Password Reset
        </button>
        <button
          type="button"
          id="tab-mode-magic"
          data-testid="tab-mode-magic"
          onClick={() => {
            setAuthMode("magic_link");
            setAuthError(null);
            setEmailError(null);
          }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            authMode === "magic_link"
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Magic Link OTP
        </button>
      </div>

      {authError && (
        <div
          id="forgot-password-error-alert"
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-4 text-sm text-rose-700 dark:text-rose-300 flex items-start gap-3"
        >
          <span className="text-rose-500 font-bold">⚠️</span>
          <span>{authError}</span>
        </div>
      )}

      <form id="forgot-password-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="forgot-email-input"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Registered Email Address
          </label>
          <input
            id="forgot-email-input"
            data-testid="forgot-email-input"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={handleEmailChange}
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? "forgot-email-error" : undefined}
            placeholder="candidate@example.com"
            className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors ${
              emailError
                ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500"
                : "border-slate-300 dark:border-slate-700"
            }`}
          />
          {emailError && (
            <p id="forgot-email-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
              {emailError}
            </p>
          )}
        </div>

        <button
          type="submit"
          id="btn-forgot-password-submit"
          data-testid="btn-forgot-password-submit"
          disabled={isSubmitting}
          className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-600/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2"
        >
          {isSubmitting
            ? "Sending..."
            : authMode === "password_reset"
            ? "Send Password Reset Link"
            : "Send Magic Sign-In Link"}
        </button>
      </form>
    </div>
  );
}
