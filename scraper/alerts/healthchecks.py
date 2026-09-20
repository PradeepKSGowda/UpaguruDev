"""Healthchecks.io Dead-Man's Switch Monitoring & Telegram Alert Engine for Crawlers.

Task Reference: TASK-07030101 (SUB-0703010101, SUB-0703010102)
Architecture Reference: ADR-003 (Scrapers), ADR-013 (Observability, Monitoring & Alerts)
"""

from typing import Any, Optional
import httpx

from scraper.config.settings import get_settings
from scraper.core.logging import get_logger

logger = get_logger("scraper.alerts.healthchecks")

# Canonical Crawler Healthchecks Specifications
CRAWLER_CHECKS_SPEC = {
    "KPSC": {
        "name": "KPSC Recruitment Crawler",
        "slug": "crawl-kpsc",
        "schedule": "0 6 * * *",  # 06:00 IST
        "tz": "Asia/Kolkata",
        "grace": 3600,  # 1 hour grace period
        "tags": "crawler,kpsc,recruitment,state_psc",
        "description": "Daily crawler for Karnataka Public Service Commission notifications.",
    },
    "UPSC": {
        "name": "UPSC Recruitment Crawler",
        "slug": "crawl-upsc",
        "schedule": "0 7 * * *",  # 07:00 IST
        "tz": "Asia/Kolkata",
        "grace": 3600,
        "tags": "crawler,upsc,recruitment,central",
        "description": "Daily crawler for Union Public Service Commission notifications.",
    },
    "SSC": {
        "name": "SSC Recruitment Crawler",
        "slug": "crawl-ssc",
        "schedule": "0 8 * * *",  # 08:00 IST
        "tz": "Asia/Kolkata",
        "grace": 3600,
        "tags": "crawler,ssc,recruitment,central",
        "description": "Daily crawler for Staff Selection Commission notifications.",
    },
    "RRB": {
        "name": "RRB Recruitment Crawler",
        "slug": "crawl-rrb",
        "schedule": "0 9 * * *",  # 09:00 IST
        "tz": "Asia/Kolkata",
        "grace": 3600,
        "tags": "crawler,rrb,recruitment,central,railways",
        "description": "Daily crawler for Railway Recruitment Boards notifications.",
    },
}


def get_healthchecks_manifest() -> dict[str, Any]:
    """Return declarative manifest of all crawler monitors for Healthchecks.io provisioning."""
    return {
        "provider": "healthchecks.io",
        "monitors": CRAWLER_CHECKS_SPEC,
        "alert_channels": [
            {
                "type": "telegram",
                "name": "UPA-GURU Platform Operator Alerts",
                "description": "Instant notification when crawler missed heartbeat or posted /fail",
            }
        ],
    }


def resolve_ping_url(portal_code: str) -> Optional[str]:
    """Resolve Healthchecks.io ping URL for a specified portal.
    
    Args:
        portal_code: Upper-case portal code ('KPSC', 'UPSC', 'SSC', 'RRB').
        
    Returns:
        Fully qualified ping URL or None if not configured.
    """
    settings = get_settings()
    code = portal_code.upper()

    # 1. Check explicit UUID/slug environment variable
    uuid_mapping = {
        "KPSC": settings.healthchecks_kpsc_uuid,
        "UPSC": settings.healthchecks_upsc_uuid,
        "SSC": settings.healthchecks_ssc_uuid,
        "RRB": settings.healthchecks_rrb_uuid,
    }
    target_uuid = uuid_mapping.get(code)

    if target_uuid:
        # If target is already a full URL
        if target_uuid.startswith("http://") or target_uuid.startswith("https://"):
            return target_uuid.rstrip("/")
        # Otherwise append to base URL
        return f"{settings.healthchecks_base_url.rstrip('/')}/{target_uuid}"

    # 2. Check project ping key with slug fallback
    if settings.healthchecks_ping_key:
        spec = CRAWLER_CHECKS_SPEC.get(code)
        slug = spec["slug"] if spec else f"crawl-{code.lower()}"
        return f"{settings.healthchecks_base_url.rstrip('/')}/{settings.healthchecks_ping_key}/{slug}"

    return None


