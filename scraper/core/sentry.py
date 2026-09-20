"""Sentry Full-Stack Error Tracking & Performance Monitoring for Scraper Microservice.

Task Reference: TASK-07010102 (SUB-0701010201)
Architecture Reference: ADR-013 (Observability, Analytics & Error Tracking)
"""

from typing import Any, Optional
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

from scraper.config.settings import get_settings
from scraper.core.logging import get_logger

logger = get_logger("scraper.core.sentry")

# Sensitive parameter keys to scrub from event contexts and breadcrumbs
SENSITIVE_KEYS = {
    "supabase_service_role_key",
    "gemini_api_key",
    "google_api_key",
    "scraper_api_secret",
    "redis_url",
    "alert_webhook_url",
    "password",
    "secret",
    "token",
    "authorization",
    "cookie",
}


def scrub_sentry_event(
    event: dict[str, Any], hint: dict[str, Any]
) -> Optional[dict[str, Any]]:
    """Sanitize sensitive credentials, API keys, and auth headers before sending to Sentry.
    
    Args:
        event: Sentry event payload dictionary.
        hint: Sentry hint context including exception object.
        
    Returns:
        Scrubbed event dictionary or None to drop event.
    """
    # Scrub request headers
    request = event.get("request")
    if isinstance(request, dict):
        headers = request.get("headers")
        if isinstance(headers, dict):
            for header in list(headers.keys()):
                if header.lower() in ("authorization", "cookie", "x-supabase-key"):
                    headers[header] = "[REDACTED]"

    # Scrub extra metadata and tags
    extra = event.get("extra")
    if isinstance(extra, dict):
        for key in list(extra.keys()):
            if any(sens in key.lower() for sens in SENSITIVE_KEYS):
                extra[key] = "[REDACTED]"

    return event


def init_sentry() -> bool:
    """Initialize Sentry SDK with FastAPI integration and sample rates.
    
    Returns:
        bool: True if Sentry was initialized with a valid DSN, False otherwise.
    """
    settings = get_settings()

    if not settings.sentry_dsn:
        logger.info(
            "Sentry DSN not configured; running scraper without external error telemetry",
            environment=settings.environment,
        )
        return False

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        profiles_sample_rate=settings.sentry_profiles_sample_rate,
        send_default_pii=False,
        before_send=scrub_sentry_event,
        integrations=[
            FastApiIntegration(),
        ],
    )

    # Set default scope tags
    with sentry_sdk.configure_scope() as scope:
        scope.set_tag("service", "upa-guru-scraper")
        scope.set_tag("runtime", "python-3.12")
        scope.set_tag("architecture", "fastapi-apscheduler")

    logger.info(
        "Sentry SDK initialized successfully for Python scraper microservice",
        environment=settings.environment,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        profiles_sample_rate=settings.sentry_profiles_sample_rate,
    )
    return True


def capture_scraper_exception(
    exc: Exception,
    crawler_id: Optional[str] = None,
    extra: Optional[dict[str, Any]] = None,
) -> Optional[str]:
    """Capture a handled or unhandled exception during crawler execution with contextual metadata.
    
    Args:
        exc: Python Exception to report.
        crawler_id: Optional crawler identifier (e.g. 'upsc', 'ssc', 'ibps', 'kpsc').
        extra: Additional contextual dictionary to attach to the Sentry event.
        
    Returns:
        Optional[str]: Sentry event ID if Sentry is active, None otherwise.
    """
    settings = get_settings()
    if not settings.sentry_dsn:
        logger.warning(
            "Exception occurred but Sentry is not configured",
            error=str(exc),
            crawler_id=crawler_id,
        )
        return None

    with sentry_sdk.push_scope() as scope:
        scope.set_tag("component", "crawler_engine")
        if crawler_id:
            scope.set_tag("crawler_id", crawler_id)
        if extra:
            for key, val in extra.items():
                scope.set_extra(key, val)

        event_id = sentry_sdk.capture_exception(exc)
        logger.error(
            "Captured scraper exception in Sentry",
            event_id=event_id,
            error=str(exc),
            crawler_id=crawler_id,
        )
        return event_id
