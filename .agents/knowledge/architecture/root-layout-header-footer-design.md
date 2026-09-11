# Root Layout, Header, Footer & Mobile Navigation Architecture Design

## 1. Document Metadata
* **Document ID**: DESIGN-SHELL-001
* **Task Reference**: TASK-02010102 (Subtasks: SUB-0201010201, SUB-0201010202, SUB-0201010203)
* **Epic Reference**: EPIC-02 (Candidate Portal: Notification Feed, Detail Pages & Search)
* **Feature Reference**: FEAT-0201 (Global Application Shell & Design System)
* **User Story**: STORY-020101 (Root layout component and global design system)
* **Assigned Role**: Frontend Engineer
* **Architecture References**: ADR-001 (Frontend Architecture), ADR-008 (SEO Strategy), ADR-013 (Security)
* **Status**: APPROVED

---

## 2. Objective & System Architecture
The application shell represents the persistent frame wrapping all pages across the UPA-GURU portal. It must provide:
1. **Responsive Header (`components/layout/Header.tsx`)**: Sticky glassmorphic navigation bar displaying brand identity, core links (Home, Notifications, Categories, About), quick search trigger (`⌘K`), candidate auth actions (Sign In / Get Alerts), and mobile menu toggle.
2. **Accessible Mobile Navigation Drawer (`components/layout/MobileNav.tsx`)**: Slide-out drawer with body scroll locking, touch-friendly touch targets ($\ge 44\text{px}$), and smooth escape/click-outside dismiss actions.
3. **Comprehensive Footer (`components/layout/Footer.tsx`)**: Authoritative footer featuring government exam boards, resource links, trust/verification badges, statutory disclaimers, and legal links (Privacy Policy, Terms of Service).
4. **Root Layout (`app/layout.tsx`)**: Integrates Google font variables (`--font-inter`, `--font-outfit`), viewport configurations, and wraps all page content.
5. **Automated Testing Enablement**: Every interactive link and button provides a deterministic, unique HTML `id` for Playwright end-to-end testing.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RootLayout (app/layout.tsx)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                  Header Component (components/layout/Header.tsx)        │ │
│ │  [Logo: UG] [Home] [Notifications] [Categories] [About] [Search] [Auth] │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                  Page Content Slot: <main className="flex-1">           │ │
│ │                  (Home, /notification/[slug], Search, etc.)             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                  Footer Component (components/layout/Footer.tsx)        │ │
│ │  [Brand Mission] [Exam Boards] [Aspirant Resources] [Trust & Legal]     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │          MobileNav Drawer (Modal Overlay - Active on Small Viewports)   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Breakdown & Specifications

### 3.1 Header (`Header.tsx`)
* **State Management**: Controls `isMobileMenuOpen` state.
* **Sticky Elevation**: `sticky top-0 z-40 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b`.
* **Testing IDs**:
  * `header-brand-logo-link`
  * `header-nav-link-home`
  * `header-nav-link-notifications`
  * `header-nav-link-categories`
  * `header-nav-link-about`
  * `header-search-trigger-btn`
  * `header-login-btn`
  * `header-register-btn`
  * `header-mobile-menu-toggle-btn`

### 3.2 Mobile Drawer (`MobileNav.tsx`)
* **Scroll Lock**: Sets `document.body.style.overflow = "hidden"` upon mount when `isOpen = true`, preventing background scrolling.
* **Accessibility**: Implements `aria-modal="true"` and `role="dialog"`, with `Escape` key listener.
* **Testing IDs**:
  * `nav-mobile-close-btn`
  * `nav-mobile-search-btn`
  * `nav-mobile-home-link`
  * `nav-mobile-notifications-link`
  * `nav-mobile-categories-link`
  * `nav-mobile-about-link`
  * `nav-mobile-login-btn`
  * `nav-mobile-register-btn`

### 3.3 Footer (`Footer.tsx`)
* **Server Component**: Pure React Server Component (RSC) rendered without client-side hydration penalty.
* **Legal Disclosures**: Explicit disclaimer highlighting that UPA-GURU is an independent educational intelligence portal that references verified government circulars.
* **Testing IDs**:
  * `footer-brand-logo-link`
  * `footer-link-upsc`, `footer-link-ssc`, `footer-link-rrb`, `footer-link-banking`, `footer-link-state-psc`
  * `footer-link-live-feed`, `footer-link-search`, `footer-link-alerts`, `footer-link-login`
  * `footer-link-about`, `footer-link-privacy`, `footer-link-terms`, `footer-link-disclaimer`, `footer-link-contact`
