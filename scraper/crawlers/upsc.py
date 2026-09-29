"""UPSC (Union Public Service Commission) portal crawler."""

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


class UPSCCrawler(BaseCrawler):
    """Crawler for Union Public Service Commission (upsc.gov.in)."""

    def __init__(self, config: Optional[dict[str, Any]] = None, fetcher: Optional[BaseFetcher] = None):
        cfg = config or load_portal_config("UPSC")
        if fetcher is None:
            # UPSC uses Akamai EdgeSuite CDN which blocks headless Chromium/Playwright with 'Access Denied'.
            # HttpxFetcher with browser headers bypasses WAF and fetches static Drupal markup cleanly.
            if cfg.get("engine") == "playwright":
                # Fallback to HttpxFetcher if playwright is set to prevent Akamai block
                fetcher = HttpxFetcher(timeout_seconds=cfg.get("timeout_seconds", 40))
            else:
                fetcher = HttpxFetcher(timeout_seconds=cfg.get("timeout_seconds", 40))
        super().__init__(portal_config=cfg, fetcher=fetcher)
        self.downloader = PDFDownloader()

    def _matches_keywords(self, text: str) -> bool:
        """Filter notifications to retain only active examinations and recruitment notices."""
        text_lower = text.lower()
        include_keywords = self.config.get("include_keywords", [])
        exclude_keywords = self.config.get("exclude_keywords", [])

        if any(ex in text_lower for ex in exclude_keywords):
            return False

        if include_keywords:
            return any(inc in text_lower for inc in include_keywords)

        return True

    def _parse_candidate_entries(self, html: str) -> list[dict[str, Any]]:
        """
        Extract candidate examination entries from UPSC active examinations or recruitment pages.
        Supports both direct PDF circulars and two-tier landing page links.
        """
        soup = BeautifulSoup(html, "html.parser")
        base_url = self.config.get("base_url", "https://www.upsc.gov.in")
        found_entries: list[dict[str, Any]] = []

        # Comprehensive DOM selectors for tables, Drupal views rows, and listings
        candidate_elements = soup.select(
            ".view-content .views-row, .views-row, .views-field-field-exam-name, "
            "table tbody tr, table.views-table tr, .view-content tbody tr, "
            ".region-content table tr, .item-list li"
        )
        logger.info("Found candidate DOM elements for UPSC", count=len(candidate_elements))

        seen_urls: set[str] = set()

        # Discard generic utility and index links
        skip_paths = {
            "/examinations/exam-calendar",
            "/examinations/active-exams",
            "/examinations/active-examinations",
            "/examinations/forthcoming-exams",
            "/examinations/previous-question-papers",
            "/examinations/cutoff-marks",
            "/examinations/answer-key",
            "/examinations/revised-syllabus-scheme",
            "/examinations/rules-of-examination",
            "/examinations/public-disclosure",
        }

        for elem in candidate_elements:
            links = elem.select("a[href]")
            if not links:
                continue

            for link in links:
                raw_href = link.get("href", "").strip()
                if not raw_href or raw_href.startswith("#") or raw_href.startswith("javascript:"):
                    continue

                # Ignore utility index paths
                if any(sp in raw_href.lower() for sp in skip_paths):
                    continue

                full_url = urljoin(base_url, raw_href)
                if full_url in seen_urls:
                    continue

                link_text = link.get_text(strip=True)
                elem_text = elem.get_text(" ", strip=True)

                title = link_text if len(link_text) > 10 else elem_text
                if not title or len(title) < 5:
                    continue

                if not self._matches_keywords(title):
                    logger.debug("Skipping non-target UPSC entry", title=title[:60])
                    continue

                is_direct_pdf = raw_href.lower().endswith(".pdf") or ".pdf" in raw_href.lower()
                is_subpage = "/examinations/" in raw_href or "/recruitment/" in raw_href

                if not is_direct_pdf and not is_subpage:
                    continue

                cells = elem.select("td")
                exam_date = cells[1].get_text(strip=True) if len(cells) > 1 else None

                seen_urls.add(full_url)
                found_entries.append({
                    "title": title[:255],
                    "target_url": full_url,
                    "is_direct_pdf": is_direct_pdf,
                    "published_date_raw": exam_date,
                })

        logger.info("Extracted candidate UPSC entries", count=len(found_entries), portal=self.portal_code)
        return found_entries

    async def crawl(self) -> CrawlResult:
        """Execute complete UPSC crawl cycle."""
        target_url = self.config.get("notifications_url", "https://www.upsc.gov.in/examinations/active-exams")
        wait_selector = self.config.get("wait_selector")
        result = CrawlResult(portal_code=self.portal_code)

        run_id: Optional[str] = None
        try:
            crawl_run = create_crawl_run(self.portal_code)
            run_id = crawl_run.get("id")
            logger.info("Started UPSC crawl run", run_id=run_id)
        except Exception as exc:
            logger.warning("Could not create database crawl_run entry, continuing offline", error=str(exc))

        try:
            html = await self.fetcher.fetch(target_url, wait_selector=wait_selector)
            candidate_entries = self._parse_candidate_entries(html)
            result.total_found = len(candidate_entries)

            delay = self.config.get("request_delay_seconds", 2.0)

            for entry in candidate_entries:
                title = entry["title"]
                pdf_url: Optional[str] = None

                if entry["is_direct_pdf"]:
                    pdf_url = entry["target_url"]
                else:
                    # Two-tier traversal: follow exam landing page to extract Notice / Circular PDF
                    try:
                        logger.info("Traversing UPSC exam landing subpage", title=title[:50], url=entry["target_url"])
                        subpage_html = await self.fetcher.fetch(entry["target_url"])
                        sub_soup = BeautifulSoup(subpage_html, "html.parser")

                        # Inspect metadata table on subpage (e.g., views-table cols-6)
                        sub_table = sub_soup.find("table")
                        if sub_table:
                            for tr in sub_table.find_all("tr"):
                                cells = tr.find_all(["th", "td"])
                                if len(cells) >= 2:
                                    key = cells[0].get_text(strip=True).lower()
                                    val = cells[1].get_text(strip=True)
                                    if "date of notification" in key or "notification date" in key or "date of upload" in key:
                                        if not entry.get("published_date_raw"):
                                            entry["published_date_raw"] = val

                        # Prioritize anchors in the subpage's main notification table
                        table_anchors = sub_table.select("a[href*='.pdf'], a[href*='.PDF']") if sub_table else []
                        all_pdf_anchors = sub_soup.select("a[href*='.pdf'], a[href*='.PDF']")
                        pdf_anchors = table_anchors if table_anchors else all_pdf_anchors
                        target_anchor = None

                        # Prioritize notification or notice circulars over question papers
                        for a in pdf_anchors:
                            text = (a.get_text() + " " + a.get("href", "")).lower()
                            if any(k in text for k in ["notice", "notif", "advt", "circular", "document"]):
                                target_anchor = a
                                break

                        if not target_anchor and pdf_anchors:
                            target_anchor = pdf_anchors[0]

                        if target_anchor:
                            pdf_url = urljoin(self.config.get("base_url", "https://www.upsc.gov.in"), target_anchor.get("href", ""))
                        else:
                            logger.warning("No PDF notice found on exam subpage", url=entry["target_url"])
                            continue
                    except Exception as sub_err:
                        logger.warning("Failed fetching UPSC exam subpage", url=entry["target_url"], error=str(sub_err))
                        continue

                try:
                    downloaded = await self.downloader.download(pdf_url, check_dedup=True)

                    if downloaded.is_duplicate:
                        result.duplicates_skipped += 1
                        result.items.append(
                            CrawledNotificationItem(
                                title=title,
                                pdf_url=pdf_url,
                                source_portal=self.config.get("portal_name", "UPSC"),
                                portal_code=self.portal_code,
                                sha256_hash=downloaded.sha256_hash,
                                is_duplicate=True,
                                published_date_raw=entry.get("published_date_raw"),
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

                    doc_id: Optional[str] = None
                    try:
                        inserted_doc = insert_pdf_document(doc_record)
                        doc_id = inserted_doc.get("id") if inserted_doc else None
                        logger.info("Inserted new UPSC pdf_document", hash=downloaded.sha256_hash)
                    except Exception as exc:
                        logger.warning("Failed to insert pdf_document to database", error=str(exc))

                    crawled_item = CrawledNotificationItem(
                        title=title,
                        pdf_url=pdf_url,
                        source_portal=self.config.get("portal_name", "UPSC"),
                        portal_code=self.portal_code,
                        sha256_hash=downloaded.sha256_hash,
                        raw_text=extracted.text,
                        page_count=extracted.page_count,
                        file_size_bytes=downloaded.file_size_bytes,
                        is_duplicate=False,
                        is_scanned=extracted.is_scanned_image,
                        published_date_raw=entry.get("published_date_raw"),
                    )

                    result.new_processed += 1
                    result.items.append(crawled_item)

                    # Ingest draft notification for Admin HITL verification queue
                    try:
                        from scraper.extraction.pipeline import process_crawled_item_async
                        await process_crawled_item_async(crawled_item, pdf_document_id=doc_id, run_id=run_id)
                        logger.info("Ingested draft notification for UPSC notice", title=title[:50])
                    except Exception as draft_err:
                        logger.warning("Failed ingesting draft notification for notice", title=title[:50], error=str(draft_err))

                    await asyncio.sleep(delay)

                except Exception as exc:
                    result.failed += 1
                    error_msg = f"Failed processing UPSC PDF {pdf_url}: {exc}"
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
            logger.error("UPSC crawl run failed", error=str(exc))
            result.errors.append(str(exc))
            if run_id:
                update_crawl_run(
                    run_id=run_id,
                    updates={"status": "failed", "error_message": str(exc)},
                )
        finally:
            await self.fetcher.close()

        logger.info(
            "UPSC crawl run completed",
            total=result.total_found,
            new=result.new_processed,
            skipped=result.duplicates_skipped,
            failed=result.failed,
        )
        return result
