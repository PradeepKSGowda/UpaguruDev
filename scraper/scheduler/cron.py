"""APScheduler cron job engine for scheduled government portal crawling."""

from typing import Any, Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from scraper.core.logging import get_logger
from scraper.core.sentry import capture_scraper_exception
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


from scraper.alerts.healthchecks import (
    send_start_ping,
    send_success_ping,
    send_failure_ping,
)

async def run_crawl_job(portal_code: str) -> None:
    """Execute scheduled portal crawl job, hand off notices to AI, and ping Healthchecks.io."""
    logger.info("Triggering scheduled crawl job", portal=portal_code)
    crawler_cls = CRAWLER_REGISTRY.get(portal_code.upper())
    if not crawler_cls:
        logger.error("Unknown crawler portal code", portal=portal_code)
        return

    # Signal execution start to Healthchecks.io (measures job execution duration)
    await send_start_ping(portal_code)

    try:
        crawler = crawler_cls()
        result = await crawler.crawl()

        # Hand off newly downloaded PDFs to AI extraction pipeline
        try:
            from scraper.extraction import process_crawled_item_async
            for item in result.items:
                if not item.is_duplicate and item.raw_text:
                    try:
                        logger.info("Handing off new document to AI extraction", url=item.pdf_url)
                        await process_crawled_item_async(item)
                    except Exception as ext_err:
                        logger.warning("AI extraction error for crawled notice", url=item.pdf_url, error=str(ext_err))
        except Exception as pipe_err:
            logger.warning("Extraction pipeline module unavailable or error occurred", error=str(pipe_err))

        logger.info(
            "Scheduled crawl job finished",
            portal=portal_code,
            found=result.total_found,
            new=result.new_processed,
            skipped=result.duplicates_skipped,
            failed=result.failed,
        )

        summary_text = (
            f"found={result.total_found}, new={result.new_processed}, "
            f"skipped={result.duplicates_skipped}, failed={result.failed}"
        )

        # Ping Healthchecks.io outcome
        if result.failed > 0 and result.total_found == 0:
            # Fatal crawl outcome
            error_details = "; ".join(result.errors) if result.errors else "Zero notices detected and failures reported"
            await send_failure_ping(portal_code, f"Partial or total crawl failure: {error_details}")
        else:
            await send_success_ping(portal_code, summary=summary_text)

    except Exception as exc:
        logger.error("Scheduled crawl job encountered an unhandled error", portal=portal_code, error=str(exc))
        # 1. Capture in Sentry
        capture_scraper_exception(exc, crawler_id=portal_code, extra={"source": "apscheduler_cron"})
        # 2. Ping Healthchecks.io /fail and dispatch instant Telegram operator alert
        await send_failure_ping(portal_code, str(exc))




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
