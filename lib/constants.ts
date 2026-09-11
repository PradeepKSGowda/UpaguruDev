/**
 * @file lib/constants.ts
 * @module AppConstants
 * @description Master portal constants for category filters, Indian states, sorting options,
 * and navigation metadata.
 * 
 * Task ID: TASK-02020103
 * Architecture Reference: ADR-001 (Frontend), ADR-002 (Database), ADR-008 (SEO)
 */

import type { ExamCategory } from "../types/notifications";

export interface CategoryFilterOption {
  id: string;
  category: ExamCategory | "all";
  label: string;
  shortLabel: string;
}

/**
 * Filter categories aligned with exam_category_enum
 */
export const CATEGORY_FILTER_OPTIONS: CategoryFilterOption[] = [
  { id: "filter-cat-all", category: "all", label: "All Categories", shortLabel: "All" },
  { id: "filter-cat-civil", category: "civil_services", label: "Civil Services", shortLabel: "Civil Services" },
  { id: "filter-cat-banking", category: "banking", label: "Banking & IBPS", shortLabel: "Banking" },
  { id: "filter-cat-railways", category: "railways", label: "Railways (RRB)", shortLabel: "Railways" },
  { id: "filter-cat-defense", category: "defense", label: "Defence & Military", shortLabel: "Defence" },
  { id: "filter-cat-state-psc", category: "state_psc", label: "State PSCs", shortLabel: "State PSC" },
  { id: "filter-cat-teaching", category: "teaching", label: "Teaching & Faculty", shortLabel: "Teaching" },
  { id: "filter-cat-police", category: "police", label: "Police & Security", shortLabel: "Police" },
  { id: "filter-cat-other", category: "other", label: "Other Exams", shortLabel: "Other" },
];

/**
 * Indian States and Union Territories for recruitment region filtering
 */
export const INDIAN_STATES_AND_REGIONS = [
  "Central",
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

/**
 * Public feed sort options
 */
export const SORT_OPTIONS = [
  { value: "deadline_soonest", label: "Closing Soonest" },
  { value: "deadline_latest", label: "Closing Latest" },
  { value: "recently_published", label: "Recently Added" },
  { value: "vacancies_high_low", label: "Highest Vacancies" },
  { value: "title_asc", label: "Alphabetical (A-Z)" },
] as const;
