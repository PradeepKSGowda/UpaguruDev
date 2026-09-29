"""End-to-End Crawler and Intelligence Pipeline Orchestrator.

Coordinates the complete 12-step recruitment document lifecycle pipeline:
Discovery -> Download & Hash -> Extract -> Classify -> Resolve Exam & Cycle ->
Link Documents -> Extract Events & Fields -> Version Non-Destructively ->
Quality Gate -> Recompute State -> Emit Domain Events.
"""

from datetime import datetime, timezone
from typing import Any, Optional
from crawler.core.audit import AuditLogger
from crawler.core.cycle_resolver import CycleResolver
from crawler.core.data_quality import DataQualityValidator
from crawler.core.deduplication import DeduplicationEngine
from crawler.core.document_classifier import DocumentClassifier
from crawler.core.document_linker import DocumentLinker
from crawler.core.event_extractor import EventExtractor
from crawler.core.exam_normalizer import ExamNormalizer
from crawler.core.models import (
    CycleStatus,
    DocumentType,
    ExtractedDocumentPayload,
    LinkingDecision,
)
from crawler.core.reference_extractor import ReferenceExtractor
from crawler.core.state_engine import StateEngine
from crawler.core.url_canonicalizer import URLCanonicalizer
from crawler.core.versioning_engine import VersioningEngine


