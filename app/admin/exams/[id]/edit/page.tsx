/**
 * @file app/admin/exams/[id]/edit/page.tsx
 * @description Page for editing an existing examination series.
 * 
 * Task ID: TASK-03030101 (Subtask: SUB-0303010102)
 * Architecture Reference: ADR-001 (App Router)
 */

import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminExamById } from "@/lib/data/exams";
import ExamForm from "@/components/admin/ExamForm";

export const metadata: Metadata = {
  title: "Edit Examination Series | Admin HITL Portal",
  description: "Modify master competitive examination attributes, conducting body, or official portal links.",
};

interface EditExamPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditExamPage({ params }: EditExamPageProps) {
  const resolvedParams = await params;
  const exam = await getAdminExamById(resolvedParams.id);

  if (!exam) {
    notFound();
  }

  return (
    <div className="py-2">
      <ExamForm mode="edit" initialData={exam} />
    </div>
  );
}
