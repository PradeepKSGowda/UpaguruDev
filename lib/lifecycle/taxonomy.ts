/**
 * @file lib/lifecycle/taxonomy.ts
 * @description Master Notification Taxonomy, Stage Hierarchy, and Field Configuration Model
 * for UPA-GURU Multi-Exam Recruitment Lifecycle Engine.
 * 
 * Complies with:
 * - UPSC, KPSC, SSC, RRB, IBPS stage structures
 * - All 22+ notification/update categories
 * - Strict non-destructive event versioning & conditional field graphs
 * - TypeScript strict mode (Zero `any`)
 * 
 * Architecture Reference: ADR-002, ADR-015 (Recruitment Lifecycle Graph)
 */

export type NotificationOperationType = "CREATE" | "UPDATE";

export type NotificationCategory =
  | "INITIAL_RECRUITMENT"
  | "APPLICATION"
  | "VACANCY"
  | "ELIGIBILITY"
  | "SYLLABUS_EXAM_SCHEME"
  | "EXAM_SCHEDULE"
  | "INTIMATION"
  | "ADMIT_CARD"
  | "ANSWER_KEY"
  | "RESPONSE_SHEET"
  | "RESULT"
  | "CUT_OFF"
  | "SCORECARD_MARKS"
  | "MERIT_RANK_LIST"
  | "INTERVIEW"
  | "SKILL_TEST"
  | "PHYSICAL_TEST"
  | "DOCUMENT_VERIFICATION"
  | "MEDICAL_EXAM"
  | "ALLOTMENT"
  | "APPOINTMENT_JOINING"
  | "CORRIGENDUM_GENERAL"
  | "CANCELLATION_WITHDRAWAL"
  | "OTHER";

export interface NotificationTypeMeta {
  code: string;
  category: NotificationCategory;
  label: string;
  operationType: NotificationOperationType;
  requiresExistingExam: boolean;
  requiresStage: boolean;
  description: string;
  iconName: string;
  badgeColor: string;
  defaultEventName?: string;
  relationshipType?: string; // Target relationship type, e.g. EXTENSION_OF, ADMIT_CARD_FOR
}

export interface DynamicFormFieldConfig {
  fieldName: string;
  fieldLabel: string;
  fieldType: "text" | "number" | "date" | "datetime" | "url" | "textarea" | "select" | "boolean" | "file";
  isRequired: boolean;
  placeholder?: string;
  helperText?: string;
  options?: Array<{ label: string; value: string | number }>;
  conditionalOnField?: string;
  conditionalValue?: unknown;
  displayOrder: number;
}

export interface StageDefinitionMeta {
  organizationCode: string;
  stageCode: string;
  stageLabel: string;
  stageOrder: number;
  description?: string;
}

// =============================================================================
// 1. MASTER NOTIFICATION TAXONOMY (All Categories)
// =============================================================================

