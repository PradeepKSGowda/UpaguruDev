/**
 * @file lib/lifecycle/dynamic-form-engine.ts
 * @description Dynamic Form Engine for UPA-GURU Examination Lifecycle Updates.
 * Computes active fields, default values, conditional visibility rules, and
 * validation schemas tailored to the specific notification type and stage.
 * 
 * Rules: AGENTS.md Rule 1 (Zod validation, strict TypeScript), Rule 3 (Audit Trail)
 */

export { type DynamicFormFieldConfig } from "./taxonomy";
import {
  type DynamicFormFieldConfig,
  getNotificationTypeMeta,
  type NotificationTypeMeta,
} from "./taxonomy";

// =============================================================================
// 1. DECLARATIVE DYNAMIC FIELD CONFIGURATIONS
// =============================================================================

export const FORM_FIELD_CONFIGS: Record<string, DynamicFormFieldConfig[]> = {
  // 1. APPLICATION EXTENSION
  APPLICATION_EXTENSION: [
    {
      fieldName: "original_closing_date",
      fieldLabel: "Original Closing Date",
      fieldType: "date",
      isRequired: false,
      placeholder: "YYYY-MM-DD",
      helperText: "Original closing deadline (auto-loaded from exam cycle if available).",
      displayOrder: 10,
    },
    {
      fieldName: "new_closing_date",
      fieldLabel: "New Extended Closing Date",
      fieldType: "date",
      isRequired: true,
      placeholder: "YYYY-MM-DD",
      helperText: "Newly extended application deadline announced by the commission.",
      displayOrder: 20,
    },
    {
      fieldName: "fee_payment_extended_date",
      fieldLabel: "Extended Fee Payment Date (Optional)",
      fieldType: "date",
      isRequired: false,
      placeholder: "YYYY-MM-DD",
      helperText: "Last date to pay the application fee if different from form submission.",
      displayOrder: 30,
    },
    {
      fieldName: "extension_reason",
      fieldLabel: "Extension Reason",
      fieldType: "textarea",
      isRequired: false,
      placeholder: "e.g., Heavy server traffic, public holidays, court order",
      helperText: "Official ground for extending the deadline.",
      displayOrder: 40,
    },
    {
      fieldName: "reference_number",
      fieldLabel: "Corrigendum / Notice Ref No.",
      fieldType: "text",
      isRequired: false,
      placeholder: "e.g., Advt No. 04/2026/Ext-1",
      displayOrder: 50,
    },
    {
      fieldName: "official_pdf_url",
      fieldLabel: "Official Document / PDF URL",
      fieldType: "url",
      isRequired: true,
      placeholder: "https://...",
      helperText: "Direct official notification or public notice link.",
      displayOrder: 60,
    },
    {
      fieldName: "apply_online_url",
      fieldLabel: "Application Portal Link (Optional)",
      fieldType: "url",
      isRequired: false,
      placeholder: "https://...",
      displayOrder: 70,
    },
  ],

  // 2. ADMIT CARD RELEASED
  ADMIT_CARD_RELEASED: [
    {
      fieldName: "release_date",
      fieldLabel: "Admit Card Release Date",
      fieldType: "date",
      isRequired: true,
      placeholder: "YYYY-MM-DD",
      helperText: "Date hall ticket download portal was activated.",
      displayOrder: 10,
    },
    {
      fieldName: "exam_date",
      fieldLabel: "Examination Date(s)",
      fieldType: "text",
      isRequired: true,
      placeholder: "e.g., 2026-10-18 or 18-20 Oct 2026",
      helperText: "Target date(s) for which the hall ticket applies.",
      displayOrder: 20,
    },
    {
      fieldName: "reporting_time",
      fieldLabel: "Reporting / Shift Time",
      fieldType: "text",
      isRequired: false,
      placeholder: "e.g., 08:30 AM (Morning Shift), 01:30 PM (Afternoon Shift)",
      displayOrder: 30,
    },
    {
      fieldName: "download_url",
      fieldLabel: "Hall Ticket Download Portal Link",
      fieldType: "url",
      isRequired: true,
      placeholder: "https://...",
      helperText: "Portal where candidates log in to download their e-Admit Card.",
      displayOrder: 40,
    },
    {
      fieldName: "instructions_summary",
      fieldLabel: "Instructions & ID Proofs Required",
      fieldType: "textarea",
      isRequired: false,
      placeholder: "e.g., Carry original Photo ID (Aadhaar / Voter ID) + 2 passport photos",
      displayOrder: 50,
    },
    {
      fieldName: "reference_number",
      fieldLabel: "Notice Reference Number",
      fieldType: "text",
      isRequired: false,
      placeholder: "e.g., F.No. 1/4/2026-E.I(B)",
      displayOrder: 60,
    },
    {
      fieldName: "official_pdf_url",
      fieldLabel: "Official Notice PDF URL",
      fieldType: "url",
      isRequired: true,
      placeholder: "https://...",
      displayOrder: 70,
    },
  ],

  // 3. ANSWER KEY PROVISIONAL
  ANSWER_KEY_PROVISIONAL: [
    {
      fieldName: "release_date",
      fieldLabel: "Answer Key Release Date",
      fieldType: "date",
      isRequired: true,
      placeholder: "YYYY-MM-DD",
      displayOrder: 10,
    },
    {
      fieldName: "answer_key_type",
      fieldLabel: "Answer Key Type",
      fieldType: "select",
      isRequired: true,
      options: [
        { label: "Provisional / Tentative Key", value: "PROVISIONAL" },
        { label: "Master Question Paper & Key", value: "MASTER_KEY" },
        { label: "Subject-wise Key", value: "SUBJECT_WISE" },
      ],
      displayOrder: 20,
    },
    {
      fieldName: "objection_window_available",
      fieldLabel: "Is Objection / Challenge Window Open?",
      fieldType: "boolean",
      isRequired: true,
      helperText: "Toggle YES if candidates can submit representations against questions.",
      displayOrder: 30,
    },
    {
      fieldName: "objection_start_date",
      fieldLabel: "Objection Window Start",
      fieldType: "datetime",
      isRequired: false,
      conditionalOnField: "objection_window_available",
      conditionalValue: true,
      displayOrder: 40,
    },
    {
      fieldName: "objection_end_date",
      fieldLabel: "Objection Window Deadline",
      fieldType: "datetime",
      isRequired: false,
      conditionalOnField: "objection_window_available",
      conditionalValue: true,
      displayOrder: 50,
    },
    {
      fieldName: "objection_fee_per_question",
      fieldLabel: "Objection Fee Per Question (INR)",
      fieldType: "number",
      isRequired: false,
      placeholder: "e.g., 50 or 100",
      conditionalOnField: "objection_window_available",
      conditionalValue: true,
      displayOrder: 60,
    },
    {
      fieldName: "objection_portal_url",
      fieldLabel: "Objection Submission Portal Link",
      fieldType: "url",
      isRequired: false,
      placeholder: "https://...",
      conditionalOnField: "objection_window_available",
      conditionalValue: true,
      displayOrder: 70,
    },
    {
      fieldName: "official_pdf_url",
      fieldLabel: "Official Answer Key PDF Link",
      fieldType: "url",
      isRequired: true,
      placeholder: "https://...",
      displayOrder: 80,
    },
  ],

  // 4. EXAM DATE POSTPONED
  EXAM_DATE_POSTPONED: [
    {
      fieldName: "previous_exam_date",
      fieldLabel: "Original Scheduled Date",
      fieldType: "date",
      isRequired: false,
      placeholder: "YYYY-MM-DD",
      helperText: "Original date that is being postponed.",
      displayOrder: 10,
    },
    {
      fieldName: "new_date_available",
      fieldLabel: "Has a New Date Been Announced?",
      fieldType: "boolean",
      isRequired: true,
      helperText: "Select YES if new dates are finalized, or NO if to be decided (TBD).",
      displayOrder: 20,
    },
    {
      fieldName: "new_exam_date",
      fieldLabel: "Revised Examination Date",
      fieldType: "date",
      isRequired: false,
      conditionalOnField: "new_date_available",
      conditionalValue: true,
      displayOrder: 30,
    },
    {
      fieldName: "postponement_reason",
      fieldLabel: "Postponement Reason",
      fieldType: "textarea",
      isRequired: false,
      placeholder: "e.g., General Elections, administrative reasons, unavoidable circumstances",
      displayOrder: 40,
    },
    {
      fieldName: "official_pdf_url",
      fieldLabel: "Official Postponement Circular PDF",
      fieldType: "url",
      isRequired: true,
      placeholder: "https://...",
      displayOrder: 50,
    },
  ],

  // 5. SYLLABUS REVISED
  SYLLABUS_REVISED: [
    {
      fieldName: "effective_cycle_year",
      fieldLabel: "Effective Examination Year",
      fieldType: "number",
      isRequired: true,
      placeholder: "e.g., 2026",
      displayOrder: 10,
    },
    {
      fieldName: "change_summary",
      fieldLabel: "Summary of Changes",
      fieldType: "textarea",
      isRequired: true,
      placeholder: "Specify key sections modified, added topics, or scheme alteration...",
      displayOrder: 20,
    },
    {
      fieldName: "previous_syllabus_summary",
      fieldLabel: "Previous Syllabus Notes",
      fieldType: "textarea",
      isRequired: false,
      placeholder: "Historical comparison for candidate clarity.",
      displayOrder: 30,
    },
    {
      fieldName: "official_pdf_url",
      fieldLabel: "Revised Syllabus Official PDF URL",
      fieldType: "url",
      isRequired: true,
      placeholder: "https://...",
      displayOrder: 40,
    },
  ],

  // 6. RESULT RELEASED
  RESULT_RELEASED: [
    {
      fieldName: "result_type",
      fieldLabel: "Result Classification",
      fieldType: "select",
      isRequired: true,
      options: [
        { label: "Written Examination / Prelims Shortlist", value: "WRITTEN_RESULT" },
        { label: "Mains Examination Result", value: "MAINS_RESULT" },
        { label: "Interview / Personality Test Shortlist", value: "INTERVIEW_SHORTLIST" },
        { label: "Provisional Select List", value: "PROVISIONAL_LIST" },
        { label: "Final Selection Result", value: "FINAL_RESULT" },
      ],
      displayOrder: 10,
    },
    {
      fieldName: "result_date",
      fieldLabel: "Result Declaration Date",
      fieldType: "date",
      isRequired: true,
      placeholder: "YYYY-MM-DD",
      displayOrder: 20,
    },
    {
      fieldName: "total_candidates_qualified",
      fieldLabel: "Total Candidates Qualified",
      fieldType: "number",
      isRequired: false,
      placeholder: "e.g., 14620",
      displayOrder: 30,
    },
    {
      fieldName: "cut_off_available",
      fieldLabel: "Are Cut-off Marks Published?",
      fieldType: "boolean",
      isRequired: true,
      displayOrder: 40,
    },
    {
      fieldName: "result_pdf_url",
      fieldLabel: "Result Merit List PDF URL",
      fieldType: "url",
      isRequired: true,
      placeholder: "https://...",
      displayOrder: 50,
    },
    {
      fieldName: "cut_off_pdf_url",
      fieldLabel: "Cut-off Marks Document URL",
      fieldType: "url",
      isRequired: false,
      placeholder: "https://...",
      conditionalOnField: "cut_off_available",
      conditionalValue: true,
      displayOrder: 60,
    },
    {
      fieldName: "next_stage_instructions",
      fieldLabel: "Next Stage Instructions / DAF Schedule",
      fieldType: "textarea",
      isRequired: false,
      placeholder: "Instructions for qualified candidates...",
      displayOrder: 70,
    },
  ],

  // 7. VACANCY REVISED
  VACANCY_REVISED: [
    {
      fieldName: "previous_vacancies",
      fieldLabel: "Previous Total Vacancies",
      fieldType: "number",
      isRequired: false,
      placeholder: "e.g., 1056",
      displayOrder: 10,
    },
    {
      fieldName: "new_vacancies",
      fieldLabel: "Revised Total Vacancies",
      fieldType: "number",
      isRequired: true,
      placeholder: "e.g., 1206",
      displayOrder: 20,
    },
    {
      fieldName: "revision_type",
      fieldLabel: "Revision Nature",
      fieldType: "select",
      isRequired: true,
      options: [
        { label: "Vacancies Increased", value: "INCREASED" },
        { label: "Vacancies Decreased", value: "DECREASED" },
        { label: "Cadre / Category Reallocation", value: "REALLOCATED" },
      ],
      displayOrder: 30,
    },
    {
      fieldName: "change_details",
      fieldLabel: "Post / Cadre Breakdown Details",
      fieldType: "textarea",
      isRequired: false,
      placeholder: "Specify which departments or categories gained/lost posts...",
      displayOrder: 40,
    },
    {
      fieldName: "official_pdf_url",
      fieldLabel: "Vacancy Corrigendum PDF URL",
      fieldType: "url",
      isRequired: true,
      placeholder: "https://...",
      displayOrder: 50,
    },
  ],

  // 8. CORRIGENDUM (Multi-topic general)
  CORRIGENDUM: [
    {
      fieldName: "corrigendum_number",
      fieldLabel: "Corrigendum Number / Reference",
      fieldType: "text",
      isRequired: true,
      placeholder: "e.g., Corrigendum No. 1, Addendum-II",
      displayOrder: 10,
    },
    {
      fieldName: "amendment_summary",
      fieldLabel: "Amendment Summary",
      fieldType: "textarea",
      isRequired: true,
      placeholder: "State clearly what clauses of the original advertisement are modified...",
      displayOrder: 20,
    },
    {
      fieldName: "official_pdf_url",
      fieldLabel: "Official Corrigendum PDF URL",
      fieldType: "url",
      isRequired: true,
      placeholder: "https://...",
      displayOrder: 30,
    },
  ],

  // 9. FIRST / ORIGINAL NOTIFICATION (Create Mode)
  FIRST_NOTIFICATION: [
    {
      fieldName: "title",
      fieldLabel: "Official Notification Title",
      fieldType: "text",
      isRequired: true,
      placeholder: "e.g., Civil Services Examination 2026",
      displayOrder: 10,
    },
    {
      fieldName: "cycle_year",
      fieldLabel: "Cycle Year",
      fieldType: "number",
      isRequired: true,
      placeholder: "2026",
      displayOrder: 20,
    },
    {
      fieldName: "notification_number",
      fieldLabel: "Advertisement / Notice Number",
      fieldType: "text",
      isRequired: false,
      placeholder: "e.g., 05/2026-CSP",
      displayOrder: 30,
    },
    {
      fieldName: "total_vacancies",
      fieldLabel: "Total Vacancies",
      fieldType: "number",
      isRequired: false,
      placeholder: "e.g., 1056",
      displayOrder: 40,
    },
    {
      fieldName: "application_start_date",
      fieldLabel: "Application Start Date",
      fieldType: "date",
      isRequired: false,
      placeholder: "YYYY-MM-DD",
      displayOrder: 50,
    },
    {
      fieldName: "application_end_date",
      fieldLabel: "Application Closing Date",
      fieldType: "date",
      isRequired: true,
      placeholder: "YYYY-MM-DD",
      displayOrder: 60,
    },
    {
      fieldName: "exam_date",
      fieldLabel: "Scheduled Exam Date",
      fieldType: "text",
      isRequired: false,
      placeholder: "e.g., 2026-05-24",
      displayOrder: 70,
    },
    {
      fieldName: "official_pdf_url",
      fieldLabel: "Official Brochure PDF URL",
      fieldType: "url",
      isRequired: true,
      placeholder: "https://...",
      displayOrder: 80,
    },
    {
      fieldName: "apply_online_url",
      fieldLabel: "Online Application Portal URL",
      fieldType: "url",
      isRequired: false,
      placeholder: "https://...",
      displayOrder: 90,
    },
  ],
};

