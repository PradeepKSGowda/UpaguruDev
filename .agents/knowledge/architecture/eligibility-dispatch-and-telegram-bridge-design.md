# Event-Driven Eligibility Alert Dispatch & Telegram One-Click Bridge (ENH-0010)

## 1. Executive Summary & Purpose
The **Event-Driven Eligibility Alert Dispatch & Telegram One-Click Bridge** (`ENH-0010`) closes the loop between the **Smart Eligibility Matching Engine** (`ENH-0009`) and the **Omnichannel Alert Infrastructure** (`EPIC-06`). 

Rather than relying purely on passive candidate visits, UPA-GURU automatically evaluates newly approved and published government exam notifications against all registered candidate profiles in the background, caches high-scoring matches in PostgreSQL, and dispatches personalized, rich HTML alerts to candidates' mobile devices via Telegram Bot API with 1-click apply links.

---

## 2. System Architecture & Event Flow

```
[HITL Queue: Admin Approves Draft]
               │
               ▼
[publishNotificationAction()]
   ├── 1. Insert into public.notifications
   ├── 2. Revalidate ISR Edge Caches
   └── 3. Fire dispatchEligibilityAlertsForNotification(notifId) [Async Background]
               │
               ▼
   [Eligibility Dispatcher Worker]
   ├── Fetch Notification Criteria & Exam Metadata
   ├── Query Candidate Profiles & Subscriptions (Parallel Batch)
   ├── Evaluate Rules: Age (Category Relaxation) + Qualification + State + Deadline
   │
   ├── IF Score >= 50% (Candidate is Eligible):
   │     ├── A. Upsert into public.eligibility_matches (Instant Dashboard Cache)
   │     └── B. IF preferred_channels.includes('telegram') AND telegram_chat_id:
   │              └── Format HTML Alert & Call Telegram Bot API sendMessage
   └── Return Dispatch Telemetry Report
```

---

## 3. Telegram 1-Click Deep-Link Connect Protocol

### 3.1 Deep Link Generation
- Bot username is resolved via `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` (defaults to `UpaguruBot`).
- Deep link format: `https://t.me/<BOT_USERNAME>?start=link_<USER_UUID>`
- Helper: `getTelegramConnectUrl(userId: string)` in `lib/telegram/connect.ts`.

### 3.2 Webhook Binding (`app/api/telegram/webhook/route.ts`)
1. User taps "Connect with 1-Click" in `/preferences` or `/dashboard/eligibility`.
2. Telegram opens the chat with `@UpaguruBot` with `/start link_<USER_UUID>`.
3. Webhook handler parses the `link_` payload, extracts the candidate's UUID, and executes an atomic update in `public.user_subscriptions`:
   - Sets `telegram_chat_id = chatId`
   - Adds `"telegram"` to `preferred_channels`
4. Bot sends an immediate confirmation card to the user:
   *"🎉 Account Linked Successfully! Instant Recruitment Alerts: ACTIVE"*.

---

## 4. Personalized Alert Template (HTML)

```html
🎯 <b>New Exam Matching Your Profile!</b>

Hello <b>Candidate Name</b>, a new government recruitment has just been published that matches your qualifications and eligibility criteria:

📋 <b>KPSC Assistant Conservator of Forests Exam 2026</b>
🎖️ <b>Match Score:</b> 95% (🌟 Highly Eligible)
⏳ <b>Application Window:</b> 37 days remaining

<b>Eligibility Evaluation:</b>
✅ <b>AGE:</b> Age 28 is within the eligible range 21–38 (includes +3 years OBC relaxation).
✅ <b>QUALIFICATION:</b> Your qualification meets the requirement (Graduate).
✅ <b>STATE:</b> Your state (Karnataka) matches the exam state.
✅ <b>DEADLINE:</b> 37 days remaining to apply.

👉 <a href="https://upaguru.in/notification/slug">View Full Notification & Apply Online</a>
```

---

## 5. Memory & Enhancement Registry Summary

### ENH-0008: RBAC & Candidate Personal Workspace
- **Core Entities**: `roles`, `permissions`, `role_permissions`, `user_roles`, `user_profiles`, `admin_profiles`, `bookmarks`, `exam_notes`, `user_exam_tracking`, `verification_requests`.
- **RBAC Matrix**: Static role permissions matrix in `lib/rbac/permissions.ts`, privilege escalation guard (`canAssignRole`), and server-side RBAC service (`lib/rbac/rbac-service.ts`).
- **Candidate Workspace**: `/dashboard` routes for KYC profile form, bookmarks, notes, and application tracking milestones.

### ENH-0009: Smart Eligibility Matching Engine
- **Matching Engine**: Pure-function engine in `lib/matching/eligibility-engine.ts` evaluating age with Indian reservation relaxation (`GM` 0, `OBC` +3, `SC/ST` +5, `PwD` +10), qualification hierarchy traversal, state/domicile matching, and deadline urgency.
- **Database**: Migration `20260925_eligibility_matching.sql` creating `candidate_eligibility_preferences` and `eligibility_matches` with mandatory RLS.
- **Candidate UI**: `/dashboard/eligibility` with score chips, qualification selector, and dimension-by-dimension rationale breakdown.

### Security Remediation (SEC-01 through SEC-06)
- **SEC-01**: PostgREST filter injection protection via metacharacter sanitization in `admin/users/actions.ts`.
- **SEC-02 & SEC-03**: Cryptographic random OTP generation (`crypto.randomInt`), SHA-256 token hashing, 10-minute expiry validation, 5-attempt rate-limiting, and `verified_at` marking. Removed hardcoded `"123456"` production backdoor.
- **SEC-04**: Role hierarchy guard `canAssignRole` in `assignUserRoleAction` preventing privilege escalation to `admin` or `super_admin`.
- **SEC-05**: Explicit `ALLOW_DEV_AUTH_BYPASS="true"` guard for dev auth fallback in `resolveCandidateUser`.
- **SEC-06**: `SET search_path = public` on `SECURITY DEFINER` SQL function `has_permission()`.

### Performance Optimizations (PERF-01 through PERF-04)
- **PERF-01 & PERF-05**: Precomputed `ROLE_PERMISSION_SETS` lookup map converting nested $O(R \times P \times P)$ scans into $O(1)$ set membership checks.
- **PERF-02**: Per-request deduplication via React `cache()` and 30-second cross-invocation in-memory TTL caching with explicit `invalidateUserAuthCache()` hook.
- **Query Tuning & PERF-04**: Parallelized `profiles` and `user_roles` database roundtrips via `Promise.all()`, and exact signups calculation for `newUsersToday`.

### ENH-0010: Event-Driven Eligibility Alert Dispatch & Telegram One-Click Bridge
- **Telegram Connect Bridge**: 1-click account pairing (`getTelegramConnectUrl`) and connection management in `ChannelPreferences.tsx`.
- **Event-Driven Dispatcher**: Background worker (`dispatchEligibilityAlertsForNotification`) triggered upon HITL publishing to match candidates, cache results, and send targeted mobile notifications.
