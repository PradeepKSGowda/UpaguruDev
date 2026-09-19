"""KPSC (Karnataka Public Service Commission) portal crawler."""

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


class KPSCCrawler(BaseCrawler):
    """Playwright-driven crawler for Karnataka Public Service Commission (kpsc.kar.nic.in)."""

    def __init__(self, config: Optional[dict[str, Any]] = None, fetcher: Optional[BaseFetcher] = None):
        cfg = config or load_portal_config("KPSC")
        # Default to Playwright for dynamic page execution, with HTTPX available
        if fetcher is None:
            if cfg.get("engine") == "httpx":
                fetcher = HttpxFetcher(timeout_seconds=cfg.get("timeout_seconds", 30))
            else:
                fetcher = PlaywrightFetcher(
                    headless=cfg.get("headless", True),
                    timeout_seconds=cfg.get("timeout_seconds", 30),
                )
        super().__init__(portal_config=cfg, fetcher=fetcher)
        self.downloader = PDFDownloader()

    def _matches_keywords(self, text: str) -> bool:
        """Filter notifications to retain only exam/recruitment documents."""
        text_lower = text.lower()
        include_keywords = self.config.get("include_keywords", [])
        exclude_keywords = self.config.get("exclude_keywords", [])

        # Exclude tenders, quotations, transfers
        if any(ex in text_lower for ex in exclude_keywords):
            return False

        # Include recruitment, exam, notification
        if include_keywords:
            return any(inc in text_lower for inc in include_keywords)

        return True

    def _parse_notification_links(self, html: str) -> list[dict[str, str]]:
        """Extract PDF hyperlinks and titles from rendered HTML table rows."""
        soup = BeautifulSoup(html, "html.parser")
        base_url = self.config.get("base_url", "https://kpsc.kar.nic.in")
        found_items: list[dict[str, str]] = []

        # Find all table rows
        rows = soup.select("table tr, .content-area tr, ul.list-group li")
        logger.info("Found DOM candidate rows for KPSC", count=len(rows))

        for row in rows:
            pdf_link_elem = row.select_one("a[href*='.pdf'], a[href*='.PDF'], a[href*='download']")
            if not pdf_link_elem:
                continue

            raw_href = pdf_link_elem.get("href", "").strip()
            if not raw_href:
                continue

            # Canonicalize relative URLs to absolute HTTP targets
            pdf_url = urljoin(base_url, raw_href)

            # Extract title and date
            link_text = pdf_link_elem.get_text(strip=True)
            row_text = row.get_text(" ", strip=True)
            title = link_text if len(link_text) > 10 else row_text

            if not self._matches_keywords(title):
                logger.debug("Skipping non-recruitment item", title=title[:60])
                continue

            # Extract possible notification number / date from adjacent table cells
            cells = row.select("td")
            notif_no = cells[0].get_text(strip=True) if len(cells) > 1 else None
            pub_date = cells[2].get_text(strip=True) if len(cells) > 2 else None

            found_items.append({
                "title": title[:255],
                "pdf_url": pdf_url,
                "notification_number": notif_no,
                "published_date_raw": pub_date,
            })

        logger.info("Extracted recruitment PDF links", count=len(found_items), portal=self.portal_code)
        return found_items

    async def crawl(self) -> CrawlResult:
        """
        Execute full KPSC crawl lifecycle:
        1. Create audit record in public.crawl_runs
        2. Render notifications page with Playwright
        3. Extract and filter PDF URLs
        4. Download, compute SHA-256 hash, check deduplication
        5. Extract text via pypdf / pdfplumber for new PDFs
        6. Insert into public.pdf_documents
        7. Update crawl_runs telemetry
        """
        target_url = self.config.get("notifications_url", "https://kpsc.kar.nic.in/notifications.html")
        wait_selector = self.config.get("wait_selector")
        result = CrawlResult(portal_code=self.portal_code)

        # 1. Initialize Crawl Run in Database
        run_id: Optional[str] = None
        try:
            crawl_run = create_crawl_run(self.portal_code)
            run_id = crawl_run.get("id")
            logger.info("Started KPSC crawl run", run_id=run_id)
        except Exception as exc:
            logger.warning("Could not create database crawl_run entry, continuing offline", error=str(exc))

        try:
            # 2. Fetch page HTML
            html = await self.fetcher.fetch(target_url, wait_selector=wait_selector)

            # 3. Parse PDF links
            detected_items = self._parse_notification_links(html)
            result.total_found = len(detected_items)

            delay = self.config.get("request_delay_seconds", 2.0)

            # 4. Process each detected PDF (respect max_items per cycle)
            max_items = self.config.get("max_items", 10)
            items_to_process = detected_items[:max_items] if max_items else detected_items
            logger.info("Processing detected PDF batch", count=len(items_to_process), total=len(detected_items))

            for item in items_to_process:
                pdf_url = item["pdf_url"]
                title = item["title"]

                try:
                    # Stream download and verify SHA-256 deduplication
                    downloaded = await self.downloader.download(pdf_url, check_dedup=True)

                    if downloaded.is_duplicate:
                        result.duplicates_skipped += 1
                        result.items.append(
                            CrawledNotificationItem(
                                title=title,
                                pdf_url=pdf_url,
                                source_portal=self.config.get("portal_name", "KPSC"),
                                portal_code=self.portal_code,
                                sha256_hash=downloaded.sha256_hash,
                                is_duplicate=True,
                                notification_number=item.get("notification_number"),
                                published_date_raw=item.get("published_date_raw"),
                            )
                        )
                        continue

                    # 5. Extract text from new PDF
                    extracted = PDFTextExtractor.extract(downloaded.file_bytes or b"")

                    # 6. Save new document record to Supabase pdf_documents
                    doc_record: dict[str, Any] = {
                        "sha256_hash": downloaded.sha256_hash,
                        "source_portal": self.portal_code,
                        "source_url": pdf_url,
                        "file_name": downloaded.file_name,
                        "file_size_bytes": downloaded.file_size_bytes,
                        "page_count": extracted.page_count,
                        "extracted_text": extracted.text,
                    }

                    doc_id: Optional[str] = None
                    try:
                        inserted_doc = insert_pdf_document(doc_record)
                        doc_id = inserted_doc.get("id")
                        logger.info("Inserted new pdf_document record", hash=downloaded.sha256_hash, doc_id=doc_id)
                    except Exception as exc:
                        logger.warning("Failed to insert pdf_document to database", error=str(exc))

                    crawled_item = CrawledNotificationItem(
                        title=title,
                        pdf_url=pdf_url,
                        source_portal=self.config.get("portal_name", "KPSC"),
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

                    # 7. Insert into draft_notifications for Admin HITL Review Queue
                    try:
                        from scraper.extraction import process_crawled_item_async
                        await process_crawled_item_async(
                            item=crawled_item,
                            pdf_document_id=doc_id,
                            run_id=run_id,
                        )
                        logger.info("Successfully queued notification in public.draft_notifications", title=title[:60])
                    except Exception as ext_err:
                        logger.warning("Draft insertion pipeline encountered error", url=pdf_url, error=str(ext_err))

                    # Respectful crawl delay
                    await asyncio.sleep(delay)

                except Exception as exc:
                    result.failed += 1
                    error_msg = f"Failed processing PDF {pdf_url}: {exc}"
                    logger.error(error_msg)
                    result.errors.append(error_msg)

            # 7. Update crawl_runs telemetry upon success
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
            logger.error("KPSC crawl run failed", error=str(exc))
            result.errors.append(str(exc))
            if run_id:
                update_crawl_run(
                    run_id=run_id,
                    updates={"status": "failed", "error_message": str(exc)},
                )
        finally:
            await self.fetcher.close()

        logger.info(
            "KPSC crawl run completed",
            total=result.total_found,
            new=result.new_processed,
            skipped=result.duplicates_skipped,
            failed=result.failed,
        )
        return result
