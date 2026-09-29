"""Base Recruitment Source Adapter Contract.

Defines the formal interface that all organization-specific adapters (UPSC, KPSC,
SSC, RRB, IBPS) must implement or inherit, providing common default pipelines
while allowing commission-specific overrides for HTML structures and terminology.
"""

from abc import ABC, abstractmethod
from typing import Any, Optional
from crawler.core.document_classifier import DocumentClassifier
from crawler.core.exam_normalizer import ExamNormalizer
from crawler.core.models import (
    ClassificationResult,
    CycleMatchCandidate,
    DiscoveredLink,
    ExtractedDocumentPayload,
    ExtractedEventCandidate,
    ExtractedFieldChange,
    ReferenceIdentity,
    RelationshipCandidate,
    ResolvedExamCandidate,
)
from crawler.core.reference_extractor import ReferenceExtractor


class RecruitmentSourceAdapter(ABC):
    """Base contract for all organization-specific recruitment intelligence adapters."""

    organization_code: str = "BASE"

    def __init__(self, config: dict[str, Any] | None = None):
        self.config = config or {}

    @abstractmethod
    def discover_documents(self) -> list[DiscoveredLink]:
        """Crawl official listing pages/feeds and yield candidate document links with context."""
        raise NotImplementedError

    def normalize_title(self, title: str) -> str:
        """Apply common + org-specific title cleanup and abbreviation expansion."""
        norm, _ = ExamNormalizer.normalize_title(title)
        return norm

    def extract_references(self, doc: ExtractedDocumentPayload) -> list[ReferenceIdentity]:
        """Extract Advt No., Notification No., CEN, CRP, or File No. from text/title/URL."""
        return ReferenceExtractor.extract_references(
            text=doc.text_content,
            title=doc.title,
            url=doc.canonical_url,
            organization_code=self.organization_code,
        )

    def classify_document(self, doc: ExtractedDocumentPayload) -> ClassificationResult:
        """Classify document_type with confidence and matched rules."""
        return DocumentClassifier.classify(title=doc.title, text=doc.text_content)

    def resolve_exams(self, doc: ExtractedDocumentPayload) -> list[ResolvedExamCandidate]:
        """Identify one or more Exam Masters referenced in the document (supports 1:1 and 1:N)."""
        candidate = ExamNormalizer.resolve_exam(
            text=doc.text_content,
            organization_code=self.organization_code,
            title=doc.title,
        )
        return [candidate] if candidate else []

    def detect_cycle(
        self,
        doc: ExtractedDocumentPayload,
        exam_candidate: ResolvedExamCandidate,
        existing_cycles: list[dict[str, Any]] | None = None,
    ) -> CycleMatchCandidate:
        """Determine cycle year/code/edition for a resolved Exam Master."""
        from crawler.core.cycle_resolver import CycleResolver

        return CycleResolver.resolve_cycle(
            doc=doc,
            exam_candidate=exam_candidate,
            existing_cycles=existing_cycles or [],
        )

    def extract_events(
        self,
        doc: ExtractedDocumentPayload,
        exam_candidate: Optional[ResolvedExamCandidate] = None,
    ) -> list[ExtractedEventCandidate]:
        """Extract semantic stage dates/milestones with verbatim source text and page numbers."""
        from crawler.core.event_extractor import EventExtractor

        return EventExtractor.extract_events(text=doc.text_content)

    def extract_field_changes(
        self, doc: ExtractedDocumentPayload
    ) -> list[ExtractedFieldChange]:
        """Extract vacancies, fee updates, age/eligibility revisions, or corrigendum deltas."""
        # Baseline rule extraction for vacancies
        import re
        changes: list[ExtractedFieldChange] = []
        vac_match = re.search(r"\b(?:vacancies|posts)\s*(?:are\s*revised\s*to|increased\s*to|fixed\s*at|now\s*stands\s*at)?\s*[:\-]?\s*(\d{1,5})\b", doc.text_content, re.IGNORECASE)
        if vac_match:
            try:
                new_vac = int(vac_match.group(1))
                changes.append(
                    ExtractedFieldChange(
                        field_name="total_vacancies",
                        new_value=new_vac,
                        change_summary=f"Vacancies updated to {new_vac}",
                        source_text=doc.text_content[max(0, vac_match.start() - 20): min(len(doc.text_content), vac_match.end() + 20)].strip(),
                        confidence=85.0,
                    )
                )
            except ValueError:
                pass
        return changes

    def detect_relationships(
        self, doc: ExtractedDocumentPayload, existing_docs: list[dict[str, Any]] | None = None
    ) -> list[RelationshipCandidate]:
        """Identify explicit or structural links to earlier documents in the same cycle."""
        from crawler.core.document_linker import DocumentLinker

        return DocumentLinker.detect_relationships(
            doc=doc,
            existing_cycle_documents=existing_docs or [],
        )
