# Smart Eligibility Matching Engine Design (ENH-0009)

## 1. Executive Summary & Purpose
The **Smart Eligibility Matching Engine** (`lib/matching/eligibility-engine.ts`) is a high-performance, pure-function evaluation engine designed to match candidate profiles to active government exam notifications. Government examinations in India feature intricate, multi-dimensional qualification criteria, including reservation category age relaxations, hierarchical educational qualifications, and domicile state restrictions. 

This engine eliminates manual search friction by scoring and sorting active notifications with transparent, itemized dimension breakdowns.

---

## 2. Multi-Dimensional Matching Model

### 2.1 Dimension Weights
The composite eligibility score (0–100) is calculated via weighted average across 4 key dimensions:

| Dimension | Weight | Criteria Evaluated | Status Values |
|---|---|---|---|
| **Age** | 30% | Candidate completed age vs. `[age_limit_min, age_limit_max + relaxation]` | `eligible`, `ineligible`, `unknown` |
| **Qualification** | 30% | Candidate educational qualifications vs. `qualification_required[]` hierarchy | `eligible`, `ineligible`, `unknown` |
| **State / Domicile** | 20% | Candidate `state` vs. exam `state_or_central` (Central exams open to all) | `eligible`, `ineligible`, `unknown` |
| **Deadline Urgency** | 20% | Days remaining until `application_end_date` | `eligible` (>7d), `expiring` (≤7d), `ineligible` (<0d) |

Threshold for `isEligible`: **Composite score >= 50%**.

### 2.2 Category-Based Age Relaxation
Age relaxation is applied on top of the notification's base `age_limit_max`:

```typescript
export const AGE_RELAXATION: Record<string, number> = {
  GM: 0,
  General: 0,
  OBC: 3,
  SC: 5,
  ST: 5,
  EWS: 0,
  "Ex-Servicemen": 5,
  PwD: 10,
};
```

### 2.3 Qualification Hierarchy
Higher qualifications automatically qualify candidates for lower prerequisite tiers:

```
8th < 10th < 12th < ITI < Diploma < Graduate < Post Graduate < Engineering < Medical < Law < PhD
```
Candidates matching any qualification at or above the minimum required tier are marked `eligible`. Exact string fallback matching is provided for specialized disciplines.

---

## 3. Database Schema & Row Level Security

Migration: `supabase/migrations/20260925_eligibility_matching.sql`

### 3.1 Tables
- **`candidate_eligibility_preferences`**:
  - `user_id` (UUID, UNIQUE, FK to `auth.users`)
  - `qualifications` (TEXT[]): Candidate education credentials
  - `include_all_india_exams` (BOOLEAN DEFAULT true)
  - `include_state_exams` (BOOLEAN DEFAULT true)
  - `preferred_categories` (TEXT[] DEFAULT '{}')

- **`eligibility_matches`**:
  - `user_id` (UUID, FK to `auth.users`)
  - `notification_id` (UUID, FK to `public.notifications`)
  - `overall_score` (INTEGER 0–100)
  - `is_eligible` (BOOLEAN)
  - `dimension_details` (JSONB)
  - `expires_at` (TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days')

### 3.2 Row Level Security (RLS)
- Both tables enforce mandatory RLS.
- Candidates have full CRUD access over their own records (`auth.uid() = user_id`).
- Administrators with `analytics:kpi:read` and `users:read:all` can read match logs for aggregate candidate engagement metrics.

---

## 4. API & Component Architecture

### 4.1 Server Actions (`app/dashboard/eligibility/actions.ts`)
- `getEligibilityMatches(filters)`: Resolves candidate profile + qualifications, fetches active published notifications with exam metadata, evaluates matches via `matchCandidateToNotifications()`, filters, and paginates.
- `getEligibilityPreferences()`: Fetches candidate qualifications and exam scope preferences.
- `saveEligibilityPreferences(input)`: Validates payload with Zod `eligibilityPreferencesSchema`, upserts preferences, and revalidates `/dashboard` and `/dashboard/eligibility`.

### 4.2 Frontend Architecture
- **Tab Navigation**: `DashboardNav.tsx` includes an "Eligible Exams" tab targeting `/dashboard/eligibility`.
- **Server Page**: `app/dashboard/eligibility/page.tsx` pre-fetches matches and preferences in parallel via React Server Components.
- **Client Workspace**: `components/dashboard/EligibilityMatchesList.tsx`:
  - Profile accuracy meter and active eligible exam counts.
  - Interactive qualification selection tags with instant saving.
  - Minimum match score filter (0%, 50%+, 80%+, 100%) and sorting.
  - Expandable dimension breakdown chips with human-readable rationale.

---

## 5. Verification & Testing Strategy
- Unit test suite: `tests/unit/eligibility-engine.test.ts`
- 30 tests covering:
  - Age calculation edge cases (birthdays passed, upcoming, leap years)
  - Category-based reservation relaxation (+3 OBC, +5 SC/ST)
  - Qualification hierarchy traversal
  - Central vs. State domicile filtering
  - Deadline countdown and expiration filtering
  - Dimension weighting math and overall ranking logic
