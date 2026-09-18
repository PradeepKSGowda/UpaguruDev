"""Asynchronous HTTPX fetcher for static HTML and fast binary retrieval."""

from typing import Any, Optional
import httpx
from scraper.fetch.base import BaseFetcher
from scraper.core.logging import get_logger
from scraper.core.exceptions import FetchError

logger = get_logger(__name__)

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,kn;q=0.8,hi;q=0.7",
}


class HttpxFetcher(BaseFetcher):
    """Fast, lightweight HTTPX async client for static portal pages."""

    def __init__(self, timeout_seconds: int = 30):
        self.timeout_seconds = timeout_seconds
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                headers=DEFAULT_HEADERS,
                timeout=httpx.Timeout(self.timeout_seconds),
                follow_redirects=True,
                verify=False,  # Allow state NIC certificates that may have self-signed chains
            )
        return self._client

    async def fetch(self, url: str, wait_selector: Optional[str] = None, **kwargs: Any) -> str:
        """Fetch raw HTML content using async HTTP GET."""
        client = await self._get_client()
        try:
            logger.info("Fetching static URL with HTTPX", url=url)
            response = await client.get(url)
            response.raise_for_status()
            return response.text
        except httpx.HTTPStatusError as exc:
            logger.error("HTTP status error fetching URL", url=url, status=exc.response.status_code)
            raise FetchError(f"HTTP {exc.response.status_code} error fetching {url}") from exc
        except Exception as exc:
            logger.error("Unexpected error fetching URL with HTTPX", url=url, error=str(exc))
            raise FetchError(f"Failed to fetch {url}: {exc}") from exc

    async def download_bytes(self, url: str) -> bytes:
        """Download binary payload (e.g. PDF) directly."""
        client = await self._get_client()
        try:
            logger.info("Downloading binary with HTTPX", url=url)
            response = await client.get(url)
            response.raise_for_status()
            return response.content
        except Exception as exc:
            logger.error("Failed to download binary from URL", url=url, error=str(exc))
            raise FetchError(f"Failed to download binary from {url}: {exc}") from exc

    async def close(self) -> None:
        """Close underlying HTTPX async client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            logger.debug("HTTPX client closed successfully")
