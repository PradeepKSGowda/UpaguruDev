/**
 * @file components/preferences/SubscriptionPreferenceForm.tsx
 * @module SubscriptionPreferenceForm
 * @description Unified interactive client component for candidate alert preferences.
 * Orchestrates category multi-select, state jurisdiction filtering, delivery channels,
 * optimistic UI state updates, and Server Action dispatch.
 * 
 * Task ID: TASK-05010101 (Subtasks: SUB-0501010101, SUB-0501010102)
 * Architecture Reference: ADR-001 (Frontend RSC/Client Integration), ADR-007 (Push Engine)
 * 
 * Complies with:
 * - Next.js 15 React Server Action transition (`useTransition`)
 * - Zod client-side and server-side validation feedback
 * - Clear accessibility landmarks and unique IDs for automated testability
 * - Non-blocking optimistic states and persistent save feedback
 */

"use client";

import React, { useState, useTransition } from "react";
import { Save, CheckCircle2, AlertCircle, Loader2, Sparkles } from "lucide-react";
import type { ExamCategoryEnum } from "@/types/database.types";
import type { UserSubscription, NotificationChannel, SubscriptionFormData } from "@/types/subscriptions";
import CategorySelector from "./CategorySelector";
import StateSelector from "./StateSelector";
import ChannelPreferences from "./ChannelPreferences";
import { updateSubscriptionPreferences } from "@/app/preferences/actions";

interface SubscriptionPreferenceFormProps {
  initialSubscription: UserSubscription | null;
  userEmail: string;
}

export default function SubscriptionPreferenceForm({
  initialSubscription,
  userEmail,
}: SubscriptionPreferenceFormProps) {
  const [isPending, startTransition] = useTransition();

  // Form states initialized with existing preferences or sensible defaults
  const [selectedCategories, setSelectedCategories] = useState<ExamCategoryEnum[]>(
    initialSubscription?.subscribedCategories && initialSubscription.subscribedCategories.length > 0
      ? initialSubscription.subscribedCategories
      : ["civil_services", "state_psc"]
  );

  const [selectedStates, setSelectedStates] = useState<string[]>(
    initialSubscription?.subscribedStates && initialSubscription.subscribedStates.length > 0
      ? initialSubscription.subscribedStates
      : ["Central", "Karnataka"]
  );

  const [preferredChannels, setPreferredChannels] = useState<NotificationChannel[]>(
    initialSubscription?.preferredChannels && initialSubscription.preferredChannels.length > 0
      ? initialSubscription.preferredChannels
      : ["web_push", "email"]
  );

  const [telegramChatId, setTelegramChatId] = useState<string>(
    initialSubscription?.telegramChatId || ""
  );

  const [whatsappPhoneNumber, setWhatsappPhoneNumber] = useState<string>(
    initialSubscription?.whatsappPhoneNumber || ""
  );

  // Status feedback states
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | null;
    message: string | null;
  }>({ type: null, message: null });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback({ type: null, message: null });
    setFieldErrors({});

    const formData: SubscriptionFormData = {
      subscribedCategories: selectedCategories,
      subscribedStates: selectedStates,
      preferredChannels,
      telegramChatId: telegramChatId.trim(),
      whatsappPhoneNumber: whatsappPhoneNumber.trim(),
    };

    startTransition(async () => {
      try {
        const res = await updateSubscriptionPreferences(formData);
        if (res.success) {
          setFeedback({
            type: "success",
            message: res.message,
          });
        } else {
          setFeedback({
            type: "error",
            message: res.message,
          });
          if (res.errors) {
            setFieldErrors(res.errors);
          }
        }
      } catch (err) {
        setFeedback({
          type: "error",
          message: "An unexpected network error occurred. Please try again.",
        });
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-8 bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xs"
      data-testid="subscription-preferences-form"
    >
      {/* Feedback Banner */}
      {feedback.message && (
        <div
          role="alert"
          className={`p-4 rounded-xl flex items-start gap-3 transition-all ${
            feedback.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
              : "bg-red-50 border border-red-200 text-red-900"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="text-sm font-medium leading-relaxed">
            {feedback.message}
          </div>
        </div>
      )}

      {/* Account Info Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-gray-100 gap-2">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            Account Profile
          </span>
          <div className="text-sm text-gray-800 font-medium mt-0.5">
            Registered as: <span className="font-semibold text-gray-900">{userEmail}</span>
          </div>
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Real-time instant alert synchronization</span>
        </div>
      </div>

      {/* Section 1: Target Exam Categories */}
      <section aria-labelledby="section-categories">
        <CategorySelector
          selectedCategories={selectedCategories}
          onChange={setSelectedCategories}
          error={fieldErrors.subscribedCategories?.[0]}
        />
      </section>

      <hr className="border-gray-100" />

      {/* Section 2: Regional / State Filters */}
      <section aria-labelledby="section-states">
        <StateSelector
          selectedStates={selectedStates}
          onChange={setSelectedStates}
          error={fieldErrors.subscribedStates?.[0]}
        />
      </section>

      <hr className="border-gray-100" />

      {/* Section 3: Delivery Channels */}
      <section aria-labelledby="section-channels">
        <ChannelPreferences
          preferredChannels={preferredChannels}
          onChannelsChange={setPreferredChannels}
          telegramChatId={telegramChatId}
          onTelegramChatIdChange={setTelegramChatId}
          whatsappPhoneNumber={whatsappPhoneNumber}
          onWhatsappPhoneNumberChange={setWhatsappPhoneNumber}
          errors={fieldErrors}
        />
      </section>

      {/* Form Submission Footer */}
      <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-xs text-gray-500">
          Preferences are applied instantly across all automated notification crawler pipelines.
        </div>

        <button
          type="submit"
          disabled={isPending}
          id="btn-save-preferences"
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving Preferences...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Alert Preferences</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
