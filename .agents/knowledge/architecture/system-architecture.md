# UPA-GURU Architecture & Component Specification

## System Overview
UPA-GURU is a high-availability, zero-latency Pan-India exam notification and preparation platform designed to ingest raw government exam notifications, extract structured metadata using LLMs, verify the data via Human-In-The-Loop (HITL) admin workflows, and distribute updates to candidates via web PWA and omnichannel channels (Telegram, WhatsApp, Web Push).

## Component Architecture

```
+-----------------------------------------------------------------------+
|                           DATA SOURCES                                |
|        (KPSC, UPSC, SSC, RRB, Banking, State PSC Portals)              |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                     PHASE 2: INGESTION & AI LAYER                     |
|  - Web Scrapers & RSS Crawlers (Python / Node.js)                     |
|  - LLM Extraction Engine (Gemini Structured Outputs / PDF Parser)     |
|  - Draft Storage (`draft_notifications` table in Supabase)             |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                 PHASE 1: HITL ADMIN VERIFICATION PORTAL               |
|  - Admin Review Dashboard (`/admin/notifications/review`)             |
|  - Side-by-Side PDF/Source vs Parsed Form Verification                |
|  - Single-click "Approve & Publish" workflow                          |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                    STORAGE & CACHING PERSISTENCE                      |
|  - PostgreSQL (Supabase with RLS Policies & Realtime Triggers)        |
|  - Redis Cache (Session management & Published Feed Caching)          |
+-----------------------------------------------------------------------+
                                   |
                +------------------+------------------+
                |                                     |
                v                                     v
+-------------------------------+   +-----------------------------------+
|  PHASE 1: CANDIDATE PORTAL    |   | PHASE 3: OMNICHANNEL PUSH ENGINE  |
|  - Next.js 15 App Router      |   | - Telegram Bot API Broadcaster    |
|  - Server-Side Rendering (SSR)|   | - WhatsApp Business API Service   |
|  - Programmatic SEO Pages     |   | - FCM Web Push Worker (PWA)       |
|  - JobPosting & Event Schemas |   | - Multi-preference Alert Dispatch |
+-------------------------------+   +-----------------------------------+
```

## Data Schema Models

### 1. `exams`
* `id` (UUID, Primary Key)
* `slug` (Text, Unique Index)
* `title` (Text)
* `conducting_body` (Text - e.g., KPSC, UPSC, SSC, RRB)
* `category` (Text - e.g., Civil Services, Engineering, Banking, Defense)
* `state_or_central` (Text - Central / Karnataka / Tamil Nadu / etc.)
* `official_website` (Text)
* `created_at` (Timestamp)

### 2. `notifications`
* `id` (UUID, Primary Key)
* `exam_id` (UUID, Foreign Key -> `exams.id`)
* `slug` (Text, Unique Index)
* `title` (Text)
* `notification_number` (Text)
* `total_vacancies` (Integer)
* `application_start_date` (Date)
* `application_end_date` (Date)
* `exam_date` (Date, Nullable)
* `qualification_required` (Text[])
* `age_limit_min` (Integer)
* `age_limit_max` (Integer)
* `official_pdf_url` (Text)
* `apply_online_url` (Text)
* `syllabus_summary` (JSONB)
* `selection_process` (Text[])
* `status` (Enum: `draft`, `under_review`, `published`, `archived`)
* `verified_by` (UUID, Nullable -> Auth User)
* `published_at` (Timestamp)

### 3. `draft_notifications`
* `id` (UUID, Primary Key)
* `source_url` (Text)
* `raw_extracted_text` (Text)
* `parsed_json` (JSONB)
* `extraction_confidence_score` (Float)
* `status` (Enum: `pending_review`, `approved`, `rejected`)
* `created_at` (Timestamp)

### 4. `user_subscriptions`
* `id` (UUID, Primary Key)
* `user_id` (UUID, Foreign Key -> Auth User)
* `preferred_channels` (Text[] - e.g., `["telegram", "whatsapp", "web_push"]`)
* `telegram_chat_id` (Text, Nullable)
* `whatsapp_phone_number` (Text, Nullable)
* `fcm_device_token` (Text, Nullable)
* `subscribed_exam_ids` (UUID[])
* `subscribed_categories` (Text[])
* `subscribed_states` (Text[])
