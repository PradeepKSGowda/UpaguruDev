/**
 * @file app/auth/register/page.tsx
 * @module RegisterPage
 * @description Candidate registration page with Zod validation and mandatory email verification prompt.
 * 
 * Task ID: TASK-01020103 (Subtask: SUB-0102010302)
 * Architecture Reference: ADR-001, ADR-003, ADR-013
 * 
 * Complies with:
 * - Next.js 15 App Router Client Component conventions ("use client")
 * - Zod schema form validation (registerSchema)
 * - Supabase Auth signUp with metadata injection
 * - WCAG 2.1 AA accessibility standards
 */

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import { registerSchema, type RegisterInput } from "@/lib/schemas/auth";

export default function RegisterPage() {
  const [formData, setFormData] = useState<RegisterInput>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RegisterInput, string>>>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isRegisteredSuccess, setIsRegisteredSuccess] = useState<boolean>(false);
  const [registeredEmail, setRegisteredEmail] = useState<string>("");

  const supabase = createBrowserClient();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name as keyof RegisterInput]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    if (authError) setAuthError(null);
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);

    // Validate with Zod
    const validation = registerSchema.safeParse(formData);
    if (!validation.success) {
      const errors: Partial<Record<keyof RegisterInput, string>> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0] as keyof RegisterInput] = err.message;
        }
      });
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin).toString();

      const { error } = await supabase.auth.signUp({
        email: validation.data.email,
        password: validation.data.password,
        options: {
          data: {
            full_name: validation.data.fullName,
          },
          emailRedirectTo: callbackUrl,
        },
      });

      if (error) {
        setAuthError(error.message);
        setIsSubmitting(false);
        return;
      }

      setRegisteredEmail(validation.data.email);
      setIsRegisteredSuccess(true);
      setIsSubmitting(false);
    } catch {
      setAuthError("Failed to register. Please check your network connection and try again.");
      setIsSubmitting(false);
    }
  };

  if (isRegisteredSuccess) {
    return (
      <div id="register-success-view" className="text-center space-y-4 py-4">
        <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto text-2xl">
          ✉️
        </div>
        <h1
          id="register-success-heading"
          className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
        >
          Check Your Email
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          We have sent a verification link to <span className="font-semibold text-slate-800 dark:text-slate-200">{registeredEmail}</span>.
        </p>
        <p className="text-xs text-slate-500">
          Please click the link in the email to activate your account and access exam notifications.
        </p>
        <div className="pt-4">
          <Link
            id="register-to-login-success-btn"
            href="/auth/login"
            className="inline-flex justify-center items-center py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md transition-colors"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div id="register-page-root" className="space-y-6">
      <div className="text-center">
        <h1
          id="register-heading"
          className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
        >
          Create Candidate Account
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Already registered?{" "}
          <Link
            id="register-to-login-link"
            href="/auth/login"
            className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 focus:outline-none focus:underline"
          >
            Sign in here
          </Link>
        </p>
      </div>

      {authError && (
        <div
          id="register-error-alert"
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-4 text-sm text-rose-700 dark:text-rose-300 flex items-start gap-3"
        >
          <span className="text-rose-500 font-bold">⚠️</span>
          <span>{authError}</span>
        </div>
      )}

      <form id="register-form" onSubmit={handleRegister} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="register-fullname-input"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Full Name
          </label>
          <input
            id="register-fullname-input"
            data-testid="register-fullname-input"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            value={formData.fullName}
            onChange={handleInputChange}
            aria-invalid={Boolean(fieldErrors.fullName)}
            aria-describedby={fieldErrors.fullName ? "register-fullname-error" : undefined}
            placeholder="Prajna Gowda"
            className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors ${
              fieldErrors.fullName
                ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500"
                : "border-slate-300 dark:border-slate-700"
            }`}
          />
          {fieldErrors.fullName && (
            <p id="register-fullname-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
              {fieldErrors.fullName}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="register-email-input"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Email Address
          </label>
          <input
            id="register-email-input"
            data-testid="register-email-input"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={formData.email}
            onChange={handleInputChange}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "register-email-error" : undefined}
            placeholder="candidate@example.com"
            className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors ${
              fieldErrors.email
                ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500"
                : "border-slate-300 dark:border-slate-700"
            }`}
          />
          {fieldErrors.email && (
            <p id="register-email-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="register-password-input"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Password
          </label>
          <input
            id="register-password-input"
            data-testid="register-password-input"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={formData.password}
            onChange={handleInputChange}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "register-password-error" : undefined}
            placeholder="Min. 8 chars, 1 uppercase, 1 number"
            className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors ${
              fieldErrors.password
                ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500"
                : "border-slate-300 dark:border-slate-700"
            }`}
          />
          {fieldErrors.password && (
            <p id="register-password-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
              {fieldErrors.password}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="register-confirmpassword-input"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Confirm Password
          </label>
          <input
            id="register-confirmpassword-input"
            data-testid="register-confirmpassword-input"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={formData.confirmPassword}
            onChange={handleInputChange}
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
            aria-describedby={fieldErrors.confirmPassword ? "register-confirmpassword-error" : undefined}
            placeholder="Repeat password"
            className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors ${
              fieldErrors.confirmPassword
                ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500"
                : "border-slate-300 dark:border-slate-700"
            }`}
          />
          {fieldErrors.confirmPassword && (
            <p id="register-confirmpassword-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        <button
          type="submit"
          id="btn-register-submit"
          data-testid="btn-register-submit"
          disabled={isSubmitting}
          className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-600/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2"
        >
          {isSubmitting ? "Creating account..." : "Register Account"}
        </button>
      </form>
    </div>
  );
}
