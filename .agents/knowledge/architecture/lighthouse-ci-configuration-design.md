# Architecture Knowledge: Lighthouse CI Configuration & Score Assertions

**Status**: Standard Architecture Knowledge  
**Module**: Testing, QA & Lighthouse Performance Validation (`EPIC-09` / `FEAT-0903`)  
**Applicable Tasks**: `TASK-09030101` (Subtask: `SUB-0903010101`)  
**Last Updated**: 2026-09-20  

---

## 1. Overview & Operational Mandate
To ensure UPA-GURU maintains industry-leading mobile performance, SEO visibility, and user retention for candidates on lower-end devices and cellular networks (2G/3G/4G), Lighthouse CI (`@lhci/cli`) is integrated into the automated quality assurance pipeline.

Per **`AGENTS.md` Rule 4 (SEO & Performance Rules)**:
> **Lighthouse Target**: Mobile SEO & Performance score must meet or exceed 95.

---

## 2. Configuration Architecture (`lighthouserc.js`)

Lighthouse CI is configured with three distinct operational phases:

### Phase 1: Collect (`ci.collect`)
- **Emulation**: Mobile form factor ($390 \times 844$ viewport, 3x DPR) simulating mobile devices via simulated throttling (150ms RTT, 1.6 Mbps throughput, 4x CPU slowdown).
- **Run Multiplicity**: `numberOfRuns: 3` executes three runs per URL and evaluates the median run, mitigating transient network or CPU spikes.
- **Server Lifecycle**: Spawns local Next.js server (`npm run start`) and awaits the `ready on|started server on` regex pattern before commencing audits.

### Phase 2: Assert (`ci.assert`)
Scores and numeric thresholds are strictly verified against predefined thresholds:

| Metric / Category | Level | Threshold | Rationale |
| :--- | :--- | :--- | :--- |
| `categories:performance` | `error` | $\ge 0.95$ | Mandatory `AGENTS.md` Rule 4 requirement |
| `categories:seo` | `error` | $\ge 0.95$ | Mandatory `AGENTS.md` Rule 4 requirement |
| `categories:accessibility` | `warn` | $\ge 0.90$ | WCAG 2.1 AA accessibility baseline |
| `categories:best-practices` | `warn` | $\ge 0.90$ | Modern web security and browser standards |
| `largest-contentful-paint` | `error` | $\le 2500\text{ ms}$ | Google "Good" Core Web Vital standard |
| `cumulative-layout-shift` | `error` | $\le 0.10$ | Layout stability standard |
| `total-blocking-time` | `error` | $\le 200\text{ ms}$ | Main-thread responsiveness target |
| `first-contentful-paint` | `error` | $\le 1800\text{ ms}$ | Initial render velocity target |

### Phase 3: Upload (`ci.upload`)
- Telemetry and HTML/JSON report artifacts are exported to `.lighthouseci/` with standard filename patterns (`%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%`).

---

## 3. Audited URL Surface Matrix

| URL Route | Journey Stage | Critical Audits |
| :--- | :--- | :--- |
| `http://localhost:3000/` | Candidate Landing / Homepage | LCP on hero banner, category pills layout stability, meta description |
| `http://localhost:3000/search?q=Civil+Services` | Search Results Feed | Client-side query hydration, zero horizontal overflow, CLS on card grid |
| `http://localhost:3000/notification/[slug]` | Notification Detail View | Schema.org JobPosting/Event JSON-LD verification, breadcrumb structure |

---

## 4. Local Execution & CI Integration Guide

```bash
# 1. Build the production Next.js application
npm run build

# 2. Run Lighthouse CI autorun against configured URLs
npm run lhci:mobile

# 3. Verify Lighthouse CI installation health
npm run lhci:healthcheck
```
