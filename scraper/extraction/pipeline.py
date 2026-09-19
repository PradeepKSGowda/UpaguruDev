"""End-to-end extraction and draft insertion pipeline for UPA-GURU.

This module orchestrates:
1. Document text sanitization and extraction input validation.
2. Structured parsing via Google Gemini API (Pydantic V2 NotificationExtractedData).
3. Deterministic confidence & completeness scoring (flagging priority_review if < 0.85).
4. Direct persistence into Supabase public.draft_notifications with status='pending_review'.
5. Resilient fallback to metadata baseline drafts if Gemini API key is missing or offline.
"""

from typing import Any, Optional

from scraper.core.db import insert_draft_notification
from scraper.core.exceptions import ConfigurationError, DatabaseError, ExtractionError
from scraper.core.logging import get_logger
from scraper.crawlers.base import CrawledNotificationItem
from scraper.extraction.gemini_extractor import (
    ConfidenceResult,
    GeminiExtractor,
    calculate_confidence_score,
)
from scraper.extraction.schemas import NotificationExtractedData

logger = get_logger(__name__)


def _create_baseline_fallback(
    source_url: str,
    raw_text: str,
    title: Optional[str] = None,
    portal_code: Optional[str] = None,
    error_msg: str = "",
) -> tuple[NotificationExtractedData, ConfidenceResult]:
    """Create a baseline draft structure when Gemini is not configured or fails."""
    clean_title = (title or "Government Recruitment Notification").strip()
    is_corrigendum = any(k in clean_title.lower() for k in ["corrigendum", "extension", "cancellation", "amendment"])
    
    extracted = NotificationExtractedData(
        title=clean_title,
        conducting_body=portal_code or "Government Commission",
        summary=f"Discovered via {portal_code or 'official'} portal. {error_msg}".strip(),
        state_or_central="State" if portal_code in ["KPSC"] else "Central",
        is_corrigendum=is_corrigendum,
    )

    scoring = ConfidenceResult(
        completeness_score=0.25,
        confidence_score=0.25,
        validation_warnings=[
            f"Automated AI extraction pending: {error_msg}. Manual HITL review required.",
        ],
        priority_review=True,
        field_breakdown={"title": 0.15, "conducting_body": 0.10},
    )

    return extracted, scoring


def process_extracted_document(
    raw_text: str,
    source_url: str,
    title: Optional[str] = None,
    pdf_document_id: Optional[str] = None,
    run_id: Optional[str] = None,
    portal_code: Optional[str] = None,
    parent_draft_id: Optional[str] = None,
    extractor: Optional[GeminiExtractor] = None,
    priority_threshold: float = 0.85,
) -> dict[str, Any]:
    """Execute end-to-end structured extraction and insert draft into Supabase."""
    if not raw_text or len(raw_text.strip()) < 20:
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

    # 1. Structured LLM Extraction with Graceful Fallback
    try:
        extracted_data = extractor.extract(raw_text)
        scoring_result = calculate_confidence_score(
            extracted_data,
            priority_threshold=priority_threshold,
        )
    except (ConfigurationError, ExtractionError, Exception) as exc:
        logger.warning(
            "Gemini extraction unavailable; creating baseline draft for admin verification",
            error=str(exc),
            url=source_url,
        )
        extracted_data, scoring_result = _create_baseline_fallback(
            source_url=source_url,
            raw_text=raw_text,
            title=title,
            portal_code=portal_code,
            error_msg=str(exc),
        )

    # 2. Formulate Draft Payload (Sacred HITL Invariant: status='pending_review')
    draft_payload: dict[str, Any] = {
        "source_url": source_url,
        "source_name": portal_code or "Official Portal",
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
        "extraction_model": getattr(extractor, "model_name", "baseline-extractor"),
        "prompt_version": "v1.0",
        "status": "pending_review",
    }

    # 3. Insert into Supabase
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
        logger.error("Failed to persist draft notification to Supabase", source_url=source_url, error=str(exc))
        raise


async def process_extracted_document_async(
    raw_text: str,
    source_url: str,
    title: Optional[str] = None,
    pdf_document_id: Optional[str] = None,
    run_id: Optional[str] = None,
    portal_code: Optional[str] = None,
    parent_draft_id: Optional[str] = None,
    extractor: Optional[GeminiExtractor] = None,
    priority_threshold: float = 0.85,
) -> dict[str, Any]:
    """Asynchronously execute structured extraction and persist draft into Supabase."""
    if not raw_text or len(raw_text.strip()) < 20:
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

    # 1. Structured LLM Extraction with Graceful Fallback
    try:
        extracted_data = await extractor.extract_async(raw_text)
        scoring_result = calculate_confidence_score(
            extracted_data,
            priority_threshold=priority_threshold,
        )
    except (ConfigurationError, ExtractionError, Exception) as exc:
        logger.warning(
            "Gemini async extraction unavailable; creating baseline draft for admin verification",
            error=str(exc),
            url=source_url,
        )
        extracted_data, scoring_result = _create_baseline_fallback(
            source_url=source_url,
            raw_text=raw_text,
            title=title,
            portal_code=portal_code,
            error_msg=str(exc),
        )

    # 2. Formulate Draft Payload (Sacred HITL Invariant: status='pending_review')
    draft_payload: dict[str, Any] = {
        "source_url": source_url,
        "source_name": portal_code or "Official Portal",
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
        "extraction_model": getattr(extractor, "model_name", "baseline-extractor"),
        "prompt_version": "v1.0",
        "status": "pending_review",
    }

    # 3. Insert into Supabase
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
        logger.error("Failed to persist draft notification in async pipeline", source_url=source_url, error=str(exc))
        raise


async def process_crawled_item_async(
    item: CrawledNotificationItem,
    pdf_document_id: Optional[str] = None,
    run_id: Optional[str] = None,
    extractor: Optional[GeminiExtractor] = None,
) -> Optional[dict[str, Any]]:
    """Convenience helper to extract and insert a CrawledNotificationItem directly."""
    if item.is_duplicate:
        logger.info("Skipping extraction for duplicate item", url=item.pdf_url)
        return None

    if not item.raw_text:
        logger.warning("Crawled item lacks extracted text; skipping extraction", url=item.pdf_url)
        return None

    return await process_extracted_document_async(
        raw_text=item.raw_text,
        source_url=item.pdf_url,
        title=item.title,
        pdf_document_id=pdf_document_id,
        run_id=run_id,
        portal_code=item.portal_code,
        extractor=extractor,
    )
