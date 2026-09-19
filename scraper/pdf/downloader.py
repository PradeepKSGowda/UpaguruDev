"""Streaming PDF downloader with size limits, timeout, deduplication verification, and curl fallback."""

import subprocess
import sys
from dataclasses import dataclass
from typing import Optional

import httpx

from scraper.config.settings import get_settings
from scraper.core.db import is_pdf_hash_duplicate
from scraper.core.exceptions import PDFDownloadError
from scraper.core.logging import get_logger
from scraper.pdf.hasher import compute_bytes_sha256

logger = get_logger(__name__)


@dataclass
class DownloadedPDF:
    """Encapsulates downloaded PDF data and deduplication metadata."""
    url: str
    sha256_hash: str
    is_duplicate: bool
    file_bytes: Optional[bytes] = None
    file_size_bytes: int = 0
    file_name: Optional[str] = None


class PDFDownloader:
    """Handles controlled streaming download of PDF files with deduplication checks."""

    def __init__(self):
        self.settings = get_settings()
        self.max_bytes = self.settings.pdf_max_download_size_mb * 1024 * 1024
        self.timeout = self.settings.pdf_download_timeout_seconds

    def _download_via_curl(self, pdf_url: str) -> bytes:
        """Download binary content using system curl to bypass malformed government server headers."""
        cmd = [
            "curl.exe" if sys.platform == "win32" else "curl",
            "-k",  # Ignore legacy or invalid SSL certificates common on state portals
            "-s",  # Silent mode
            "-L",  # Follow HTTP redirects
            "--max-time", str(self.timeout),
            pdf_url,
        ]
        try:
            proc = subprocess.run(cmd, capture_output=True, timeout=self.timeout + 5)
            if proc.returncode != 0:
                raise PDFDownloadError(f"curl download failed with exit code {proc.returncode}")
            if not proc.stdout or len(proc.stdout) == 0:
                raise PDFDownloadError(f"curl downloaded 0 bytes from {pdf_url}")
            return proc.stdout
        except Exception as exc:
            raise PDFDownloadError(f"curl fallback download failed for {pdf_url}: {exc}") from exc

    async def download(self, pdf_url: str, check_dedup: bool = True) -> DownloadedPDF:
        """Download PDF content with strict size limits, hash verification, and resilient fallback."""
        logger.info("Initiating PDF download", url=pdf_url)

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "application/pdf,*/*",
        }

        full_bytes: bytes = b""

        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout),
                follow_redirects=True,
                verify=False,
            ) as client:
                async with client.stream("GET", pdf_url, headers=headers) as response:
                    if response.status_code != 200:
                        raise PDFDownloadError(
                            f"HTTP {response.status_code} received when downloading PDF from {pdf_url}"
                        )

                    content_length = response.headers.get("content-length")
                    if content_length and int(content_length) > self.max_bytes:
                        raise PDFDownloadError(
                            f"PDF size ({int(content_length)} bytes) exceeds limit ({self.max_bytes} bytes)."
                        )

                    chunks: list[bytes] = []
                    total_bytes = 0

                    async for chunk in response.aiter_bytes(chunk_size=65536):
                        total_bytes += len(chunk)
                        if total_bytes > self.max_bytes:
                            raise PDFDownloadError(
                                f"Downloaded stream exceeded maximum permitted size of {self.max_bytes} bytes."
                            )
                        chunks.append(chunk)

                    full_bytes = b"".join(chunks)

        except Exception as exc:
            err_msg = str(exc)
            # Government portals (e.g. KPSC) often send non-RFC headers like 'X-XSS-Protection : 1'
            if "illegal header" in err_msg or "Parse Error" in err_msg or "protocol" in err_msg.lower():
                logger.info(
                    "Switching to curl fallback for resilient PDF download (malformed government header detected)",
                    url=pdf_url,
                )
                full_bytes = self._download_via_curl(pdf_url)
            else:
                logger.error("Failed to download PDF", url=pdf_url, error=err_msg)
                raise PDFDownloadError(f"PDF download failed for {pdf_url}: {exc}") from exc

        if len(full_bytes) == 0:
            raise PDFDownloadError(f"Downloaded PDF is empty (0 bytes) from {pdf_url}")

        # Calculate SHA-256 Hash Digest
        sha256 = compute_bytes_sha256(full_bytes)
        file_name = pdf_url.split("/")[-1].split("?")[0] or "notification.pdf"

        # Check Deduplication: Tier 1 (Redis distributed lock) -> Tier 2 (PostgreSQL database)
        is_dup = False
        if check_dedup:
            from scraper.core.redis_client import acquire_pdf_lock, is_pdf_locked

            if is_pdf_locked("all", sha256) or is_pdf_hash_duplicate(sha256):
                is_dup = True
                logger.info(
                    "Duplicate PDF detected via Redis/Database hash check. Halting pipeline.",
                    hash=sha256,
                    url=pdf_url,
                )
                return DownloadedPDF(
                    url=pdf_url,
                    sha256_hash=sha256,
                    is_duplicate=True,
                    file_bytes=None,  # Discard buffer to conserve memory
                    file_size_bytes=len(full_bytes),
                    file_name=file_name,
                )
            else:
                # Acquire 24-hour distributed lock to prevent concurrent duplicate processing
                acquire_pdf_lock("all", sha256, ttl_seconds=86400)

        logger.info("PDF downloaded successfully", url=pdf_url, size_bytes=len(full_bytes), hash=sha256)
        return DownloadedPDF(
            url=pdf_url,
            sha256_hash=sha256,
            is_duplicate=False,
            file_bytes=full_bytes,
            file_size_bytes=len(full_bytes),
            file_name=file_name,
        )
