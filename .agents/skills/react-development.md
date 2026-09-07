# Skill: React & Next.js 15 Development (`react-development.md`)

## Input
- **Component Purpose & Type**: Page route, React Server Component (RSC), or interactive Client Component (`"use client"`).
- **Component Props & State Contract**: TypeScript interface defining inputs, callbacks, and expected data models.
- **Visual & UX Specifications**: Design tokens, layout requirements, mobile breakpoints, and micro-animations.
- **Accessibility Requirements**: ARIA roles, labels, keyboard navigation, and color contrast standards.
- **Data Dependencies**: Supabase data fetching requirements, Suspense boundary definitions, or Server Action triggers.

---

## Output
- **Production-Ready `.tsx` Component**: Modular, typed React component adhering to Next.js 15 App Router standards.
- **TypeScript Interface Declarations**: Complete type coverage with zero `any` or suppressed type errors.
- **Tailwind CSS / Vanilla CSS Styling**: Clean, responsive styles with hover/focus states, dark mode, and mobile-first rules.
- **Unique Test Locators**: Unique `id` and `data-testid` attributes on all interactive elements for Playwright automation.
- **Loading Skeleton & Error Boundary**: Fallback UI components for graceful degradation.

---

## Checklist
- [ ] Server Component by default; `"use client"` directive restricted strictly to interactive boundary leaves.
- [ ] All interactive elements (`<button>`, `<input>`, `<a>`, `<select>`) have unique, descriptive `id` attributes.
- [ ] Mobile-first responsive layout tested across 320px, 768px, 1024px, and 1440px viewports.
- [ ] WCAG 2.1 AA accessibility satisfied: minimum 4.5:1 text contrast, visible focus rings, `aria-label` where text is absent.
- [ ] Dynamic data fetches wrapped in `<Suspense fallback={<Skeleton />}>` boundaries.
- [ ] Images optimized via `next/image` with explicit `width`, `height`, and descriptive `alt` text.
- [ ] Fonts imported via `next/font/google` (Inter/Outfit); no browser-default type rendering.
- [ ] No inline secret references; client components never access server-only environment variables.
- [ ] Zero lint warnings, zero TypeScript errors (`strict: true`).

---

## Prompt Template
```markdown
You are the Frontend Engineer Agent for UPA-GURU.
Build the Next.js 15 component: [COMPONENT_NAME]

Component Type: [SERVER_COMPONENT | CLIENT_COMPONENT]
Target Route / Location: [FILE_PATH]
Props Interface: [DESCRIBE_PROPS]
Interactive State: [DESCRIBE_STATE_IF_CLIENT]

Requirements:
1. Adhere to Next.js 15 App Router conventions and React 19 standards.
2. If Client Component: use "use client" at top, handle debounced input or transitions cleanly.
3. If Server Component: fetch data directly from Supabase, pass typed props to child components.
4. Style with Tailwind CSS / CSS variables following UPA-GURU modern palette.
5. Add unique id and data-testid attributes to all interactive elements.
6. Ensure WCAG 2.1 AA accessibility (focus rings, semantic HTML, ARIA labels).
7. Include complete TypeScript types and JSDoc docstrings.
```

---

## Examples

### Example 1: React Server Component (`NotificationCard.tsx`)
```tsx
/**
 * Component: NotificationCard (Server Component)
 * Intent: Displays a single government exam notification card with countdown badge and metadata.
 * Inputs: NotificationCardProps (notification data)
 * Outputs: Rendered semantic article element with links to detail page
 */
import React from "react";
import Link from "next/link";

export interface NotificationCardProps {
  id: string;
  slug: string;
  title: string;
  conductingBody: string;
  totalVacancies: number;
  applicationEndDate: string;
  category: string;
  stateOrCentral: string;
}

function calculateDaysRemaining(endDateStr: string): number {
  const diffTime = new Date(endDateStr).getTime() - new Date().getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function NotificationCard({
  id,
  slug,
  title,
  conductingBody,
  totalVacancies,
  applicationEndDate,
  category,
  stateOrCentral,
}: NotificationCardProps) {
  const daysLeft = calculateDaysRemaining(applicationEndDate);
  const isUrgent = daysLeft >= 0 && daysLeft <= 5;
  const isExpired = daysLeft < 0;

  return (
    <article
      id={`notification-card-${id}`}
      data-testid={`notification-card-${slug}`}
      className="group relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
          {conductingBody}
        </span>
        <span
          id={`deadline-badge-${id}`}
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            isExpired
              ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              : isUrgent
              ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 animate-pulse"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          }`}
        >
          {isExpired ? "Application Closed" : `${daysLeft} days left`}
        </span>
      </div>

      <h3 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-blue-600 transition-colors">
        <Link
          id={`notification-link-${slug}`}
          href={`/notification/${slug}`}
          className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          {title}
        </Link>
      </h3>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
        <div>
          <span className="block text-xs uppercase tracking-wider text-slate-400">Vacancies</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {totalVacancies > 0 ? totalVacancies.toLocaleString() : "Not Disclosed"}
          </span>
        </div>
        <div>
          <span className="block text-xs uppercase tracking-wider text-slate-400">Jurisdiction</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">{stateOrCentral}</span>
        </div>
      </div>
    </article>
  );
}
```

---

## Failure Conditions
- **RSC Pollution**: Adding `"use client"` to components that only render static content or data lists.
- **Missing Test Locators**: Elements lacking unique IDs or `data-testid` attributes required for Playwright E2E testing.
- **Layout Shift (CLS > 0.1)**: Dynamically popping in content without reserving aspect ratio or skeleton space.
- **Accessibility Violations**: Interactive buttons with icons but no `aria-label`, or contrast ratio < 4.5:1.
- **Type Suppression**: Using `as any`, `@ts-ignore`, or loose type interfaces.
