"""RRB (Railway Recruitment Boards) Recruitment Intelligence Adapter.

Handles Centralized Employment Notices (CEN), multi-stage CBT-1 / CBT-2 / CBAT / DV
milestones, and zonal panel announcements across Indian Railways.
"""

from urllib.parse import urljoin
from bs4 import BeautifulSoup
from crawler.adapters.base import RecruitmentSourceAdapter
from crawler.core.models import DiscoveredLink
from crawler.core.url_canonicalizer import URLCanonicalizer


class RRBAdapter(RecruitmentSourceAdapter):
    """Adapter for Railway Recruitment Boards (rrbcdg.gov.in and zonal portals)."""

    organization_code: str = "RRB"

    def discover_documents(self, html_content: str | None = None) -> list[DiscoveredLink]:
        """Parse RRB circular notices and table rows."""
        if not html_content:
            return []

        base_url = self.config.get("base_url", "https://rrbcdg.gov.in")
        soup = BeautifulSoup(html_content, "html.parser")
        discovered: list[DiscoveredLink] = []
        seen_urls: set[str] = set()

        rows = soup.select("table tr, .table tr, .view-content tr, li")
        for row in rows:
            anchors = row.select("a[href]")
            for a in anchors:
                href = a.get("href", "").strip()
                if not href or href.startswith(("#", "javascript:")):
                    continue

                full_url = urljoin(base_url, href)
                canonical = URLCanonicalizer.canonicalize(full_url)
                if canonical in seen_urls:
                    continue

                title = a.get_text(strip=True) or row.get_text(" ", strip=True)
                if len(title) < 5:
                    continue

                is_direct_pdf = ".pdf" in href.lower()
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