class CrawlerOrchestrator:
    """Coordinates lifecycle processing for discovered government recruitment documents."""

    def __init__(self, db_client: Any = None):
        self.db = db_client

    def process_document(
        self,
        raw_url: str,
        title: str,
        file_bytes: bytes,
        extracted_text: str,
        organization_code: str,
        base_url: str = "",
        existing_cycles: list[dict[str, Any]] | None = None,
        existing_events: list[dict[str, Any]] | None = None,
        existing_docs: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """
        Execute full lifecycle pipeline synchronously or offline.

        Returns comprehensive result dictionary with document, cycle, events,
        relationships, and review queue recommendations.
        """
        # Step 1: URL Canonicalization
        canonical_url = URLCanonicalizer.canonicalize(raw_url, base_url=base_url)

        # Step 2: Binary & Content Hashing
        doc_hash = DeduplicationEngine.compute_binary_hash(file_bytes) if file_bytes else None
        content_hash = DeduplicationEngine.compute_content_hash(extracted_text)

        # Step 3: Reference Extraction
        references = ReferenceExtractor.extract_references(
            text=extracted_text,
            title=title,
            url=canonical_url,
            organization_code=organization_code,
        )

        norm_title, _ = ExamNormalizer.normalize_title(title)
        doc_payload = ExtractedDocumentPayload(
            document_id=f"doc_{doc_hash[:12]}" if doc_hash else "doc_temp",
            organization_code=organization_code,
            source_url=raw_url,
            canonical_url=canonical_url,
            title=title,
            normalized_title=norm_title,
            file_size_bytes=len(file_bytes) if file_bytes else 0,
            document_hash=doc_hash,
            content_hash=content_hash,
            text_content=extracted_text,
            references=references,
        )

        # Step 4: Document Classification
        classification = DocumentClassifier.classify(title=title, text=extracted_text)
        doc_payload.is_multi_exam = classification.is_multi_exam

        # Step 5: Canonical Exam Master Resolution
        exam_candidate = ExamNormalizer.resolve_exam(
            text=extracted_text,
            organization_code=organization_code,
            title=title,
        )

        # Step 6: Cycle Resolution & Confidence Gate
        cycle_match = CycleResolver.resolve_cycle(
            doc=doc_payload,
            exam_candidate=exam_candidate,
            existing_cycles=existing_cycles or [],
        )

        # Step 7: Document Relationships
        relationships = DocumentLinker.detect_relationships(
            doc=doc_payload,
            existing_cycle_documents=existing_docs or [],
        )

        # Step 8: Event Extraction
        extracted_events = EventExtractor.extract_events(text=extracted_text)

        # Step 9: Non-Destructive Event Versioning
        prior_event_updates = []
        new_event_inserts = []
        cycle_events = list(existing_events or [])

        for ev in extracted_events:
            prior_up, new_ins = VersioningEngine.process_event_supersession(
                new_event=ev,
                existing_events=cycle_events,
                document_id=doc_payload.document_id or "doc_temp",
            )
            if prior_up:
                prior_event_updates.append(prior_up)
            if new_ins:
                new_event_inserts.append(new_ins)
                cycle_events.append(new_ins)

        # Step 10: Data Quality Validation
        quality_violations = DataQualityValidator.validate_cycle(events=cycle_events)

        # Step 11: Recompute Cycle State & Latest Update
        all_cycle_docs = list(existing_docs or []) + [
            {
                "id": doc_payload.document_id,
                "title": doc_payload.title,
                "document_type": classification.document_type.value,
                "publication_date": doc_payload.publication_date,
                "source_url": doc_payload.source_url,
            }
        ]
        cycle_status, current_stage = StateEngine.calculate_cycle_state(
            events=cycle_events,
            documents=all_cycle_docs,
        )
        latest_update = StateEngine.calculate_latest_update(documents=all_cycle_docs)

        # Step 12: Emit Domain Event Outbox Payload
        domain_event = None
        if cycle_match.decision == LinkingDecision.AUTO_LINK:
            event_type_name = "NEW_NOTIFICATION"
            if classification.document_type == DocumentType.EXAM_DATE_CHANGE:
                event_type_name = "EXAM_DATE_CHANGED"
            elif classification.document_type == DocumentType.ADMIT_CARD:
                event_type_name = "ADMIT_CARD_RELEASED"
            elif classification.document_type == DocumentType.FINAL_RESULT:
                event_type_name = "FINAL_RESULT_RELEASED"
            elif classification.document_type == DocumentType.CORRIGENDUM:
                event_type_name = "CORRIGENDUM_PUBLISHED"

            domain_event = {
                "exam_cycle_id": cycle_match.exam_cycle_id or cycle_match.cycle_code,
                "source_document_id": doc_payload.document_id,
                "domain_event_type": event_type_name,
                "title": doc_payload.title,
                "summary": f"{classification.document_type.value} published for {cycle_match.cycle_label}",
                "dedupe_key": f"{cycle_match.cycle_code}:{doc_payload.document_hash or doc_payload.canonical_url}",
                "published": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

        # Format review queue item if confidence < 85 or quality violations exist
        review_queue_item = None
        if cycle_match.decision in (LinkingDecision.REVIEW_RECOMMENDED, LinkingDecision.DO_NOT_LINK) or quality_violations:
            review_queue_item = {
                "item_type": "DATA_QUALITY_FLAG" if quality_violations else "DOCUMENT_CYCLE_LINK",
                "priority": "HIGH" if quality_violations else "MEDIUM",
                "document_id": doc_payload.document_id,
                "proposed_exam_master_id": exam_candidate.exam_code if exam_candidate else None,
                "proposed_exam_cycle_id": cycle_match.exam_cycle_id,
                "confidence": cycle_match.score,
                "reasons_json": cycle_match.reasons + [v["message"] for v in quality_violations],
                "status": "PENDING",
            }

        return {
            "document": doc_payload,
            "classification": classification,
            "exam_candidate": exam_candidate,
            "cycle_match": cycle_match,
            "relationships": relationships,
            "events_extracted": len(extracted_events),
            "prior_event_updates": prior_event_updates,
            "new_event_inserts": new_event_inserts,
            "quality_violations": quality_violations,
            "cycle_state": {
                "status": cycle_status.value,
                "current_stage": current_stage,
                "latest_update": latest_update,
            },
            "domain_event": domain_event,
            "review_queue_item": review_queue_item,
        }
