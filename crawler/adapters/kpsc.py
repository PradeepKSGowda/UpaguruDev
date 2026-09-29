"""KPSC (Karnataka Public Service Commission) Recruitment Intelligence Adapter.

Supports bilingual English & Kannada circulars, RPC (Residual Parent Cadre) vs
HK (Kalyana Karnataka Cadre) breakdowns, and KPSC specific stages (PSL, FSL, Kannada Language Test).
"""

from typing import Any
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from crawler.adapters.base import RecruitmentSourceAdapter
from crawler.core.models import DiscoveredLink
from crawler.core.url_canonicalizer import URLCanonicalizer


class KPSCAdapter(RecruitmentSourceAdapter):
    """Adapter for Karnataka Public Service Commission (kpsc.kar.nic.in)."""

    organization_code: str = "KPSC"

    def discover_documents(self, html_content: str | None = None) -> list[DiscoveredLink]:
        """Parse KPSC notification HTML table rows and return DiscoveredLink items."""
        if not html_content:
            return []

        base_url = self.config.get("base_url", "https://kpsc.kar.nic.in")
        soup = BeautifulSoup(html_content, "html.parser")
        discovered: list[DiscoveredLink] = []
        seen_urls: set[str] = set()

        rows = soup.select("table tr")
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

                # Check for cadre indicator
                cadre = None
                if "kalyana karnataka" in title.lower() or " hk " in f" {title.lower()} ":
                    cadre = "HK"
                elif "residual parent cadre" in title.lower() or " rpc " in f" {title.lower()} ":
                    cadre = "RPC"

                discovered.append(
                    DiscoveredLink(
                        raw_url=full_url,
                        canonical_url=canonical,
                        title=title[:255],
                        is_direct_pdf=is_direct_pdf,
                        listing_page_url=base_url,
                        metadata={"cadre": cadre} if cadre else {},
                    )
                )

        return discovered
