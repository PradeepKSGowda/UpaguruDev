"""Explicit Inter-Document Citation and Relationship Linker.

Scans document body for official citation phrases ("in continuation of...",
"corrigendum to...", "with reference to notice dated...") to build directed graph edges.
"""

import re
from typing import Optional
from crawler.core.models import (
    ExtractedDocumentPayload,
    RelationshipCandidate,
    RelationshipType,
)


class DocumentLinker:
    """Detects explicit references linking later documents to earlier documents in an exam cycle."""

    CITATION_PATTERNS: list[tuple[RelationshipType, re.Pattern, float]] = [
        (
            RelationshipType.CORRIGENDUM_OF,
            re.compile(r"\b(?:corrigendum\s+to|in\s+partial\s+modification\s+of|addendum\s+to|errata\s+to)\s+([A-Za-z0-9\s/.,\-]+)", re.IGNORECASE),
            95.0,
        ),
        (
            RelationshipType.EXTENSION_OF,
            re.compile(r"\b(?:in\s+continuation\s+of|extension\s+of\s+(?:last\s+)?date\s+(?:for|to|of))\s+([A-Za-z0-9\s/.,\-]+)", re.IGNORECASE),
            90.0,
        ),
        (
            RelationshipType.DATE_CHANGE_OF,
            re.compile(r"\b(?:rescheduled|rescheduling\s+of|revised\s+schedule\s+for|in\s+supersession\s+of\s+notice)\s+([A-Za-z0-9\s/.,\-]+)", re.IGNORECASE),
            90.0,
        ),
        (
            RelationshipType.RESULT_FOR,
            re.compile(r"\b(?:result\s+of\s+(?:the\s+)?(?:written\s+examination|cbt|prelims|mains))\s+held\s+on\s+([A-Za-z0-9\s/.,\-]+)", re.IGNORECASE),
            95.0,
        ),
        (
            RelationshipType.ADMIT_CARD_FOR,
            re.compile(r"\b(?:e-admit\s+card|hall\s+ticket)\s+(?:for|of)\s+([A-Za-z0-9\s/.,\-]+)", re.IGNORECASE),
            90.0,
        ),
    ]

    @classmethod
    def detect_relationships(
        cls,
        doc: ExtractedDocumentPayload,
        existing_cycle_documents: list[dict[str, str]] | None = None,
    ) -> list[RelationshipCandidate]:
        """
        Scan document text and title for explicit relationships to earlier documents.

        Args:
            doc: Extracted document payload
            existing_cycle_documents: Optional list of earlier documents in the same cycle

        Returns:
            List of detected RelationshipCandidate objects
        """
        combined = f"{doc.title}\n{doc.text_content[:6000]}"
        candidates: list[RelationshipCandidate] = []
        existing_docs = existing_cycle_documents or []

        for rel_type, pattern, base_conf in cls.CITATION_PATTERNS:
            match = pattern.search(combined)
            if match:
                cited_clause = match.group(1).strip()[:100]
                reason = f"Detected citation pattern for {rel_type.value}: '{match.group(0)[:60]}'"

                # Attempt to link to earlier document in the cycle
                target_doc_id: Optional[str] = None
                target_ref: Optional[str] = None

                # Find if cited clause mentions an earlier doc's reference or date
                for earlier in existing_docs:
                    earlier_ref = (earlier.get("reference_number") or "").lower()
                    if earlier_ref and earlier_ref in cited_clause.lower():
                        target_doc_id = earlier.get("id")
                        target_ref = earlier.get("reference_number")
                        break

                # If no specific document matched, default target to the cycle's primary notification
                if not target_doc_id and existing_docs:
                    primary_doc = next(
                        (d for d in existing_docs if d.get("document_type") in ("INITIAL_NOTIFICATION", "RECRUITMENT_NOTIFICATION")),
                        existing_docs[0],
                    )
                    target_doc_id = primary_doc.get("id")
                    target_ref = primary_doc.get("reference_number")

                candidates.append(
                    RelationshipCandidate(
                        target_document_id=target_doc_id,
                        target_reference=target_ref,
                        relationship_type=rel_type,
                        confidence=base_conf,
                        reason=reason,
                        signals={"matched_phrase": match.group(0), "cited_clause": cited_clause},
                    )
                )

        return candidates
