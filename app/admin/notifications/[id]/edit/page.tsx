/**
 * @file app/admin/notifications/[id]/edit/page.tsx
 * @description Page for amending and updating an existing job notification.
 * 
 * Task ID: TASK-03030102 (Subtask: SUB-0303010201)
 * Architecture Reference: ADR-001 (App Router)
 */

import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminNotificationById, getExamOptionsForSelector } from "@/lib/data/admin-notifications";
import NotificationForm from "@/components/admin/NotificationForm";

export const metadata: Metadata = {
  title: "Edit Job Notification | Admin HITL Portal",
  description: "Modify job vacancy details, application windows, or eligibility criteria.",
};

interface EditNotificationPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditNotificationPage({ params }: EditNotificationPageProps) {
  const resolvedParams = await params;
  const [notification, examOptions] = await Promise.all([
    getAdminNotificationById(resolvedParams.id),
    getExamOptionsForSelector(),
  ]);

  if (!notification) {
    notFound();
  }

  return (
    <div className="py-2">
      <NotificationForm mode="edit" initialData={notification} examOptions={examOptions} />
    </div>
  );
}
