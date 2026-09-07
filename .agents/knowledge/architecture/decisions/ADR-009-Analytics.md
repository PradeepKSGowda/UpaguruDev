# ADR-009: Privacy-First Analytics & User Event Tracking

## Status
Accepted

## Date
2026-09-02

## Context & Problem Statement
UPA-GURU requires a comprehensive analytics framework to track candidate engagement, identify popular search terms, measure notification conversion funnels, and maintain an immutable audit trail for administrative content changes.

Requirements:
1. **Candidate Web Analytics**: Pageviews, referral sources, and device breakdowns.
2. **Product Event Analytics**: Tracking candidate interaction (searches, category filters, PDF downloads, alert subscription signups).
3. **Admin Security Audit Logging**: Recording all HITL verification actions (draft approval, edits, rejections, publishes) in compliance with security guardrails.

## Decision Outcome
Adopt a **Dual-Layer Analytics Architecture**:
- **Layer 1 (Client & Web Analytics)**: **Google Analytics 4 (GA4)** for web metrics combined with **PostHog** for product event funnels.
- **Layer 2 (Internal Administrative Audit Log)**: Database-backed **`audit_logs`** table in PostgreSQL for security auditing.

## Implementation Blueprint

```
                      ┌────────────────────────────────────────┐
                      │    UPA-GURU Candidate & Admin UI       │
                      └───────────┬────────────────┬───────────┘
                                  │                │
                                  ▼                ▼
                     ┌──────────────────┐    ┌──────────────────┐
                     │ GA4 & PostHog    │    │ Supabase         │
                     │ Event Tracking   │    │ audit_logs Table │
                     └──────────────────┘    └──────────────────┘
```

### 1. Client Event Schema (PostHog & GA4)
Client components fire lightweight, non-blocking telemetry events:
- `search_executed`: `{ query_text, category_filter, results_count }`
- `notification_viewed`: `{ notification_id, slug, conducting_body }`
- `pdf_downloaded`: `{ notification_id, official_pdf_url }`
- `subscription_saved`: `{ channels: ['telegram', 'web_push'], categories: [...] }`

### 2. Administrative Audit Logging (`audit_logs`)
Every state change performed by an Admin or Moderator in the HITL dashboard is written synchronously to the database:
```sql
INSERT INTO public.audit_logs (admin_id, action, target_entity, target_id, metadata)
VALUES (
    auth.uid(),
    'PUBLISH_NOTIFICATION',
    'notifications',
    notification_uuid,
    '{"confidence_score": 0.95, "draft_id": "..."}'::jsonb
);
```

## Consequences

### Positive
- Complete visibility into candidate search behavior and demand trends.
- Uncompromising security and compliance auditability for all admin verification actions.
- Privacy-conscious tracking without storing Personally Identifiable Information (PII) in third-party analytics platforms.

### Negative
- Client telemetry scripts must be loaded asynchronously to avoid impacting Core Web Vitals.

## Compliance & Guardrails
- Complies strictly with `.agents/rules/AGENTS.md` Rule 3 (Audit Trail in `audit_logs` table).
