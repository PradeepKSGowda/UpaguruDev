"""Storage management for temporary PDF caching and Supabase Storage uploads."""

import os
from pathlib import Path
from typing import Optional
from scraper.config.settings import get_settings
from scraper.core.logging import get_logger
from scraper.core.db import get_supabase_client

logger = get_logger(__name__)

CACHE_DIR = Path("./temp_pdf_cache")


def ensure_cache_directory() -> Path:
    """Ensure local cache directory exists."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return CACHE_DIR


def upload_pdf_to_storage(bucket_name: str, file_path: Path, destination_key: str) -> Optional[str]:
    """Upload a downloaded PDF to Supabase Storage bucket."""
    try:
        client = get_supabase_client()
        with open(file_path, "rb") as f:
            file_bytes = f.read()

        client.storage.from_(bucket_name).upload(
            path=destination_key,
            file=file_bytes,
            file_options={"content-type": "application/pdf", "upsert": "true"},
        )
        logger.info("Uploaded PDF to storage", bucket=bucket_name, key=destination_key)
        return destination_key
    except Exception as exc:
        logger.warning("Failed to upload PDF to Supabase Storage, keeping local path", error=str(exc))
        return None
