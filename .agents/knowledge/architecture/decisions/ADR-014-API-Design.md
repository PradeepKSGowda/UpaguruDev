# ADR-014: API Contract, Routing & Integration Specification

## Status
Accepted

## Date
2026-09-02

## Context & Problem Statement
UPA-GURU requires clear API conventions to govern communication between:
1. Candidate Next.js Frontend $\leftrightarrow$ Next.js Server Actions / API Routes.
2. External Third-Party Clients / Mobile Apps $\leftrightarrow$ Public REST API.
3. Python Scraper Microservice $\leftrightarrow$ Supabase / Next.js Admin Hooks.

API design requirements:
- Uniform RESTful conventions with predictable URL patterns, query params, and status codes.
- Strict input parsing and error handling using standard error schemas.
- OpenAPI 3.0 documentation for public endpoints.
- High-performance type-safe Server Actions for internal UI mutations.

## Decision Outcome
Adopt a **Dual-Pattern API Specification**:
- **Internal Mutations**: Next.js 15 **Server Actions** for type-safe UI interactions.
- **Public & Microservice API**: **RESTful JSON Endpoints** with OpenAPI 3.0 contracts and Zod schema validation.

## API Endpoint Specification

### 1. Public REST Endpoints (`/api/v1/`)
- `GET /api/v1/notifications`: Paginated feed of published notifications (`?category=...&state=...&limit=20&page=1`).
- `GET /api/v1/notifications/:slug`: Detailed notification metadata and vacancy payload.
- `GET /api/v1/exams`: Master exam index (`?conducting_body=...`).
- `POST /api/v1/subscriptions`: Create/update user push notification preferences.

### 2. Standardized Error Response Format (RFC 7807)
All API error responses must return a consistent JSON structure:
```json
{
  "type": "https://upaguru.in/errors/invalid_parameter",
  "title": "Validation Error",
  "status": 400,
  "detail": "Field 'application_end_date' must be a valid ISO 8601 date string.",
  "instance": "/api/v1/notifications"
}
```

### 3. Server Actions Paradigm
Used inside candidate and admin client components:
```typescript
// Server Action for Admin HITL Approval
export async function approveDraftAction(draftId: string, parsedData: NotificationSchema) {
    const validated = notificationZodSchema.parse(parsedData);
    return await supabase.rpc('publish_draft_notification', { draftId, data: validated });
}
```

## Consequences

### Positive
- End-to-end type safety between client components and server mutations.
- Public REST endpoints conform to industry standards (OpenAPI / RFC 7807).
- Streamlined integration for future mobile apps or third-party webhooks.

### Negative
- Require maintaining both REST API handlers and Server Actions where public access is needed.

## Compliance & Guardrails
- Complies strictly with `.agents/rules/AGENTS.md` Rule 1 (Next.js 15 App Router, TypeScript strict mode, Zod input validation).
