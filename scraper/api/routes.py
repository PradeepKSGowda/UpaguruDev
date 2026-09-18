"""Operational API endpoints for manual crawl triggering and scheduler status."""

from typing import Any
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from scraper.api.auth import verify_scraper_api_key
from scraper.scheduler.cron import run_crawl_job, get_scheduled_jobs, CRAWLER_REGISTRY, scheduler
from scraper.core.redis_client import get_redis_client
from scraper.config.settings import get_settings

router = APIRouter(prefix="/api", tags=["Scraper Operations"])


@router.get("/status", summary="Scraper Worker & Subsystem Health Status")
async def get_worker_status() -> dict[str, Any]:
    """Inspect status of scheduler, Redis cache, and configured portals."""
    settings = get_settings()
    redis_conn = get_redis_client()
    redis_active = False

    if redis_conn:
        try:
            redis_active = bool(redis_conn.ping())
        except Exception:
            redis_active = False

    return {
        "service": "upa-guru-scraper",
        "scheduler_running": scheduler.running,
        "active_jobs_count": len(scheduler.get_jobs()),
        "redis_connected": redis_active,
        "database_configured": bool(settings.supabase_url and settings.supabase_service_role_key),
        "supported_portals": list(CRAWLER_REGISTRY.keys()),
    }


@router.get("/jobs", summary="List Scheduled Crawl Cron Jobs")
async def list_jobs() -> list[dict[str, Any]]:
    """Return all active cron jobs with next execution timestamps."""
    return get_scheduled_jobs()


@router.post(
    "/trigger/{portal_code}",
    summary="Manually Trigger Portal Crawl",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(verify_scraper_api_key)],
)
async def trigger_crawl(
    portal_code: str,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """
    Manually dispatch a crawl job for a specific government portal.
    Executes asynchronously in the background.
    Protected by Bearer authentication.
    """
    portal_upper = portal_code.upper()
    if portal_upper not in CRAWLER_REGISTRY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Portal '{portal_code}' is not supported. Choose from {list(CRAWLER_REGISTRY.keys())}.",
        )

    # Dispatch to FastAPI background task worker
    background_tasks.add_task(run_crawl_job, portal_upper)

    return {
        "status": "accepted",
        "message": f"Crawl job for '{portal_upper}' dispatched successfully in background.",
        "portal": portal_upper,
    }
