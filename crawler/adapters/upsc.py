"""UPSC (Union Public Service Commission) Recruitment Intelligence Adapter.

Handles two-tier traversal (active exams listing -> notice subpages -> official PDFs),
Akamai EdgeSuite bypass headers, and UPSC specific exam naming & reference codes.
"""

from typing import Any
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from crawler.adapters.base import RecruitmentSourceAdapter
from crawler.core.models import DiscoveredLink
from crawler.core.url_canonicalizer import URLCanonicalizer


class UPSCAdapter(RecruitmentSourceAdapter):
    """Adapter for Union Public Service Commission (upsc.gov.in)."""

    organization_code: str = "UPSC"

    def discover_documents(self, html_content: str | None = None) -> list[DiscoveredLink]:
        """
        Parse UPSC active examinations / recruitment HTML page and yield DiscoveredLink items.
        Can process offline HTML string or crawl live endpoint.
        """
        if not html_content:
            return []

        base_url = self.config.get("base_url", "https://www.upsc.gov.in")
        soup = BeautifulSoup(html_content, "html.parser")
        discovered: list[DiscoveredLink] = []
        seen_urls: set[str] = set()

        candidate_elements = soup.select(
            ".view-content .views-row, .views-row, .views-field-field-exam-name, "
            "table tbody tr, table.views-table tr, .view-content tbody tr, "
            ".region-content table tr, .item-list li"
        )

        for elem in candidate_elements:
            links = elem.select("a[href]")
            for link in links:
                raw_href = link.get("href", "").strip()
                if not raw_href or raw_href.startswith(("#", "javascript:")):
                    continue

                full_url = urljoin(base_url, raw_href)
                canonical = URLCanonicalizer.canonicalize(full_url)
                if canonical in seen_urls:
                    continue

                link_text = link.get_text(strip=True)
                elem_text = elem.get_text(" ", strip=True)
                title = link_text if len(link_text) > 10 else elem_text

                if len(title) < 5:
                    continue

                is_direct_pdf = ".pdf" in raw_href.lower()
                seen_urls.add(canonical)

                discovered.append(
                    DiscoveredLink(
                        raw_url=full_url,
                        canonical_url=canonical,
                        title=title[:255],
                        is_direct_pdf=is_direct_pdf,
                        listing_page_url=base_url,
                    )
                )

        return discovered