// Generic fallback field set for unspecified notification types
const DEFAULT_UPDATE_FIELDS: DynamicFormFieldConfig[] = [
  {
    fieldName: "title",
    fieldLabel: "Circular Title",
    fieldType: "text",
    isRequired: true,
    placeholder: "e.g., Important Notice regarding Candidate Verification",
    displayOrder: 10,
  },
  {
    fieldName: "event_date",
    fieldLabel: "Effective / Publication Date",
    fieldType: "date",
    isRequired: false,
    placeholder: "YYYY-MM-DD",
    displayOrder: 20,
  },
  {
    fieldName: "summary",
    fieldLabel: "Notice Summary & Key Points",
    fieldType: "textarea",
    isRequired: true,
    placeholder: "Summarize key instructions or updates for candidates...",
    displayOrder: 30,
  },
  {
    fieldName: "official_pdf_url",
    fieldLabel: "Official PDF Link",
    fieldType: "url",
    isRequired: true,
    placeholder: "https://...",
    displayOrder: 40,
  },
];

/**
 * Returns dynamic form field definitions for a given notification type.
 */
export function getFormFieldsForType(typeCode: string): DynamicFormFieldConfig[] {
  return FORM_FIELD_CONFIGS[typeCode] || DEFAULT_UPDATE_FIELDS;
}