export const NOTIFICATION_TAXONOMY: Record<string, NotificationTypeMeta> = {
  // A. INITIAL / RECRUITMENT
  FIRST_NOTIFICATION: {
    code: "FIRST_NOTIFICATION",
    category: "INITIAL_RECRUITMENT",
    label: "First / Original Notification",
    operationType: "CREATE",
    requiresExistingExam: false,
    requiresStage: false,
    description: "Original comprehensive recruitment advertisement initiating a new examination cycle.",
    iconName: "Sparkles",
    badgeColor: "emerald",
    defaultEventName: "Official Notification Released",
    relationshipType: "PRIMARY_NOTIFICATION",
  },
  RECRUITMENT_NOTIFICATION: {
    code: "RECRUITMENT_NOTIFICATION",
    category: "INITIAL_RECRUITMENT",
    label: "Recruitment Notification (Direct Selection)",
    operationType: "CREATE",
    requiresExistingExam: false,
    requiresStage: false,
    description: "Direct recruitment opening or single-window vacancy announcement.",
    iconName: "Briefcase",
    badgeColor: "emerald",
    defaultEventName: "Recruitment Advertisement Published",
    relationshipType: "PRIMARY_NOTIFICATION",
  },
  EXAM_SCHEME: {
    code: "EXAM_SCHEME",
    category: "INITIAL_RECRUITMENT",
    label: "Examination Scheme / Pattern Notice",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: false,
    description: "Official scheme of examination, mark weightage, and timing.",
    iconName: "LayoutList",
    badgeColor: "blue",
    defaultEventName: "Exam Scheme Released",
    relationshipType: "UPDATE_OF",
  },

  // B. APPLICATION
  APPLICATION_OPEN: {
    code: "APPLICATION_OPEN",
    category: "APPLICATION",
    label: "Application Window Open",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: false,
    description: "Commencement of candidate online application registration.",
    iconName: "Send",
    badgeColor: "indigo",
    defaultEventName: "Application Window Active",
    relationshipType: "UPDATE_OF",
  },
  APPLICATION_EXTENSION: {
    code: "APPLICATION_EXTENSION",
    category: "APPLICATION",
    label: "Application Deadline Extension",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: false,
    description: "Official extension of the last date for submitting online applications.",
    iconName: "CalendarClock",
    badgeColor: "amber",
    defaultEventName: "Application Deadline Extended",
    relationshipType: "EXTENSION_OF",
  },
  APPLICATION_CORRECTION_WINDOW: {
    code: "APPLICATION_CORRECTION_WINDOW",
    category: "APPLICATION",
    label: "Application Correction Window",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: false,
    description: "Window allowing candidates to correct mistakes in submitted forms.",
    iconName: "Edit3",
    badgeColor: "cyan",
    defaultEventName: "Form Correction Window Open",
    relationshipType: "UPDATE_OF",
  },
  APPLICATION_REOPENED: {
    code: "APPLICATION_REOPENED",
    category: "APPLICATION",
    label: "Application Window Re-opened",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: false,
    description: "Re-opening of application registration due to court directives or vacancies.",
    iconName: "RotateCcw",
    badgeColor: "amber",
    defaultEventName: "Applications Re-opened",
    relationshipType: "EXTENSION_OF",
  },

  // C. VACANCY
  VACANCY_REVISED: {
    code: "VACANCY_REVISED",
    category: "VACANCY",
    label: "Vacancies Revised (Increase / Decrease)",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: false,
    description: "Revision of total vacancies or cadre-wise quota allocation.",
    iconName: "TrendingUp",
    badgeColor: "amber",
    defaultEventName: "Vacancies Revised",
    relationshipType: "VACANCY_REVISION_OF",
  },

  // D. ELIGIBILITY
  ELIGIBILITY_UPDATE: {
    code: "ELIGIBILITY_UPDATE",
    category: "ELIGIBILITY",
    label: "Eligibility / Age Relaxation Revision",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: false,
    description: "Corrigendum modifying age limits, educational qualifications, or concessions.",
    iconName: "ShieldCheck",
    badgeColor: "violet",
    defaultEventName: "Eligibility Terms Revised",
    relationshipType: "CORRIGENDUM_OF",
  },

  // E. SYLLABUS
  SYLLABUS_REVISED: {
    code: "SYLLABUS_REVISED",
    category: "SYLLABUS_EXAM_SCHEME",
    label: "Syllabus Revised / Corrigendum",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: false,
    description: "Updated syllabus or topic alterations released by commission.",
    iconName: "BookCheck",
    badgeColor: "purple",
    defaultEventName: "Syllabus Revised",
    relationshipType: "SYLLABUS_FOR",
  },

  // F. EXAM SCHEDULE
  EXAM_DATE_ANNOUNCED: {
    code: "EXAM_DATE_ANNOUNCED",
    category: "EXAM_SCHEDULE",
    label: "Exam Date Announced",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: true,
    description: "Official schedule/timetable announced for a specific stage.",
    iconName: "Calendar",
    badgeColor: "blue",
    defaultEventName: "Exam Date Announced",
    relationshipType: "UPDATE_OF",
  },
  EXAM_DATE_POSTPONED: {
    code: "EXAM_DATE_POSTPONED",
    category: "EXAM_SCHEDULE",
    label: "Examination Postponed / Rescheduled",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: true,
    description: "Official postponement notice deferring scheduled examination date.",
    iconName: "CalendarX",
    badgeColor: "rose",
    defaultEventName: "Examination Postponed",
    relationshipType: "DATE_CHANGE_OF",
  },

  // G. INTIMATION
  CITY_INTIMATION_RELEASED: {
    code: "CITY_INTIMATION_RELEASED",
    category: "INTIMATION",
    label: "City Intimation Slip Released",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: true,
    description: "Advance intimation slip disclosing examination city to candidates.",
    iconName: "MapPin",
    badgeColor: "sky",
    defaultEventName: "City Intimation Slip Active",
    relationshipType: "UPDATE_OF",
  },

  // H. ADMIT CARD
  ADMIT_CARD_RELEASED: {
    code: "ADMIT_CARD_RELEASED",
    category: "ADMIT_CARD",
    label: "Admit Card / Hall Ticket Released",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: true,
    description: "Official release of hall ticket download link for candidates.",
    iconName: "Ticket",
    badgeColor: "emerald",
    defaultEventName: "Admit Card Available for Download",
    relationshipType: "ADMIT_CARD_FOR",
  },

  // I. ANSWER KEY
  ANSWER_KEY_PROVISIONAL: {
    code: "ANSWER_KEY_PROVISIONAL",
    category: "ANSWER_KEY",
    label: "Provisional Answer Key Released",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: true,
    description: "Tentative answer key along with objection filing window.",
    iconName: "Key",
    badgeColor: "indigo",
    defaultEventName: "Provisional Answer Key Released",
    relationshipType: "ANSWER_KEY_FOR",
  },
  ANSWER_KEY_FINAL: {
    code: "ANSWER_KEY_FINAL",
    category: "ANSWER_KEY",
    label: "Final Answer Key Released",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: true,
    description: "Verified definitive answer key post objection scrutiny.",
    iconName: "KeyRound",
    badgeColor: "emerald",
    defaultEventName: "Final Answer Key Published",
    relationshipType: "ANSWER_KEY_FOR",
  },

  // J. RESPONSE SHEET
  RESPONSE_SHEET_RELEASED: {
    code: "RESPONSE_SHEET_RELEASED",
    category: "RESPONSE_SHEET",
    label: "Candidate Response Sheet Released",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: true,
    description: "Release of marked candidate response sheets with question paper.",
    iconName: "FileSpreadsheet",
    badgeColor: "teal",
    defaultEventName: "Response Sheets Available",
    relationshipType: "UPDATE_OF",
  },

  // K. RESULT
  RESULT_RELEASED: {
    code: "RESULT_RELEASED",
    category: "RESULT",
    label: "Stage / Written Examination Result",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: true,
    description: "Declaration of candidate roll numbers qualified for the next stage.",
    iconName: "Award",
    badgeColor: "emerald",
    defaultEventName: "Examination Result Declared",
    relationshipType: "RESULT_FOR",
  },
  FINAL_RESULT: {
    code: "FINAL_RESULT",
    category: "RESULT",
    label: "Final Merit List / Recommendation Result",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: true,
    description: "Final select list concluding the entire examination cycle.",
    iconName: "Trophy",
    badgeColor: "emerald",
    defaultEventName: "Final Selection Result Declared",
    relationshipType: "RESULT_FOR",
  },

  // L. CUT-OFF
  CUT_OFF_RELEASED: {
    code: "CUT_OFF_RELEASED",
    category: "CUT_OFF",
    label: "Category-wise Cut-off Marks Released",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: true,
    description: "Minimum qualifying cutoff scores across categories.",
    iconName: "BarChart2",
    badgeColor: "blue",
    defaultEventName: "Cut-off Marks Declared",
    relationshipType: "CUT_OFF_FOR",
  },

  // M. SCORECARD
  SCORECARD_RELEASED: {
    code: "SCORECARD_RELEASED",
    category: "SCORECARD_MARKS",
    label: "Scorecard / Individual Marks Portal",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: true,
    description: "Individual candidate scorecard or marks breakdown login.",
    iconName: "CheckSquare",
    badgeColor: "blue",
    defaultEventName: "Candidate Marks Available",
    relationshipType: "UPDATE_OF",
  },

  // N. INTERVIEW
  INTERVIEW_SCHEDULE: {
    code: "INTERVIEW_SCHEDULE",
    category: "INTERVIEW",
    label: "Interview / Personality Test Schedule",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: true,
    description: "Dates, reporting time, and roll number day-wise interview timetable.",
    iconName: "UsersRound",
    badgeColor: "violet",
    defaultEventName: "Interview Schedule Released",
    relationshipType: "INTERVIEW_NOTICE_FOR",
  },

  // O. DOCUMENT VERIFICATION & MEDICAL
  DOCUMENT_VERIFICATION_NOTICE: {
    code: "DOCUMENT_VERIFICATION_NOTICE",
    category: "DOCUMENT_VERIFICATION",
    label: "Document Verification (DV) Schedule",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: true,
    description: "Instructions, certificates required, and reporting venue for DV.",
    iconName: "FileCheck",
    badgeColor: "cyan",
    defaultEventName: "Document Verification Schedule",
    relationshipType: "UPDATE_OF",
  },

  // P. ALLOTMENT & JOINING
  SERVICE_ALLOCATION: {
    code: "SERVICE_ALLOCATION",
    category: "ALLOTMENT",
    label: "Service / Cadre Allocation List",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: false,
    description: "Allocation of successful candidates to specific ministries/cadres.",
    iconName: "Layers",
    badgeColor: "blue",
    defaultEventName: "Service Allocation Announced",
    relationshipType: "UPDATE_OF",
  },
  JOINING_NOTICE: {
    code: "JOINING_NOTICE",
    category: "APPOINTMENT_JOINING",
    label: "Appointment / Joining Instructions",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: false,
    description: "Final appointment letter issuance and reporting instructions.",
    iconName: "CheckCheck",
    badgeColor: "emerald",
    defaultEventName: "Joining Instructions Issued",
    relationshipType: "UPDATE_OF",
  },

  // Q. CORRIGENDUM
  CORRIGENDUM: {
    code: "CORRIGENDUM",
    category: "CORRIGENDUM_GENERAL",
    label: "Official Corrigendum / Amendment",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: false,
    description: "General amendment modifying one or more clauses of the advertisement.",
    iconName: "FileCode",
    badgeColor: "amber",
    defaultEventName: "Official Corrigendum Published",
    relationshipType: "CORRIGENDUM_OF",
  },
  IMPORTANT_NOTICE: {
    code: "IMPORTANT_NOTICE",
    category: "CORRIGENDUM_GENERAL",
    label: "Important Notice / Advisory",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: false,
    description: "General advisory or press communique for candidate awareness.",
    iconName: "Info",
    badgeColor: "blue",
    defaultEventName: "Important Advisory Issued",
    relationshipType: "CLARIFIES",
  },

  // R. CANCELLATION
  RECRUITMENT_CANCELLED: {
    code: "RECRUITMENT_CANCELLED",
    category: "CANCELLATION_WITHDRAWAL",
    label: "Recruitment / Examination Cancelled",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: false,
    description: "Official scrapping or withdrawal of recruitment cycle.",
    iconName: "Ban",
    badgeColor: "rose",
    defaultEventName: "Recruitment Withdrawn / Cancelled",
    relationshipType: "WITHDRAWAL_OF",
  },

  // S. OTHER
  OTHER: {
    code: "OTHER",
    category: "OTHER",
    label: "Other Official Circular",
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: false,
    description: "Unclassified circular requiring administrator review.",
    iconName: "HelpCircle",
    badgeColor: "slate",
    defaultEventName: "Official Circular",
    relationshipType: "RELATED_TO",
  },
};

