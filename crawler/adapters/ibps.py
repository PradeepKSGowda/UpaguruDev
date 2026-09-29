"""IBPS (Institute of Banking Personnel Selection) Recruitment Intelligence Adapter.

Handles Common Recruitment Process (CRP) codes, multi-stage banking recruitment
(Online Preliminary, Online Main, Interview, Provisional Allotment), and participating bank rosters.
"""

from urllib.parse import urljoin
from bs4 import BeautifulSoup
from crawler.adapters.base import RecruitmentSourceAdapter
from crawler.core.models import DiscoveredLink
from crawler.core.url_canonicalizer import URLCanonicalizer


class IBPSAdapter(RecruitmentSourceAdapter):
    """Adapter for Institute of Banking Personnel Selection (ibps.in)."""

    organization_code: str = "IBPS"

    def discover_documents(self, html_content: str | None = None) -> list[DiscoveredLink]:
        """Parse IBPS notification listings and banners."""
        if not html_content:
            return []

        base_url = self.config.get("base_url", "https://www.ibps.in")
        soup = BeautifulSoup(html_content, "html.parser")
        discovered: list[DiscoveredLink] = []
        seen_urls: set[str] = set()

        rows = soup.select(".table tr, table tr, .listing-item, li a")
        for elem in rows:
            anchors = elem.select("a[href]") if elem.name != "a" else [elem]
            for a in anchors:
                href = a.get("href", "").strip()
                if not href or href.startswith(("#", "javascript:")):
                    continue

                full_url = urljoin(base_url, href)
                canonical = URLCanonicalizer.canonicalize(full_url)
                if canonical in seen_urls:
                    continue

                title = a.get_text(strip=True)
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
