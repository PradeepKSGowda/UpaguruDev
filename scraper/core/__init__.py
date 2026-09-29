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
    "CrawlerOrchestrator",
    "ExamNormalizer",
    "ReferenceExtractor",
    "DocumentClassifier",
    "CycleResolver",
    "DocumentLinker",
    "EventExtractor",
    "VersioningEngine",
    "StateEngine",
    "DataQualityValidator",
    "ConfidenceEngine",
]

# Bridge lifecycle intelligence engine
from crawler.core.crawler_orchestrator import CrawlerOrchestrator
from crawler.core.exam_normalizer import ExamNormalizer
from crawler.core.reference_extractor import ReferenceExtractor
from crawler.core.document_classifier import DocumentClassifier
from crawler.core.cycle_resolver import CycleResolver
from crawler.core.document_linker import DocumentLinker
from crawler.core.event_extractor import EventExtractor
from crawler.core.versioning_engine import VersioningEngine
from crawler.core.state_engine import StateEngine
from crawler.core.data_quality import DataQualityValidator
from crawler.core.confidence_engine import ConfidenceEngine

