/**
 * @file app/admin/lifecycle-update/page.tsx
 * @description Master Administration Page for adding Examination Lifecycle Updates
 * using the Dynamic Form Engine and Cascading Organization/Exam/Cycle Selectors.
 */

import React from "react";
import { Metadata } from "next";
import DynamicExamLifecycleForm from "@/components/admin/lifecycle/DynamicExamLifecycleForm";

export const metadata: Metadata = {
  title: "Examination Lifecycle Update | UPA-GURU Admin",
  description:
    "Publish official updates, application deadline extensions, admit cards, answer keys, and results linked to canonical exam cycles.",
};

export default function LifecycleUpdatePage() {
  return (
    <div className="py-4">
      <DynamicExamLifecycleForm />
    </div>
  );
}
