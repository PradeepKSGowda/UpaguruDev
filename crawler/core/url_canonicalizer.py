"""URL Canonicalization and Normalization Utility for Government Recruitment Portals.

Ensures deterministic URL representations across discovery feeds, stripping analytics
and tracking query parameters while strictly preserving CMS content parameters.
"""

import re
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse

# Query parameters commonly used for tracking/analytics that should be stripped
TRACKING_PARAMS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
    "_ga",
    "_gl",
    "mc_cid",
    "mc_eid",
    "ref",
    "fb_action_ids",
    "fb_action_types",
    "fb_source",
}


class URLCanonicalizer:
    """Canonicalize URLs for reliable deduplication across government portals."""

    @staticmethod
    def canonicalize(raw_url: str, base_url: str = "") -> str:
        """
        Normalize and canonicalize a URL.

        Args:
            raw_url: Discovered URL (may be relative or contain tracking params)
            base_url: Base portal URL for resolving relative links

        Returns:
            Clean canonicalized absolute URL string
        """
        if not raw_url or not raw_url.strip():
            return ""

        url = raw_url.strip()

        # Resolve relative URLs
        if base_url:
            url = urljoin(base_url, url)

        parsed = urlparse(url)

        # Standardize scheme
        scheme = parsed.scheme.lower()
        if scheme not in ("http", "https"):
            scheme = "https"

        # Standardize host (lowercase, strip default ports)
        netloc = parsed.netloc.lower()
        if netloc.endswith(":80") and scheme == "http":
            netloc = netloc[:-3]
        elif netloc.endswith(":443") and scheme == "https":
            netloc = netloc[:-4]

        # Normalize path: collapse multi-slashes
        path = parsed.path
        path = re.sub(r"/+", "/", path)
        if not path:
            path = "/"

        # Normalize query params: filter tracking params, sort remainder
        query_pairs = parse_qsl(parsed.query, keep_blank_values=True)
        filtered_pairs = [
            (k, v) for k, v in query_pairs if k.lower() not in TRACKING_PARAMS
        ]
        filtered_pairs.sort(key=lambda x: x[0])
        canonical_query = urlencode(filtered_pairs)

        # Strip fragments
        return urlunparse((scheme, netloc, path, "", canonical_query, ""))
