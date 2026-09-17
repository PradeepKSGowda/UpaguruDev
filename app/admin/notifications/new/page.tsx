/**
 * @file app/admin/notifications/new/page.tsx
 * @description Page for authoring a new job notification manually.
 * 
 * Task ID: TASK-03030102 (Subtask: SUB-0303010201)
 * Architecture Reference: ADR-001 (App Router)
 */

import React from "react";
import { Metadata } from "next";
import { getExamOptionsForSelector } from "@/lib/data/admin-notifications";
import NotificationForm from "@/components/admin/NotificationForm";

export const metadata: Metadata = {
  title: "Author Job Notification | Admin HITL Portal",
  description: "Manually author and publish a new government job opening.",
};

export default async function CreateNotificationPage() {
  const examOptions = await getExamOptionsForSelector();

  return (
    <div className="py-2">
      <NotificationForm mode="create" examOptions={examOptions} />
    </div>
  );
}
