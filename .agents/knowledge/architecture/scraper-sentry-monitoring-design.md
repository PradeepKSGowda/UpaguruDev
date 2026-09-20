# Scraper Microservice Sentry Observability & Error Monitoring Architecture

## 1. Executive Summary & Context
In accordance with **ADR-013 (Observability, Analytics & Error Tracking)**, UPA-GURU's automated crawling microservice requires real-time exception tracking, performance tracing, and crash diagnostics. Because government recruitment portals frequently alter DOM structures, fail under heavy traffic, or return corrupt PDF binaries, scraper runtime exceptions must be captured and triaged without human intervention.

Executing **TASK-07010102** (`SUB-0701010201`) establishes Sentry SDK integration (`sentry-sdk[fastapi]`) for the Python 3.12 FastAPI scraper worker and APScheduler cron jobs.

---

## 2. Microservice Error Tracking Architecture

```
                    Government Portals (KPSC, UPSC, SSC, RRB)
                                      │
                                      ▼
                    ┌──────────────────────────────────┐
                    │      APScheduler Cron Engine     │
                    │   - Daily scheduled crawl jobs   │
                    │   - Exception capture hook       │
                    └─────────────────┬────────────────┘
                                      │ Handled / Unhandled Crashes
                                      ▼
                    ┌──────────────────────────────────┐
                    │     scraper.core.sentry Module   │
                    │   - sentry_sdk.init()            │
                    │   - FastApiIntegration()         │
                    │   - Context tag: crawler_id      │
                    │   - before_send credential scrub │
                    └─────────────────┬────────────────┘
                                      │
                                      ▼
                    ┌──────────────────────────────────┐
                    │        FastAPI Web Server        │
                    │   - /health endpoint telemetry   │
                    │   - Trigger API route errors     │
                    └─────────────────┬────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
                    ▼                                   ▼
          Sentry Cloud Dashboard            Supabase error_telemetry_logs
       - Stack trace symbolication        - runtime = 'scraper'
       - Release health & tracing         - Admin portal audit view
```

---

## 3. Core Components & Integration Points

| Component | File Path | Scope & Responsibility |
| :--- | :--- | :--- |
| **Dependencies** | `scraper/requirements.txt` | Pins `sentry-sdk[fastapi]==2.19.2` for FastAPI request capture and Starlette exception handling. |
| **Settings Engine** | `scraper/config/settings.py` | Exposes `sentry_dsn`, `sentry_traces_sample_rate` (0.1), and `sentry_profiles_sample_rate` (0.1) via Pydantic `BaseSettings`. |
| **Sentry Core Helper** | `scraper/core/sentry.py` | Encapsulates `init_sentry()`, `scrub_sentry_event()`, and `capture_scraper_exception()` with custom crawler tags. |
| **Microservice Entrypoint** | `scraper/main.py` | Calls `init_sentry()` before FastAPI app creation and adds `sentry_configured` flag to `/health`. |
| **Scheduler Hooks** | `scraper/scheduler/cron.py` | Wraps `run_crawl_job` in `capture_scraper_exception()` ensuring portal failures record with `crawler_id` tag. |
| **Environment Template** | `scraper/.env.example` | Documents `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`, and `SENTRY_PROFILES_SAMPLE_RATE`. |
| **Database Schema** | `scraper-sentry-telemetry-v1.sql` | Adds partial index and security invoker view `public.v_scraper_error_telemetry`. |

---

## 4. Credential Sanitization & Security Guardrails

The scraper microservice utilizes elevated credentials (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `REDIS_URL`). To ensure zero secret leakage to external telemetry services:
1. **`before_send` Sanitization**: All event payloads pass through `scrub_sentry_event()`, which sanitizes HTTP headers and extra metadata matching sensitive keys (`password`, `secret`, `token`, `service_role`, `key`).
2. **PII Masking**: `send_default_pii=False` prevents transmission of candidate emails or IP addresses.
3. **Scope Tags**: Contextual tags attach `service=upa-guru-scraper`, `runtime=python-3.12`, and `crawler_id` (e.g. `KPSC`, `UPSC`, `SSC`, `RRB`) for rapid incident triage.

---

## 5. Performance Tracing & Profiling
- **Traces Sample Rate (`0.1`)**: Captures 10% of operational API requests and cron executions for distributed transaction monitoring.
- **Profiling Sample Rate (`0.1`)**: Captures 10% of CPU profiling traces, pinpointing performance bottlenecks during PDF decompression and DOM parsing.
