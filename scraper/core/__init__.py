"""Core infrastructure package for UPA-GURU Scraper Microservice."""

from .logging import get_logger, configure_logging
from .exceptions import (
    ScraperBaseException,
    ConfigurationError,
    FetchError,
    PDFDownloadError,
    DeduplicationError,
    ExtractionError,
    DatabaseError,
)
from .db import (
    get_supabase_client,
    is_pdf_hash_duplicate,
    insert_pdf_document,
    create_crawl_run,
    update_crawl_run,
    insert_draft_notification,
)

__all__ = [
    "get_logger",
    "configure_logging",
    "ScraperBaseException",
    "ConfigurationError",
    "FetchError",
    "PDFDownloadError",
    "DeduplicationError",
    "ExtractionError",
    "DatabaseError",
    "get_supabase_client",
    "is_pdf_hash_duplicate",
    "insert_pdf_document",
    "create_crawl_run",
    "update_crawl_run",
    "insert_draft_notification",
]
