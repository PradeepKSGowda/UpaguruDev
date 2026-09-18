"""APScheduler cron job engine for scheduled government portal crawling."""

from typing import Any, Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from scraper.core.logging import get_logger
from scraper.crawlers.kpsc import KPSCCrawler
from scraper.crawlers.upsc import UPSCCrawler
from scraper.crawlers.ssc import SSCCrawler
from scraper.crawlers.rrb import RRBCrawler

logger = get_logger(__name__)

# Singleton scheduler instance
scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")


CRAWLER_REGISTRY = {
    "KPSC": KPSCCrawler,
    "UPSC": UPSCCrawler,
    "SSC": SSCCrawler,
    "RRB": RRBCrawler,
}


async def run_crawl_job(portal_code: str) -> None:
    """Execute scheduled portal crawl job and log outcome."""
    logger.info("Triggering scheduled crawl job", portal=portal_code)
    crawler_cls = CRAWLER_REGISTRY.get(portal_code.upper())
    if not crawler_cls:
        logger.error("Unknown crawler portal code", portal=portal_code)
        return

    try:
        crawler = crawler_cls()
        result = await crawler.crawl()
        logger.info(
            "Scheduled crawl job finished",
            portal=portal_code,
            found=result.total_found,
            new=result.new_processed,
            skipped=result.duplicates_skipped,
            failed=result.failed,
        )
    except Exception as exc:
        logger.error("Scheduled crawl job encountered an unhandled error", portal=portal_code, error=str(exc))


def configure_scheduler_jobs() -> None:
    """
    Register daily crawl cron jobs aligned with Indian Standard Time (IST).
    - KPSC: 06:00 IST
    - UPSC: 07:00 IST
    - SSC:  08:00 IST
    - RRB:  09:00 IST
    """
    scheduler.add_job(
        run_crawl_job,
        trigger=CronTrigger(hour=6, minute=0, timezone="Asia/Kolkata"),
        args=["KPSC"],
        id="crawl_kpsc_daily",
        name="Daily KPSC Crawl (06:00 IST)",
        replace_existing=True,
    )

    scheduler.add_job(
        run_crawl_job,
        trigger=CronTrigger(hour=7, minute=0, timezone="Asia/Kolkata"),
        args=["UPSC"],
        id="crawl_upsc_daily",
        name="Daily UPSC Crawl (07:00 IST)",
        replace_existing=True,
    )

    scheduler.add_job(
        run_crawl_job,
        trigger=CronTrigger(hour=8, minute=0, timezone="Asia/Kolkata"),
        args=["SSC"],
        id="crawl_ssc_daily",
        name="Daily SSC Crawl (08:00 IST)",
        replace_existing=True,
    )

    scheduler.add_job(
        run_crawl_job,
        trigger=CronTrigger(hour=9, minute=0, timezone="Asia/Kolkata"),
        args=["RRB"],
        id="crawl_rrb_daily",
        name="Daily RRB Crawl (09:00 IST)",
        replace_existing=True,
    )

    logger.info("Configured daily portal crawl cron schedules (KPSC 06:00, UPSC 07:00, SSC 08:00, RRB 09:00 IST)")


def start_scheduler() -> None:
    """Start the background cron scheduler if not already running."""
    if not scheduler.running:
        configure_scheduler_jobs()
        scheduler.start()
        logger.info("APScheduler started successfully")


def stop_scheduler() -> None:
    """Shut down the background cron scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler shut down cleanly")


def get_scheduled_jobs() -> list[dict[str, Any]]:
    """Return summary list of all active scheduled jobs with next run time."""
    jobs: list[dict[str, Any]] = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger": str(job.trigger),
        })
    return jobs