// =============================================================================
// 2. ORGANIZATION-SPECIFIC STAGE DEFINITIONS
// =============================================================================

export const ORGANIZATION_STAGES: Record<string, StageDefinitionMeta[]> = {
  UPSC: [
    { organizationCode: "UPSC", stageCode: "PRELIMS", stageLabel: "Preliminary Examination (Objective)", stageOrder: 1, description: "GS Paper I and CSAT Paper II screening" },
    { organizationCode: "UPSC", stageCode: "MAINS", stageLabel: "Main Examination (Written Descriptive)", stageOrder: 2, description: "Descriptive essay and optional papers" },
    { organizationCode: "UPSC", stageCode: "INTERVIEW", stageLabel: "Personality Test / Interview", stageOrder: 3, description: "Board interview at Dholpur House" },
    { organizationCode: "UPSC", stageCode: "FINAL_SELECTION", stageLabel: "Final Recommendation / Allocation", stageOrder: 4, description: "Final merit list based on Mains + Interview" },
  ],
  SSC: [
    { organizationCode: "SSC", stageCode: "TIER_1", stageLabel: "Tier-I Examination (CBT)", stageOrder: 1, description: "Objective screening CBT" },
    { organizationCode: "SSC", stageCode: "TIER_2", stageLabel: "Tier-II Examination (CBT)", stageOrder: 2, description: "Scoring examination" },
    { organizationCode: "SSC", stageCode: "SKILL_TEST", stageLabel: "Skill / Typing / Data Entry Test", stageOrder: 3, description: "Qualifying speed/proficiency test" },
    { organizationCode: "SSC", stageCode: "DOCUMENT_VERIFICATION", stageLabel: "Document Verification", stageOrder: 4, description: "Certificate validation" },
    { organizationCode: "SSC", stageCode: "FINAL_SELECTION", stageLabel: "Final Selection / Allotment", stageOrder: 5, description: "Final merit ranking" },
  ],
  RRB: [
    { organizationCode: "RRB", stageCode: "CBT_1", stageLabel: "1st Stage CBT (Screening)", stageOrder: 1, description: "Computer Based Test 1" },
    { organizationCode: "RRB", stageCode: "CBT_2", stageLabel: "2nd Stage CBT (Technical/Scoring)", stageOrder: 2, description: "Computer Based Test 2" },
    { organizationCode: "RRB", stageCode: "CBAT", stageLabel: "Computer-Based Aptitude Test (CBAT)", stageOrder: 3, description: "Aptitude test for Station Master" },
    { organizationCode: "RRB", stageCode: "TYPING_TEST", stageLabel: "Typing Skill Test", stageOrder: 4, description: "Qualifying speed test" },
    { organizationCode: "RRB", stageCode: "PET", stageLabel: "Physical Efficiency Test (PET)", stageOrder: 5, description: "Running & weight carrying" },
    { organizationCode: "RRB", stageCode: "DOCUMENT_VERIFICATION", stageLabel: "Document Verification", stageOrder: 6, description: "Original certificate scrutiny" },
    { organizationCode: "RRB", stageCode: "MEDICAL_EXAM", stageLabel: "Railway Medical Examination", stageOrder: 7, description: "Railway hospital vision & fitness" },
  ],
  IBPS: [
    { organizationCode: "IBPS", stageCode: "PRELIMS", stageLabel: "Preliminary Online Exam", stageOrder: 1, description: "Speed test (Reasoning, Quant, English)" },
    { organizationCode: "IBPS", stageCode: "MAINS", stageLabel: "Main Online Examination", stageOrder: 2, description: "Scoring test with descriptive test" },
    { organizationCode: "IBPS", stageCode: "INTERVIEW", stageLabel: "Common Interview Process", stageOrder: 3, description: "Coordinated interview panel" },
    { organizationCode: "IBPS", stageCode: "PROVISIONAL_ALLOTMENT", stageLabel: "Provisional Allotment", stageOrder: 4, description: "Bank wise candidate allotment" },
  ],
  KPSC: [
    { organizationCode: "KPSC", stageCode: "PRELIMS", stageLabel: "Preliminary Examination", stageOrder: 1, description: "General Studies objective screening" },
    { organizationCode: "KPSC", stageCode: "MAINS", stageLabel: "Main Written Examination", stageOrder: 2, description: "Descriptive written papers" },
    { organizationCode: "KPSC", stageCode: "KANNADA_TEST", stageLabel: "Compulsory Kannada Language Test", stageOrder: 3, description: "Mandatory SSLC standard paper" },
    { organizationCode: "KPSC", stageCode: "PERSONALITY_TEST", stageLabel: "Personality Test / Interview", stageOrder: 4, description: "Udyoga Soudha interview" },
    { organizationCode: "KPSC", stageCode: "PROVISIONAL_SELECT_LIST", stageLabel: "Provisional Select List (PSL)", stageOrder: 5, description: "Rank list for objections" },
    { organizationCode: "KPSC", stageCode: "FINAL_SELECT_LIST", stageLabel: "Final Select List (FSL)", stageOrder: 6, description: "Gazetted appointment list" },
  ],
};

