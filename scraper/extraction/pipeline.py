"""End-to-end extraction and draft insertion pipeline for UPA-GURU.

This module orchestrates:
1. Document text sanitization and extraction input validation.
2. Structured parsing via Google Gemini API (Pydantic V2 NotificationExtractedData).
3. Deterministic confidence & completeness scoring (flagging priority_review if < 0.85).
4. Direct persistence into Supabase public.draft_notifications with status='pending_review'.
"""

from typing import Any, Optional

from scraper.core.db import insert_draft_notification
from scraper.core.exceptions import DatabaseError, ExtractionError
from scraper.core.logging import get_logger
from scraper.crawlers.base import CrawledNotificationItem
from scraper.extraction.gemini_extractor import (
    ConfidenceResult,
    GeminiExtractor,
    calculate_confidence_score,
)
from scraper.extraction.schemas import NotificationExtractedData

logger = get_logger(__name__)


def process_extracted_document(
    raw_text: str,
    source_url: str,
    pdf_document_id: Optional[str] = None,
    run_id: Optional[str] = None,
    portal_code: Optional[str] = None,
    parent_draft_id: Optional[str] = None,
    extractor: Optional[GeminiExtractor] = None,
    priority_threshold: float = 0.85,
) -> dict[str, Any]:
    """Execute end-to-end structured extraction and insert draft into Supabase.

    Workflow:
      1. Validates raw text payload.
      2. Calls GeminiExtractor with Structured Outputs.
      3. Computes completeness score, confidence score, and validation warnings.
      4. Flags drafts with confidence/completeness < 0.85 for priority review.
      5. Enforces Sacred HITL Invariant (status='pending_review').
      6. Persists into public.draft_notifications.

    Args:
        raw_text: Extracted text from PDF document.
        source_url: Source link / official PDF URL.
        pdf_document_id: Foreign key to public.pdf_documents.
        run_id: Foreign key to public.crawl_runs.
        portal_code: Portal identifier (KPSC, UPSC, SSC, RRB).
        parent_draft_id: Optional parent draft UUID for corrigendum notices.
        extractor: Optional GeminiExtractor instance. Defaults to new instance.
        priority_threshold: Threshold below which drafts are marked priority_review (default 0.85).

    Returns:
        Persisted draft notification record from Supabase.

    Raises:
        ExtractionError: If text is empty or Gemini extraction fails.
        DatabaseError: If insertion into Supabase fails.
    """
    if not raw_text or len(raw_text.strip()) < 50:
        logger.warning(
            "Skipping extraction: raw text is empty or too short",
            source_url=source_url,
            text_len=len(raw_text) if raw_text else 0,
        )
        raise ExtractionError(
            "Document text contains insufficient content for extraction.",
            details={"source_url": source_url, "length": len(raw_text) if raw_text else 0},
        )

    if extractor is None:
        extractor = GeminiExtractor()

    logger.info(
        "Initiating document extraction pipeline",
        source_url=source_url,
        portal_code=portal_code,
        pdf_document_id=pdf_document_id,
    )

    # 1. Structured LLM Extraction
    extracted_data: NotificationExtractedData = extractor.extract(raw_text)

    # 2. Confidence & Completeness Scoring
    scoring_result: ConfidenceResult = calculate_confidence_score(
        extracted_data,
        priority_threshold=priority_threshold,
    )

    logger.info(
        "Extraction completed and scored",
        title=extracted_data.title,
        completeness_score=scoring_result.completeness_score,
        confidence_score=scoring_result.confidence_score,
        priority_review=scoring_result.priority_review,
        warnings_count=len(scoring_result.validation_warnings),
    )

    # 3. Formulate Draft Payload (Sacred HITL Invariant: status='pending_review')
    draft_payload: dict[str, Any] = {
        "source_url": source_url,
        "raw_text": raw_text[:50000],  # Bound raw text to prevent excessive DB storage
        "raw_extracted_text": raw_text[:50000],  # Backwards compatibility with initial schema
        "parsed_json": extracted_data.model_dump(mode="json"),
        "extraction_confidence_score": scoring_result.confidence_score,
        "completeness_score": scoring_result.completeness_score,
        "validation_warnings": scoring_result.validation_warnings,
        "priority_review": scoring_result.priority_review,
        "is_corrigendum": extracted_data.is_corrigendum or False,
        "pdf_document_id": pdf_document_id,
        "run_id": run_id,
        "parent_draft_id": parent_draft_id,
        "extraction_model": extractor.model_name,
        "prompt_version": "v1.0",
        "status": "pending_review",
    }

    # 4. Insert into Supabase
    try:
        inserted_record = insert_draft_notification(draft_payload)
        logger.info(
            "Draft notification successfully persisted for Admin HITL verification",
            draft_id=inserted_record.get("id"),
            title=extracted_data.title,
            priority_review=scoring_result.priority_review,
        )
        return inserted_record
    except DatabaseError as exc:
        logger.error(
            "Failed to persist draft notification to Supabase",
            source_url=source_url,
            error=str(exc),
        )
        raise


