/**
 * @file app/admin/notifications/new/page.tsx
 * @description Page for adding examination lifecycle updates or authoring new job notifications.
 * Defaults to the Master Examination Lifecycle Engine, with legacy fallback support.
 */

import React from "react";
import { Metadata } from "next";
import { getExamOptionsForSelector } from "@/lib/data/admin-notifications";
import DynamicExamLifecycleForm from "@/components/admin/lifecycle/DynamicExamLifecycleForm";

export const metadata: Metadata = {
  title: "Examination Lifecycle Update | Admin HITL Portal",
  description: "Publish official examination updates, deadline extensions, admit cards, or initial vacancy circulars.",
};

export default async function CreateNotificationPage() {
  const examOptions = await getExamOptionsForSelector();

  return (
    <div className="py-2">
      <DynamicExamLifecycleForm />
    </div>
  );
}