async def send_start_ping(portal_code: str) -> bool:
    """Signal job execution start to Healthchecks.io to measure job duration.
    
    Args:
        portal_code: Upper-case portal code.
        
    Returns:
        True if ping succeeded or was gracefully skipped, False on network error.
    """
    ping_url = resolve_ping_url(portal_code)
    if not ping_url:
        return True

    start_url = f"{ping_url}/start"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(start_url)
            logger.debug(
                "Healthchecks start ping sent",
                portal=portal_code,
                status_code=resp.status_code,
            )
            return resp.status_code == 200
    except Exception as exc:
        logger.warning(
            "Failed to send Healthchecks start ping",
            portal=portal_code,
            error=str(exc),
        )
        return False


async def send_success_ping(portal_code: str, summary: Optional[str] = None) -> bool:
    """Signal successful crawl completion to Healthchecks.io with metric payload.
    
    Args:
        portal_code: Upper-case portal code.
        summary: Optional summary log / payload string (e.g. found=10, new=2).
        
    Returns:
        True if ping succeeded or was gracefully skipped, False on network error.
    """
    ping_url = resolve_ping_url(portal_code)
    if not ping_url:
        logger.info(
            "Healthchecks URL not configured; skipping success ping",
            portal=portal_code,
            summary=summary,
        )
        return True

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if summary:
                resp = await client.post(ping_url, content=summary.encode("utf-8"))
            else:
                resp = await client.get(ping_url)

            logger.info(
                "Healthchecks success ping recorded",
                portal=portal_code,
                status_code=resp.status_code,
            )
            return resp.status_code == 200
    except Exception as exc:
        logger.error(
            "Failed to send Healthchecks success ping",
            portal=portal_code,
            error=str(exc),
        )
        return False


async def send_failure_ping(portal_code: str, error_message: str) -> bool:
    """Signal crawl execution failure to Healthchecks.io and trigger instant Telegram alert.
    
    Args:
        portal_code: Upper-case portal code.
        error_message: Detailed diagnostic error message or traceback snippet.
        
    Returns:
        True if ping succeeded or was gracefully handled, False otherwise.
    """
    ping_url = resolve_ping_url(portal_code)
    hc_success = True

    if ping_url:
        fail_url = f"{ping_url}/fail"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    fail_url,
                    content=error_message[:10000].encode("utf-8"),
                )
                logger.warning(
                    "Healthchecks failure ping recorded",
                    portal=portal_code,
                    status_code=resp.status_code,
                )
                hc_success = resp.status_code == 200
        except Exception as exc:
            logger.error(
                "Failed to send Healthchecks failure ping",
                portal=portal_code,
                error=str(exc),
            )
            hc_success = False

    # Send direct Telegram alert to admin channel as redundancy
    await send_telegram_crawler_alert(portal_code, error_message)
    return hc_success


async def send_telegram_crawler_alert(portal_code: str, error_message: str) -> bool:
    """Dispatch immediate Telegram alert to platform operator for crawler failures.
    
    Args:
        portal_code: Upper-case portal code.
        error_message: Error description.
        
    Returns:
        True if Telegram alert was sent or skipped, False on HTTP error.
    """
    settings = get_settings()
    if not settings.telegram_bot_token or not settings.telegram_admin_chat_id:
        return True

    text = (
        f"🚨 *CRITICAL: Crawler Failure Alert*\n\n"
        f"• *Portal*: `{portal_code}`\n"
        f"• *Environment*: `{settings.environment}`\n"
        f"• *Error*: ```{error_message[:400]}```\n\n"
        f"Healthchecks.io dead-man's switch triggered. Please review crawler logs."
    )

    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    payload = {
        "chat_id": settings.telegram_admin_chat_id,
        "text": text,
        "parse_mode": "Markdown",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                logger.info("Telegram crawler failure alert dispatched", portal=portal_code)
                return True
            logger.warning(
                "Telegram alert returned non-200",
                portal=portal_code,
                status_code=resp.status_code,
                response=resp.text,
            )
            return False
    except Exception as exc:
        logger.error("Failed to send Telegram crawler alert", portal=portal_code, error=str(exc))
        return False