async def process_extracted_document_async(
    raw_text: str,
    source_url: str,
    pdf_document_id: Optional[str] = None,
    run_id: Optional[str] = None,
    portal_code: Optional[str] = None,
    parent_draft_id: Optional[str] = None,
    extractor: Optional[GeminiExtractor] = None,
    priority_threshold: float = 0.85,
) -> dict[str, Any]:
    """Asynchronously execute structured extraction and persist draft into Supabase.

    Non-blocking orchestration designed for async crawler loops and background workers.
    """
    if not raw_text or len(raw_text.strip()) < 50:
        logger.warning(
            "Skipping async extraction: raw text is empty or too short",
            source_url=source_url,
            text_len=len(raw_text) if raw_text else 0,
        )
        raise ExtractionError(
            "Document text contains insufficient content for extraction.",
            details={"source_url": source_url, "length": len(raw_text) if raw_text else 0},
        )

    if extractor is None:
        extractor = GeminiExtractor()

    logger.info(
        "Initiating async document extraction pipeline",
        source_url=source_url,
        portal_code=portal_code,
        pdf_document_id=pdf_document_id,
    )

    # 1. Asynchronous Structured LLM Extraction
    extracted_data: NotificationExtractedData = await extractor.extract_async(raw_text)

    # 2. Confidence & Completeness Scoring
    scoring_result: ConfidenceResult = calculate_confidence_score(
        extracted_data,
        priority_threshold=priority_threshold,
    )

    logger.info(
        "Async extraction completed and scored",
        title=extracted_data.title,
        completeness_score=scoring_result.completeness_score,
        confidence_score=scoring_result.confidence_score,
        priority_review=scoring_result.priority_review,
        warnings_count=len(scoring_result.validation_warnings),
    )

    # 3. Formulate Draft Payload (Sacred HITL Invariant: status='pending_review')
    draft_payload: dict[str, Any] = {
        "source_url": source_url,
        "raw_text": raw_text[:50000],
        "raw_extracted_text": raw_text[:50000],
        "parsed_json": extracted_data.model_dump(mode="json"),
        "extraction_confidence_score": scoring_result.confidence_score,
        "completeness_score": scoring_result.completeness_score,
        "validation_warnings": scoring_result.validation_warnings,
        "priority_review": scoring_result.priority_review,
        "is_corrigendum": extracted_data.is_corrigendum or False,
        "pdf_document_id": pdf_document_id,
        "run_id": run_id,
        "parent_draft_id": parent_draft_id,
        "extraction_model": extractor.model_name,
        "prompt_version": "v1.0",
        "status": "pending_review",
    }

    # 4. Insert into Supabase
    try:
        inserted_record = insert_draft_notification(draft_payload)
        logger.info(
            "Draft notification successfully persisted (async)",
            draft_id=inserted_record.get("id"),
            title=extracted_data.title,
            priority_review=scoring_result.priority_review,
        )
        return inserted_record
    except DatabaseError as exc:
        logger.error(
            "Failed to persist draft notification to Supabase in async pipeline",
            source_url=source_url,
            error=str(exc),
        )
        raise


async def process_crawled_item_async(
    item: CrawledNotificationItem,
    pdf_document_id: Optional[str] = None,
    run_id: Optional[str] = None,
    extractor: Optional[GeminiExtractor] = None,
) -> Optional[dict[str, Any]]:
    """Convenience helper to extract and insert a CrawledNotificationItem directly.

    Args:
        item: Crawled notification item from portal crawler.
        pdf_document_id: Optional foreign key to persisted pdf_documents record.
        run_id: Optional foreign key to active crawl_runs record.
        extractor: Optional GeminiExtractor instance.

    Returns:
        Inserted draft dictionary or None if text is missing or duplicate.
    """
    if item.is_duplicate:
        logger.info("Skipping extraction for duplicate item", url=item.pdf_url)
        return None

    if not item.raw_text:
        logger.warning("Crawled item lacks extracted text; skipping extraction", url=item.pdf_url)
        return None

    return await process_extracted_document_async(
        raw_text=item.raw_text,
        source_url=item.pdf_url,
        pdf_document_id=pdf_document_id,
        run_id=run_id,
        portal_code=item.portal_code,
        extractor=extractor,
    )
