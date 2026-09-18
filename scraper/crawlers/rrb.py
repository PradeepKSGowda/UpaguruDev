"""RRB (Railway Recruitment Boards) multi-regional crawler."""

import asyncio
from typing import Any, Optional
from urllib.parse import urljoin
from bs4 import BeautifulSoup

from scraper.crawlers.base import BaseCrawler, CrawledNotificationItem, CrawlResult
from scraper.crawlers.portal_loader import load_portal_config
from scraper.fetch.playwright_fetcher import PlaywrightFetcher
from scraper.fetch.httpx_fetcher import HttpxFetcher
from scraper.fetch.base import BaseFetcher
from scraper.pdf.downloader import PDFDownloader
from scraper.pdf.text_extractor import PDFTextExtractor
from scraper.core.logging import get_logger
from scraper.core.db import create_crawl_run, update_crawl_run, insert_pdf_document

logger = get_logger(__name__)


class RRBCrawler(BaseCrawler):
    """Crawler for Railway Recruitment Boards supporting central and regional portals."""

    def __init__(self, config: Optional[dict[str, Any]] = None, fetcher: Optional[BaseFetcher] = None):
        cfg = config or load_portal_config("RRB")
        if fetcher is None:
            if cfg.get("engine") == "httpx":
                fetcher = HttpxFetcher(timeout_seconds=cfg.get("timeout_seconds", 35))
            else:
                fetcher = PlaywrightFetcher(
                    headless=cfg.get("headless", True),
                    timeout_seconds=cfg.get("timeout_seconds", 35),
                )
        super().__init__(portal_config=cfg, fetcher=fetcher)
        self.downloader = PDFDownloader()

    def _matches_keywords(self, text: str) -> bool:
        """Filter notifications to retain only Centralized Employment Notices (CEN) and recruitment."""
        text_lower = text.lower()
        include_keywords = self.config.get("include_keywords", [])
        exclude_keywords = self.config.get("exclude_keywords", [])

        if any(ex in text_lower for ex in exclude_keywords):
            return False

        if include_keywords:
            return any(inc in text_lower for inc in include_keywords)

        return True

    def _parse_notification_links(self, html: str, base_url: str) -> list[dict[str, str]]:
        """Extract CEN PDF URLs, titles, and publication dates from RRB tables."""
        soup = BeautifulSoup(html, "html.parser")
        found_items: list[dict[str, str]] = []

        rows = soup.select("table tbody tr, .content-area tr, ul li, .cen-list tr")
        logger.info("Found candidate DOM rows for RRB", count=len(rows))

        for row in rows:
            pdf_link_elem = row.select_one("a[href*='.pdf'], a[href*='.PDF'], a[href*='CEN']")
            if not pdf_link_elem:
                continue

            raw_href = pdf_link_elem.get("href", "").strip()
            if not raw_href:
                continue

            pdf_url = urljoin(base_url, raw_href)

            link_text = pdf_link_elem.get_text(strip=True)
            row_text = row.get_text(" ", strip=True)
            title = row_text if len(row_text) > 15 else link_text

            if not self._matches_keywords(title):
                logger.debug("Skipping non-recruitment RRB item", title=title[:60])
                continue

            cells = row.select("td")
            cen_no = cells[0].get_text(strip=True) if len(cells) > 1 else None
            pub_date = cells[1].get_text(strip=True) if len(cells) > 2 else None

            found_items.append({
                "title": title[:255],
                "pdf_url": pdf_url,
                "notification_number": cen_no,
                "published_date_raw": pub_date,
            })

        logger.info("Extracted RRB PDF items", count=len(found_items), portal=self.portal_code)
        return found_items

    async def crawl(self) -> CrawlResult:
        """Execute RRB crawl across configured regional endpoints."""
        target_url = self.config.get("notifications_url", "https://www.rrbbnc.gov.in/notifications.html")
        wait_selector = self.config.get("wait_selector")
        base_url = self.config.get("base_url", "https://www.rrbbnc.gov.in")
        result = CrawlResult(portal_code=self.portal_code)

        run_id: Optional[str] = None
        try:
            crawl_run = create_crawl_run(self.portal_code)
            run_id = crawl_run.get("id")
            logger.info("Started RRB crawl run", run_id=run_id)
        except Exception as exc:
            logger.warning("Could not create database crawl_run entry, continuing offline", error=str(exc))

        try:
            html = await self.fetcher.fetch(target_url, wait_selector=wait_selector)
            detected_items = self._parse_notification_links(html, base_url=base_url)
            result.total_found = len(detected_items)

            delay = self.config.get("request_delay_seconds", 2.0)

            for item in detected_items:
                pdf_url = item["pdf_url"]
                title = item["title"]

                try:
                    downloaded = await self.downloader.download(pdf_url, check_dedup=True)

                    if downloaded.is_duplicate:
                        result.duplicates_skipped += 1
                        result.items.append(
                            CrawledNotificationItem(
                                title=title,
                                pdf_url=pdf_url,
                                source_portal=self.config.get("portal_name", "RRB"),
                                portal_code=self.portal_code,
                                sha256_hash=downloaded.sha256_hash,
                                is_duplicate=True,
                                notification_number=item.get("notification_number"),
                                published_date_raw=item.get("published_date_raw"),
                            )
                        )
                        continue

                    extracted = PDFTextExtractor.extract(downloaded.file_bytes or b"")

                    doc_record: dict[str, Any] = {
                        "sha256_hash": downloaded.sha256_hash,
                        "source_portal": self.portal_code,
                        "source_url": pdf_url,
                        "file_name": downloaded.file_name,
                        "file_size_bytes": downloaded.file_size_bytes,
                        "page_count": extracted.page_count,
                        "extracted_text": extracted.text,
                    }

                    try:
                        insert_pdf_document(doc_record)
                        logger.info("Inserted new RRB pdf_document", hash=downloaded.sha256_hash)
                    except Exception as exc:
                        logger.warning("Failed to insert pdf_document to database", error=str(exc))

                    crawled_item = CrawledNotificationItem(
                        title=title,
                        pdf_url=pdf_url,
                        source_portal=self.config.get("portal_name", "RRB"),
                        portal_code=self.portal_code,
                        sha256_hash=downloaded.sha256_hash,
                        raw_text=extracted.text,
                        page_count=extracted.page_count,
                        file_size_bytes=downloaded.file_size_bytes,
                        is_duplicate=False,
                        is_scanned=extracted.is_scanned_image,
                        notification_number=item.get("notification_number"),
                        published_date_raw=item.get("published_date_raw"),
                    )

                    result.new_processed += 1
                    result.items.append(crawled_item)
                    await asyncio.sleep(delay)

                except Exception as exc:
                    result.failed += 1
                    error_msg = f"Failed processing RRB PDF {pdf_url}: {exc}"
                    logger.error(error_msg)
                    result.errors.append(error_msg)

            if run_id:
                update_crawl_run(
                    run_id=run_id,
                    updates={
                        "status": "completed",
                        "pdfs_found": result.total_found,
                        "pdfs_new": result.new_processed,
                        "pdfs_failed": result.failed,
                    },
                )

        except Exception as exc:
            logger.error("RRB crawl run failed", error=str(exc))
            result.errors.append(str(exc))
            if run_id:
                update_crawl_run(
                    run_id=run_id,
                    updates={"status": "failed", "error_message": str(exc)},
                )
        finally:
            await self.fetcher.close()

        logger.info(
            "RRB crawl run completed",
            total=result.total_found,
            new=result.new_processed,
            skipped=result.duplicates_skipped,
            failed=result.failed,
        )
        return result
