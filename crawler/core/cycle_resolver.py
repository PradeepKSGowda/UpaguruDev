"""Deterministic Document-to-Cycle Matching Engine.

Evaluates weighted signals between incoming extracted document payloads and
existing or candidate exam cycles, producing explainable link decisions.
"""

import re
from typing import Any, Optional
from crawler.core.confidence_engine import ConfidenceEngine
from crawler.core.models import (
    CycleMatchCandidate,
    DocumentType,
    ExtractedDocumentPayload,
    LinkingDecision,
    ResolvedExamCandidate,
)


class CycleResolver:
    """Resolves an extracted document to an existing or newly initialized Exam Cycle."""

    @classmethod
    def resolve_cycle(
        cls,
        doc: ExtractedDocumentPayload,
        exam_candidate: Optional[ResolvedExamCandidate],
        existing_cycles: list[dict[str, Any]],
    ) -> CycleMatchCandidate:
        """
        Evaluate candidate cycles and match against document signals.

        Args:
            doc: Extracted document with text, title, references, and dates
            exam_candidate: Resolved canonical Exam Master
            existing_cycles: List of active cycle dictionaries in the organization

        Returns:
            CycleMatchCandidate with score, decision, and reasons
        """
        combined_text = f"{doc.title} {doc.text_content[:4000]}".lower()

        # 1. Detect candidate cycle year
        detected_year = cls._detect_year(doc)

        # If no Exam Master resolved, cannot auto-link to a cycle
        if not exam_candidate:
            return CycleMatchCandidate(
                cycle_code="UNRESOLVED",
                cycle_label="Unresolved Exam",
                score=0.0,
                decision=LinkingDecision.DO_NOT_LINK,
                reasons=["no_canonical_exam_resolved"],
                signals={},
                is_new_cycle=False,
            )

        # 2. Iterate existing cycles to evaluate match signals
        best_candidate: Optional[CycleMatchCandidate] = None
        best_score = -1.0

        for cycle in existing_cycles:
            signals: dict[str, bool] = {
                "exact_reference_match": False,
                "explicit_text_citation": False,
                "exact_exam_and_year": False,
                "exact_exam_inferred_year": False,
                "alias_and_year": False,
                "stage_compatibility": False,
                "title_similarity": False,
                "conflicting_reference": False,
                "conflicting_year": False,
                "stage_regression": False,
            }

            cycle_id = str(cycle.get("id", ""))
            cycle_code = cycle.get("cycle_code", "")
            cycle_year = cycle.get("cycle_year")
            cycle_exam_code = cycle.get("exam_code", "")
            primary_ref = (cycle.get("primary_reference_no") or "").strip().upper()

            # Signal: Exact Reference Number Match
            doc_refs = [r.normalized_reference.upper() for r in doc.references] + [
                r.raw_reference.upper() for r in doc.references
            ]
            if primary_ref and any(primary_ref in r or r in primary_ref for r in doc_refs):
                signals["exact_reference_match"] = True

            # Signal: Exact Exam Master and Year
            if cycle_exam_code == exam_candidate.exam_code:
                if detected_year and cycle_year == detected_year:
                    signals["exact_exam_and_year"] = True
                elif cycle_year and detected_year and cycle_year != detected_year:
                    signals["conflicting_year"] = True
                else:
                    signals["exact_exam_inferred_year"] = True

            score, decision, reasons = ConfidenceEngine.evaluate(signals)

            if score > best_score:
                best_score = score
                best_candidate = CycleMatchCandidate(
                    exam_master_id=cycle.get("exam_master_id"),
                    exam_cycle_id=cycle_id,
                    cycle_code=cycle_code,
                    cycle_year=cycle_year,
                    cycle_label=cycle.get("cycle_label", cycle_code),
                    score=score,
                    decision=decision,
                    reasons=reasons,
                    signals=signals,
                    is_new_cycle=False,
                )

        # 3. If an existing cycle matched with acceptable score, return it
        if best_candidate and best_candidate.score >= ConfidenceEngine.REVIEW_THRESHOLD:
            return best_candidate

        # 4. If no existing cycle matches, evaluate if this represents a new cycle
        year_to_use = detected_year or (doc.publication_date.year if doc.publication_date else 2026)
        new_cycle_code = f"{exam_candidate.exam_code}_{year_to_use}"
        new_cycle_label = f"{exam_candidate.canonical_name} {year_to_use}"

        new_signals = {
            "exact_exam_and_year": bool(detected_year),
            "exact_exam_inferred_year": not bool(detected_year),
        }
        score, decision, reasons = ConfidenceEngine.evaluate(new_signals)

        return CycleMatchCandidate(
            cycle_code=new_cycle_code,
            cycle_year=year_to_use,
            cycle_label=new_cycle_label,
            score=score,
            decision=decision,
            reasons=reasons + ["new_cycle_proposed"],
            signals=new_signals,
            is_new_cycle=True,
        )

    @classmethod
    def _detect_year(cls, doc: ExtractedDocumentPayload) -> Optional[int]:
        """Extract explicit 4-digit cycle year from title, references, or text header."""
        # 1. Search in title first
        title_match = re.search(r"\b(202[0-9]|203[0-9])\b", doc.title)
        if title_match:
            return int(title_match.group(1))

        # 2. Search in extracted references (e.g., '01/2026', 'CEN 01/2026')
        for ref in doc.references:
            ref_match = re.search(r"/(\d{4})\b", ref.raw_reference)
            if ref_match:
                return int(ref_match.group(1))

        # 3. Search in initial text header
        header_text = doc.text_content[:2000]
        header_match = re.search(r"\b(202[0-9]|203[0-9])\b", header_text)
        if header_match:
            return int(header_match.group(1))

        # 4. Fallback to publication date if present
        if doc.publication_date:
            return doc.publication_date.year

        return None
