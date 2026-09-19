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


@lru_cache()
def get_settings() -> Settings:
    """Return singleton instance of application settings."""
    return Settings()