// Generic fallback stages for state/autonomous organizations
export const DEFAULT_STAGES: StageDefinitionMeta[] = [
  { organizationCode: "ALL", stageCode: "WRITTEN_EXAM", stageLabel: "Written / Online Examination", stageOrder: 1 },
  { organizationCode: "ALL", stageCode: "INTERVIEW", stageLabel: "Interview / Viva-Voce", stageOrder: 2 },
  { organizationCode: "ALL", stageCode: "DOCUMENT_VERIFICATION", stageLabel: "Document Verification", stageOrder: 3 },
  { organizationCode: "ALL", stageCode: "FINAL_SELECTION", stageLabel: "Final Selection List", stageOrder: 4 },
];

/**
 * Returns available stages for an organization.
 */
export function getStagesForOrganization(orgCode?: string | null): StageDefinitionMeta[] {
  if (!orgCode) return DEFAULT_STAGES;
  const upper = orgCode.toUpperCase().trim();
  return ORGANIZATION_STAGES[upper] || DEFAULT_STAGES;
}

/**
 * Returns metadata for a given notification type code.
 */
export function getNotificationTypeMeta(code: string): NotificationTypeMeta {
  return NOTIFICATION_TAXONOMY[code] || {
    code,
    category: "OTHER",
    label: code.replace(/_/g, " "),
    operationType: "UPDATE",
    requiresExistingExam: true,
    requiresStage: false,
    description: "Custom notification circular",
    iconName: "FileText",
    badgeColor: "slate",
  };
}
