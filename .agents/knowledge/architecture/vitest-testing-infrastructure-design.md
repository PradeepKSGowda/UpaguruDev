# Vitest Unit & Integration Testing Infrastructure Architecture

## 1. Executive Summary & Context
In accordance with **ADR-001 (Frontend)**, **ADR-002 (Database)**, **ADR-013 (Security)**, and **AGENTS.md (Rule 2: Testing & Execution Safety Guardrails)**, high-reliability software requires a fast, modern test runner with strict TypeScript checking, native ESM support, and exact path alias resolution matching `tsconfig.json`.

Executing **TASK-09010101** (`SUB-0901010101`):
1. Configures **Vitest** as the primary test runner for UPA-GURU via `vitest.config.ts`.
2. Resolves `@/*` path aliases to `./*` using `vite-tsconfig-paths` and explicit Vitest alias mapping.
3. Configures `jsdom` browser environment and deterministic fallback environment variables in `vitest.setup.ts`.
4. Establishes standard test npm scripts in `package.json` (`test`, `test:watch`, `test:coverage`).
5. Implements sample configuration test in `tests/unit/config.test.ts`.
6. Initiates **EPIC-09 (Testing, QA & Lighthouse Performance Validation)**.

---

## 2. Test Execution Pipeline & Architecture

```
                       npm run test / vitest run
                                  │
                                  ▼
                ┌───────────────────────────────────┐
                │ 1. Vitest Config (vitest.config)  │
                │    - vite-tsconfig-paths (@/*)    │
                │    - React JSX compiler           │
                │    - jsdom environment            │
                └─────────────────┬─────────────────┘
                                  │
                                  ▼
                ┌───────────────────────────────────┐
                │ 2. Setup File (vitest.setup.ts)   │
                │    - Mock environment variables   │
                │    - Mock matchMedia / browser APIs│
                │    - Reset mocks after each test  │
                └─────────────────┬─────────────────┘
                                  │
                                  ▼
                ┌───────────────────────────────────┐
                │ 3. Test Suites Execution          │
                │    - tests/unit/**/*.test.ts      │
                │    - tests/unit/config.test.ts    │
                └─────────────────┬─────────────────┘
                                  │
                                  ▼
                ┌───────────────────────────────────┐
                │ 4. V8 Coverage Reporter (Optional)│
                │    - Text, JSON, HTML outputs     │
                │    - Coverage targets: >= 80%     │
                └───────────────────────────────────┘
```

---

## 3. Configuration Specifications

| Property | Value | Description |
| :--- | :--- | :--- |
| **Runner Engine** | `Vitest v3+` | Next-generation ESM-native unit/integration test runner. |
| **DOM Environment** | `jsdom` | Emulates browser environment for React components. |
| **Path Resolution** | `@/*` $\rightarrow$ `./*` | Directly aligned with `tsconfig.json` path mapping. |
| **Setup File** | `./vitest.setup.ts` | Configures test environment variables and global cleanup. |
| **Included Files** | `tests/**/*.test.ts`, `tests/**/*.test.tsx` | Unit and integration test suites. |
| **Coverage Provider** | `v8` | Fast, AST-accurate code coverage reporting. |

---

## 4. Component Inventory & Source Files

| Component | File Path | Scope & Responsibility |
| :--- | :--- | :--- |
| **Vitest Config** | `vitest.config.ts` | Vitest runner configuration with React plugin, path aliases, and test coverage options. |
| **Setup File** | `vitest.setup.ts` | Initializes deterministic environment variables and browser mocks. |
| **Sample Test** | `tests/unit/config.test.ts` | Verifies path alias resolution, environment assertions, and Zod validation. |
| **Package Manifest** | `package.json` | Adds `test`, `test:watch`, and `test:coverage` scripts and devDependencies. |
| **DB Migration** | `.agents/knowledge/database/qa-test-telemetry-schema-v1.sql` | `public.qa_test_runs` audit table with mandatory RLS. |
| **Execution Record** | `.agents/task-executions/TASK-09010101.md` | Formal task completion audit log with QA Reviewer sign-off. |
