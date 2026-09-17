/**
 * @file app/admin/exams/new/page.tsx
 * @description Page for manually creating a new competitive examination series.
 * 
 * Task ID: TASK-03030101 (Subtask: SUB-0303010102)
 * Architecture Reference: ADR-001 (App Router)
 */

import React from "react";
import { Metadata } from "next";
import ExamForm from "@/components/admin/ExamForm";

export const metadata: Metadata = {
  title: "Create Examination Series | Admin HITL Portal",
  description: "Register a new master competitive examination for notification linking.",
};

export default function CreateExamPage() {
  return (
    <div className="py-2">
      <ExamForm mode="create" />
    </div>
  );
}
