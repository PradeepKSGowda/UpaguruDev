"""SSC (Staff Selection Commission) Recruitment Intelligence Adapter.

Handles multi-tier examinations (Tier-I, Tier-II, Skill Test),
CGL / CHSL / MTS / GD / Selection Post circulars, and regional/central notices.
"""

from urllib.parse import urljoin
from bs4 import BeautifulSoup
from crawler.adapters.base import RecruitmentSourceAdapter
from crawler.core.models import DiscoveredLink
from crawler.core.url_canonicalizer import URLCanonicalizer


class SSCAdapter(RecruitmentSourceAdapter):
    """Adapter for Staff Selection Commission (ssc.gov.in)."""

    organization_code: str = "SSC"

    def discover_documents(self, html_content: str | None = None) -> list[DiscoveredLink]:
        """Parse SSC latest notices feed/table and extract DiscoveredLink items."""
        if not html_content:
            return []

        base_url = self.config.get("base_url", "https://ssc.gov.in")
        soup = BeautifulSoup(html_content, "html.parser")
        discovered: list[DiscoveredLink] = []
        seen_urls: set[str] = set()

        rows = soup.select("table tr, .notice-item, .views-row, li")
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
