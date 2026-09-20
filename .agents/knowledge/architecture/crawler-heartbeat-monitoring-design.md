# Crawler Dead-Man's Switch Heartbeat Monitoring & Telegram Alert Architecture

## 1. Executive Summary & Context
In accordance with **ADR-003 (Scraper & Extraction Architecture)** and **ADR-013 (Observability, Analytics & Error Tracking)**, platform operators require immediate alerting when scheduled crawler cycles fail, hang, or stop executing entirely. Traditional push-based alerting fails when a worker process silently crashes or loses network connectivity.

Executing **TASK-07030101** (`SUB-0703010101` and `SUB-0703010102`) implements an inverted "dead-man's switch" monitoring architecture using **Healthchecks.io** alongside redundant **Telegram Bot failure alerting** for all four recruitment crawler modules (KPSC, UPSC, SSC, RRB). Completing this task brings **EPIC-07 (Observability, Analytics & Error Monitoring)** to **100% completion**.

---

## 2. Dead-Man's Switch Telemetry Architecture

```
                    APScheduler Cron Engine (Daily 06:00 - 09:00 IST)
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │ 1. Start Phase: send_start_ping(portal)     │
                    │    -> GET https://hc-ping.com/<uuid>/start   │
                    │    (Measures crawl execution duration)       │
                    └──────────────────────┬───────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │ 2. Crawler Execution: crawler.crawl()        │
                    │    - Fetch DOM, download notices, parse PDFs │
                    └──────────────────────┬───────────────────────┘
                                           │
                     Outcome Evaluation    │
                     ┌─────────────────────┴─────────────────────┐
                     │                                           │
            Success (failed == 0)                       Failure (failed > 0)
                     │                                           │
                     ▼                                           ▼
┌─────────────────────────────────────────┐ ┌─────────────────────────────────────────┐
│ 3A. Success Ping:                       │ │ 3B. Failure Ping & Telegram Alert:      │
│   - POST https://hc-ping.com/<uuid>     │ │   - POST https://hc-ping.com/<uuid>/fail│
│   - Payload: found=X, new=Y, skipped=Z  │ │   - POST api.telegram.org/bot<token>    │
│   - Resets 24h dead-man's countdown     │ │   - Instant operator channel alert      │
└─────────────────────────────────────────┘ └─────────────────────────────────────────┘
                     │                                           │
                     └─────────────────────┬─────────────────────┘
                                           │
                                           ▼
                              Healthchecks.io Dashboard
                              - Visual status (Green / Red)
                              - Missing heartbeat alerts (Down)
```

---

## 3. Crawler Monitor Specifications

| Portal | Monitor Name | Cron Schedule (IST) | Period | Grace | Tags |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **KPSC** | `KPSC Recruitment Crawler` | `0 6 * * *` (06:00 IST) | 24 hours | 1 hour | `crawler,kpsc,recruitment,state_psc` |
| **UPSC** | `UPSC Recruitment Crawler` | `0 7 * * *` (07:00 IST) | 24 hours | 1 hour | `crawler,upsc,recruitment,central` |
| **SSC** | `SSC Recruitment Crawler` | `0 8 * * *` (08:00 IST) | 24 hours | 1 hour | `crawler,ssc,recruitment,central` |
| **RRB** | `RRB Recruitment Crawler` | `0 9 * * *` (09:00 IST) | 24 hours | 1 hour | `crawler,rrb,recruitment,central,railways` |

---

## 4. Component Inventory & Source Files

| Component | File Path | Scope & Responsibility |
| :--- | :--- | :--- |
| **Alert Engine** | `scraper/alerts/healthchecks.py` | Implements `send_start_ping`, `send_success_ping`, `send_failure_ping`, and `send_telegram_crawler_alert`. |
| **Alerts Barrel** | `scraper/alerts/__init__.py` | Central exports for all alert utilities. |
| **Scheduler Hook** | `scraper/scheduler/cron.py` | Hooks heartbeat pings into `run_crawl_job` across start, complete, and exception blocks. |
| **Settings Engine** | `scraper/config/settings.py` | Adds Healthchecks UUIDs, project ping key, and Telegram bot credentials to `Settings`. |
| **Environment Template** | `scraper/.env.example` | Documents Healthchecks and Telegram alert environment variables. |
| **Provisioning CLI** | `scraper/scripts/provision_healthchecks.py` | Standalone CLI utility to declaratively create/update checks via Healthchecks.io v3 API. |
| **Database Schema** | `crawler-heartbeats-schema-v1.sql` | PostgreSQL audit table `crawler_heartbeat_logs` with mandatory RLS. |

---

## 5. Failure Recovery & Telegram Notification Protocol
If a crawler encounters unhandled exceptions, network timeouts, or DOM layout changes:
1. **`/fail` HTTP Ping**: Transmits up to 10,000 characters of the error trace directly to Healthchecks.io.
2. **Direct Telegram Dispatch**: Sends a markdown-formatted message to the operator chat ID with portal code, environment, and error excerpt.
3. **Dead-Man's Timer**: If a crawler completely crashes or the hosting server powers off, Healthchecks.io automatically triggers an alert when the 1-hour grace period expires.
