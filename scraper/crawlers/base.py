"""Base crawler abstraction and data structures."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional
from scraper.fetch.base import BaseFetcher


@dataclass
class CrawledNotificationItem:
    """Individual recruitment notification candidate detected during crawling."""
    title: str
    pdf_url: str
    source_portal: str
    portal_code: str
    published_date_raw: Optional[str] = None
    notification_number: Optional[str] = None
    sha256_hash: Optional[str] = None
    raw_text: Optional[str] = None
    page_count: Optional[int] = None
    file_size_bytes: Optional[int] = None
    is_duplicate: bool = False
    is_scanned: bool = False
    storage_path: Optional[str] = None
    error: Optional[str] = None


@dataclass
class CrawlResult:
    """Consolidated summary of a portal crawl execution."""
    portal_code: str
    total_found: int = 0
    new_processed: int = 0
    duplicates_skipped: int = 0
    failed: int = 0
    items: list[CrawledNotificationItem] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


class BaseCrawler(ABC):
    """Abstract base crawler class for all government recruitment portals."""

    def __init__(self, portal_config: dict[str, Any], fetcher: BaseFetcher):
        self.config = portal_config
        self.fetcher = fetcher
        self.portal_code = portal_config.get("portal_code", "UNKNOWN")

    @abstractmethod
    async def crawl(self) -> CrawlResult:
        """Execute complete crawl cycle: fetch -> detect links -> download & hash -> extract text."""
        pass
