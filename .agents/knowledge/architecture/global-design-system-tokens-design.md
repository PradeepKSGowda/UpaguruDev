# Global Design System Tokens & Typography Architecture Design

## 1. Document Metadata
* **Document ID**: DESIGN-UI-001
* **Task Reference**: TASK-02010101 (Subtasks: SUB-0201010101, SUB-0201010102, SUB-0201010103)
* **Epic Reference**: EPIC-02 (Candidate Portal: Notification Feed, Detail Pages & Search)
* **Feature Reference**: FEAT-0201 (Global Application Shell & Design System)
* **User Story**: STORY-020101 (Root layout component and global design system)
* **Assigned Role**: UI/UX Designer
* **Architecture References**: ADR-001 (Frontend Architecture), ADR-008 (SEO & Core Web Vitals)
* **Status**: APPROVED

---

## 2. Objective & Design Philosophy
UPA-GURU delivers critical, time-sensitive central and state government exam notifications to job seekers across India. To ensure trust, effortless readability across entry-level smartphones, and high visual appeal, the design system adheres to three foundational pillars:

1. **High Information Clarity**: Clear visual hierarchy, distinct semantic badges for urgent application deadlines, and generous line heights.
2. **Accessibility & Contrast**: Strict compliance with WCAG 2.1 AA contrast standards ($\ge 4.5:1$ contrast ratio for all text elements in light and dark modes).
3. **Zero Layout Shift (CLS < 0.05)**: Standardized font loading via `next/font/google` with Latin subsets and `display: "swap"`, eliminating Flash of Unstyled Text (FOUT).

---

## 3. Core Design Tokens Architecture

### 3.1 Color Palette (HSL Harmonious System)

The color palette is architected using **HSL (Hue, Saturation, Lightness)** to allow programmatic lightness adjustments for dark mode transitions and subtle elevation tints.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           UPA-GURU COLOR PALETTE                            │
├───────────────────────┬─────────────────────────────┬───────────────────────┤
│ Token                 │ Light Mode (HSL / Hex)      │ Dark Mode (HSL / Hex) │
├───────────────────────┼─────────────────────────────┼───────────────────────┤
│ --color-primary       │ 221 83% 53% (#2563EB)       │ 217 91% 60% (#3B82F6) │
│ --color-secondary     │ 215 25% 27% (#334155)       │ 215 20% 65% (#94A3B8) │
│ --color-accent        │ 160 84% 39% (#059669)       │ 158 64% 52% (#34D399) │
│ --color-success       │ 142 76% 36% (#16A34A)       │ 142 71% 45% (#22C55E) │
│ --color-danger        │ 0 84% 60%   (#EF4444)       │ 0 84% 65%   (#F87171) │
│ --color-warning       │ 38 92% 50%  (#F59E0B)       │ 45 93% 47%  (#FBBF24) │
│ --background          │ 210 40% 98% (#F8FAFC)       │ 222 47% 7%  (#0B0F19) │
│ --foreground          │ 222 47% 11% (#0F172A)       │ 210 40% 98% (#F8FAFC) │
│ --card                │ 0 0% 100%   (#FFFFFF)       │ 222 47% 11% (#0F172A) │
│ --border              │ 214 32% 91% (#E2E8F0)       │ 217 33% 20% (#1E293B) │
└───────────────────────┴─────────────────────────────┴───────────────────────┘
```

* **Light Mode Activation**: Bound to `:root` pseudo-class.
* **Dark Mode Activation**: Triggered by `.dark` on `<html>` or `[data-theme='dark']` attribute.

---

### 3.2 Typography Scale & Font Architecture
UPA-GURU pairs two Google fonts:
* **`Inter`** (Variable: `--font-inter`): High-legibility neutral grotesque for body text, form fields, and metadata tables.
* **`Outfit`** (Variable: `--font-outfit`): Geometric sans-serif for brand identity, page headings, and statistical vacancy counts.

```
┌─────────────────┬───────────┬──────────────┬───────────────────────────────┐
│ Token           │ Size (px) │ Line Height  │ Typical Usage                 │
├─────────────────┼───────────┼──────────────┼───────────────────────────────┤
│ --font-xs       │ 12px      │ 16px (1.00)  │ Micro-tags, timestamps        │
│ --font-sm       │ 14px      │ 20px (1.25)  │ Badges, input labels, captions│
│ --font-base     │ 16px      │ 24px (1.50)  │ Body copy, primary links      │
│ --font-lg       │ 18px      │ 28px (1.75)  │ Subheadings, card titles      │
│ --font-xl       │ 20px      │ 28px (1.75)  │ Section subheadings           │
│ --font-2xl      │ 24px      │ 32px (2.00)  │ Modal & card group headers    │
│ --font-3xl      │ 30px      │ 36px (2.25)  │ Category & state headers      │
│ --font-4xl      │ 36px      │ 40px (2.50)  │ Homepage Hero heading         │
└─────────────────┴───────────┴──────────────┴───────────────────────────────┘
```

---

### 3.3 Spacing Scale (4px Base Grid)
Built on a standard 4px multiplication scale:
* `--space-1`: 4px (tight padding)
* `--space-2`: 8px (icon gaps, tag margins)
* `--space-3`: 12px (form input padding)
* `--space-4`: 16px (standard container padding)
* `--space-6`: 24px (card gutters)
* `--space-8`: 32px (section vertical rhythm)
* `--space-12`: 48px (major content divider)
* `--space-16`: 64px (hero vertical spacing)

---

### 3.4 Border Radius & Elevation Tokens
* **Radii**:
  * `--radius-sm` (4px), `--radius-md` (6px), `--radius-lg` (8px), `--radius-xl` (12px), `--radius-2xl` (16px), `--radius-full` (9999px).
* **Shadow Hierarchy**:
  * `--shadow-sm`: Flat UI surface boundaries.
  * `--shadow-md`: Interactive card hover elevation.
  * `--shadow-lg`: Sticky navigation header and dropdown menus.
  * `--shadow-xl`: Modal dialogs and floating search drawers.
