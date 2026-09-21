# Architecture Knowledge: Zod Schema Validation Testing Patterns

**Status**: Standard Architecture Knowledge  
**Module**: Testing, QA & Lighthouse Performance Validation (`EPIC-09` / `FEAT-0901`)  
**Applicable Tasks**: `TASK-09010102`, `TASK-09010103`, `TASK-09010104`  
**Last Updated**: 2026-09-20  

---

## 1. Overview
Runtime Zod validation schemas serve as the primary defensive perimeter for UPA-GURU across public HTTP REST APIs, React Server Actions, candidate filter bars, and administrative HITL ingestion pipelines. This document codifies unit testing patterns, boundary assertions, and type coercion verification for all present and future Zod schemas.

---

## 2. Established Validation Testing Patterns

### Pattern 1: Quad-Vector Assertion Coverage
Every schema test suite must evaluate four standard vectors:
1. **Valid Canonical Payloads**: Full valid data verifying standard success paths and type inference (`result.success === true`).
2. **Invalid Format Rejection**: Explicit rejections of invalid formats (malformed UUIDs, non-E.164 phone numbers, un-hyphenated or uppercase slugs, malformed dates) with path-specific error inspections (`result.error.issues.find(i => i.path.includes(...))`).
3. **Boundary Condition Constraints**: Minimum and maximum boundaries for integer limits (vacancies $\ge 0$, page $\ge 1$, pageSize $\in [5, 100]$, confidence $\in [0.0, 1.0]$, string lengths).
4. **Coercion & Preprocessing Verification**: Automatic preprocessing of empty strings/nulls into zero or null defaults, query string coercion via `z.coerce.number()`, and text transformation (e.g. newline-delimited strings converted to sanitized arrays).

### Pattern 2: RFC 7807 Problem Details Compliance
When testing API query parameters and route handler validation errors:
- Error responses must follow RFC 7807 Problem Details structure (`application/problem+json`).
- Test assertions must verify:
  ```ts
  expect(rfc7807Response.type).toBe("https://upaguru.in/errors/validation-error");
  expect(rfc7807Response.title).toBe("Invalid Request Parameters");
  expect(rfc7807Response.status).toBe(400);
  expect(rfc7807Response.invalid_params).toBeInstanceOf(Array);
  ```

### Pattern 3: Enum & Tuple Completeness Verification
To prevent silent omissions when enum options or constant tuples expand:
- Test suites must programmatically loop over exported constant arrays (`NOTIFICATION_STATUSES`, `DRAFT_SORT_OPTIONS`, `NOTIFICATION_SORT_OPTIONS`, `EXAM_CATEGORIES_TUPLE`, `SEARCH_API_SORT_OPTIONS`):
  ```ts
  for (const status of NOTIFICATION_STATUSES) {
    const result = schema.safeParse({ status });
    expect(result.success).toBe(true);
  }
  ```
- Reject unregistered strings to ensure strict enum bounding (`safeParse({ status: "arbitrary_val" }).success === false`).

### Pattern 4: Refined Multi-Field Interdependency Testing
When schemas utilize Zod's `.refine()` or `.superRefine()` (such as password confirmation in registration or conditional channel fields in subscriptions):
- Verify that valid pairs pass.
- Verify that mismatching pairs fail with the expected target error path:
  ```ts
  const result = registerSchema.safeParse({ password: "Pass1", confirm_password: "Pass2" });
  expect(result.success).toBe(false);
  expect(result.error.issues[0]?.path).toContain("confirm_password");
  ```

### Pattern 5: In-Memory Isolation & Zero Network I/O
- Schema tests must remain pure unit tests executing exclusively in-memory without database mocks, external HTTP calls, or file system dependencies.
- Keeps unit test execution times sub-second across CI/CD and local environments.