// =============================================================================
// 2. DEPENDENCY VALIDATION ENGINE (Declarative Rules)
// =============================================================================

export interface FormValidationContext {
  notificationTypeCode: string;
  organizationCode: string;
  examMasterId?: string | null;
  examCycleId?: string | null;
  stageCode?: string | null;
  values: Record<string, unknown>;
  originalCycleData?: {
    application_end_date?: string | null;
    exam_date?: string | null;
    total_vacancies?: number | null;
  } | null;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Pure evaluation function enforcing government exam lifecycle business rules.
 */
export function validateDynamicLifecycleForm(ctx: FormValidationContext): ValidationResult {
  const errors: Record<string, string> = {};
  const meta: NotificationTypeMeta = getNotificationTypeMeta(ctx.notificationTypeCode);

  // 1. Exam Cycle requirement
  if (meta.requiresExistingExam && !ctx.examCycleId) {
    errors.examCycleId = "An existing Exam Cycle must be selected for this update type.";
  }

  // 2. Stage requirement
  if (meta.requiresStage && !ctx.stageCode) {
    errors.stageCode = "An applicable examination stage is required for this notification type.";
  }

  const v = ctx.values;

  // 3. Application Extension Rule: New closing date > Original closing date
  if (ctx.notificationTypeCode === "APPLICATION_EXTENSION") {
    const newClosing = typeof v.new_closing_date === "string" ? v.new_closing_date : null;
    const origClosing =
      typeof v.original_closing_date === "string"
        ? v.original_closing_date
        : ctx.originalCycleData?.application_end_date;

    if (!newClosing) {
      errors.new_closing_date = "New closing date is required.";
    } else if (origClosing && newClosing <= origClosing) {
      errors.new_closing_date = `The new extended closing date (${newClosing}) must be later than the original deadline (${origClosing}).`;
    }
  }

  // 4. Exam Date Postponement Rule: If new date announced, validate format
  if (ctx.notificationTypeCode === "EXAM_DATE_POSTPONED") {
    if (v.new_date_available === true && !v.new_exam_date) {
      errors.new_exam_date = "Please specify the revised exam date since you indicated a new date is available.";
    }
  }

  // 5. Admit card URL validation
  if (ctx.notificationTypeCode === "ADMIT_CARD_RELEASED") {
    if (!v.download_url) {
      errors.download_url = "Hall ticket download portal URL is required.";
    }
  }

  // 6. Generic required fields validation based on dynamic config
  const fields = getFormFieldsForType(ctx.notificationTypeCode);
  for (const f of fields) {
    // Check conditional visibility
    if (f.conditionalOnField && v[f.conditionalOnField] !== f.conditionalValue) {
      continue; // Skip validation if field is conditionally hidden
    }

    if (f.isRequired) {
      const val = v[f.fieldName];
      if (val === undefined || val === null || val === "") {
        errors[f.fieldName] = `${f.fieldLabel} is required.`;
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
