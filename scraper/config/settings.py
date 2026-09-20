"""Application configuration and environment settings via Pydantic BaseSettings."""

import os
from functools import lru_cache
from typing import Optional
from pydantic import Field, AliasChoices
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Immutable application settings validated at boot time."""

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local", "scraper/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # General Environment
    environment: str = Field(default="development", description="Environment: development, staging, production")
    port: int = Field(default=8000, description="Uvicorn server port")
    log_level: str = Field(default="INFO", description="Logging level: DEBUG, INFO, WARNING, ERROR")

    # Supabase Configuration
    supabase_url: str = Field(
        default="",
        validation_alias=AliasChoices("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
        description="Supabase project URL",
    )
    supabase_service_role_key: str = Field(
        default="",
        validation_alias=AliasChoices("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY"),
        description="Supabase service role key for administrative access",
    )

    # Google Gemini AI Configuration
    gemini_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("GEMINI_API_KEY", "GOOGLE_API_KEY"),
        description="API key for Google Gemini structured extraction",
    )
    gemini_model: str = Field(default="gemini-1.5-pro", description="Gemini model identifier")

    # Upstash Redis Cache & Locks
    redis_url: Optional[str] = Field(default=None, description="Redis connection URL for locks and deduplication")

    # Scraper Internal API Security
    scraper_api_secret: str = Field(default="dev-secret-change-me", description="Bearer token to authenticate trigger endpoints")

    # Webhook Alerting
    alert_webhook_url: Optional[str] = Field(default=None, description="Webhook endpoint for failure dispatch (Discord/Slack)")
    alert_webhook_enabled: bool = Field(default=False, description="Enable or disable external webhook alerting")

    # PDF & Crawl Guardrails
    pdf_max_download_size_mb: int = Field(default=25, description="Maximum permitted PDF size before aborting download")
    pdf_download_timeout_seconds: int = Field(default=45, description="HTTP timeout for PDF binary downloads")
    headless_browser: bool = Field(default=True, description="Run Playwright in headless mode")

    # Sentry Observability & Error Tracking (TASK-07010102)
    sentry_dsn: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("SENTRY_DSN", "SCRAPER_SENTRY_DSN"),
        description="Sentry DSN for Python scraper microservice error telemetry",
    )
    sentry_traces_sample_rate: float = Field(
        default=0.1,
        description="Performance tracing sample rate (0.0 to 1.0)",
    )
    sentry_profiles_sample_rate: float = Field(
        default=0.1,
        description="Continuous profiling sample rate (0.0 to 1.0)",
    )

    # Healthchecks.io Dead-Man's Switch Monitoring (TASK-07030101)
    healthchecks_base_url: str = Field(
        default="https://hc-ping.com",
        description="Healthchecks.io base ping endpoint",
    )
    healthchecks_ping_key: Optional[str] = Field(
        default=None,
        description="Healthchecks.io project ping key for slug-based pings",
    )
    healthchecks_kpsc_uuid: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("HEALTHCHECKS_KPSC_UUID", "HC_PING_KPSC"),
        description="UUID or slug for KPSC crawler heartbeat",
    )
    healthchecks_upsc_uuid: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("HEALTHCHECKS_UPSC_UUID", "HC_PING_UPSC"),
        description="UUID or slug for UPSC crawler heartbeat",
    )
    healthchecks_ssc_uuid: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("HEALTHCHECKS_SSC_UUID", "HC_PING_SSC"),
        description="UUID or slug for SSC crawler heartbeat",
    )
    healthchecks_rrb_uuid: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("HEALTHCHECKS_RRB_UUID", "HC_PING_RRB"),
        description="UUID or slug for RRB crawler heartbeat",
    )

    # Telegram Scraper Alert Channel (TASK-07030101)
    telegram_bot_token: Optional[str] = Field(
        default=None,
        description="Telegram bot token for crawler failure alerts",
    )
    telegram_admin_chat_id: Optional[str] = Field(
        default=None,
        description="Telegram admin chat ID to receive immediate crawler crash alerts",
    )



@lru_cache()
def get_settings() -> Settings:
    """Return singleton instance of application settings."""
    return Settings()
