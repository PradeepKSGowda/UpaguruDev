# ADR-007: Omnichannel Push Alert Engine

## Status
Accepted

## Date
2026-09-02

## Context & Problem Statement
The primary value proposition of UPA-GURU is delivering timely, accurate government exam alerts to candidates before application deadlines expire. Candidates consume alerts across multiple channels including Web Push, Telegram, WhatsApp, and Email.

Notification requirements:
- Asynchronous non-blocking message dispatch upon publication of an exam notification.
- Channel preferences stored per candidate (`user_subscriptions` table).
- Multi-channel connectors: FCM for Web Push, Telegram Bot API, WhatsApp Business API, and Resend for Email.
- Strict rate-limiting and opt-in consent controls to avoid spam flags.

## Decision Outcome
Adopt an **Event-Driven Omnichannel Notification Architecture**.

```
                   ┌───────────────────────────────────┐
                   │ Admin HITL Publish Event Trigger  │
                   └─────────────────┬─────────────────┘
                                     │ Supabase Database Webhook
                                     ▼
                   ┌───────────────────────────────────┐
                   │  Omnichannel Alert Dispatcher     │
                   └─┬───────────┬───────────┬─────────┴─┐
                     │           │           │           │
                     ▼           ▼           ▼           ▼
                 ┌───────┐   ┌───────┐   ┌───────┐   ┌───────┐
                 │  FCM  │   │Telegram│   │WhatsApp│  │Resend │
                 │ Web   │   │  Bot  │   │ Cloud │   │ Email │
                 │ Push  │   │  API  │   │  API  │   │  API  │
                 └───────┘   └───────┘   └───────┘   └───────┘
```

## Channel Architecture

### 1. Web Push Notifications (FCM / VAPID)
- Browser-native push alerts delivered directly to candidate mobile and desktop devices.
- Uses Firebase Cloud Messaging (FCM) and web VAPID credentials stored securely.

### 2. Telegram Bot API Integration
- Delivers instant rich-text markdown notifications to UPA-GURU official Telegram channels and direct messages (`telegram_chat_id`).
- High throughput, zero message costs.

### 3. WhatsApp Business Cloud API
- Reserved for urgent, high-value alerts (e.g. "Application Deadline Ends Today", "Admit Card Released").
- Uses pre-approved Meta WhatsApp message templates.

### 4. Email Transactional Alerts (Resend)
- Daily/weekly notification digests and account verification emails using **Resend**.

## Candidate Subscription Schema (`user_subscriptions`)
```sql
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    preferred_channels TEXT[] DEFAULT ARRAY['web_push'],
    telegram_chat_id TEXT,
    whatsapp_phone_number TEXT,
    fcm_device_token TEXT,
    subscribed_exam_ids UUID[],
    subscribed_categories exam_category_enum[],
    subscribed_states TEXT[]
);
```

## Consequences

### Positive
- Candidate reaches the notification through their preferred communication channel.
- Asynchronous background dispatch ensures candidate web application performance remains completely unaffected.
- Fine-grained subscription filters eliminate irrelevant notifications.

### Negative
- WhatsApp Business API incurs per-message template fees.
- Requires managing API credentials for multiple notification vendors.

## Compliance & Guardrails
- Complies with `.agents/rules/AGENTS.md` Rule 1 (Secrets in `.env.local`) and schema contract `schema-v1.sql`.