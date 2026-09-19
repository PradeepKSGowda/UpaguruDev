"""Manual crawler execution utility for UPA-GURU scraper microservice.

Usage:
  python -m scraper.run_crawler --portal KPSC
  python -m scraper.run_crawler --portal UPSC
  python -m scraper.run_crawler --portal SSC
  python -m scraper.run_crawler --portal RRB
  python -m scraper.run_crawler --portal ALL
"""

import argparse
import asyncio
import sys
from typing import Optional

from scraper.core.logging import get_logger
from scraper.scheduler.cron import CRAWLER_REGISTRY, run_crawl_job

logger = get_logger("run_crawler")


async def execute_manual_crawl(portal_code: str) -> None:
    """Execute crawl for a single portal or all supported portals."""
    portals = list(CRAWLER_REGISTRY.keys()) if portal_code.upper() == "ALL" else [portal_code.upper()]

    for code in portals:
        if code not in CRAWLER_REGISTRY:
            print(f"Error: Unknown portal '{code}'. Supported portals: {list(CRAWLER_REGISTRY.keys()) + ['ALL']}")
            sys.exit(1)

        print(f"\n========================================================")
        print(f"   MANUALLY TRIGGERING CRAWLER: {code}")
        print(f"========================================================\n")
        logger.info("Starting manual crawl execution", portal=code)
        
        try:
            await run_crawl_job(code)
            print(f"\nCompleted crawl for {code}. Check logs or Supabase for newly detected notices.")
        except Exception as exc:
            logger.error("Manual crawl failed", portal=code, error=str(exc))
            print(f"\nFailed to complete crawl for {code}: {exc}")


def main():
    parser = argparse.ArgumentParser(
        description="UPA-GURU Manual Crawler CLI Runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--portal",
        "-p",
        type=str,
        default="KPSC",
        help="Target portal to crawl: KPSC, UPSC, SSC, RRB, or ALL (default: KPSC)",
    )

    args = parser.parse_args()
    asyncio.run(execute_manual_crawl(args.portal))


if __name__ == "__main__":
    main()
