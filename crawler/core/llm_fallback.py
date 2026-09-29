"""Strictly-Guarded LLM Fallback Extractor with Verbatim Quote Verification.

Invoked only when deterministic rules yield low confidence.
Enforces strict hallucination guards: verifies that proposed quotes actually exist
in the source text before accepting any extracted value.
"""

from typing import Any, Optional
from crawler.core.models import ExtractionMethod


class GuardedLLMExtractor:
    """Safely extracts structured fields via LLM with substring quote verification."""

    @classmethod
    def verify_quote(cls, quote: str, source_text: str) -> bool:
        """
        Verify that the LLM's cited source quote actually exists in the document text.

        Rejects hallucinated quotes.
        """
        if not quote or not source_text:
            return False

        clean_quote = " ".join(quote.lower().split())
        clean_source = " ".join(source_text.lower().split())

        return clean_quote in clean_source

    @classmethod
    def process_llm_candidate(
        cls,
        field_name: str,
        extracted_value: Any,
        verbatim_quote: str,
        source_text: str,
        page_number: Optional[int] = None,
        confidence: float = 75.0,
    ) -> Optional[dict[str, Any]]:
        """
        Validate and format an LLM extraction output.

        Returns None if the verbatim quote is not found in source_text.
        """
        if not cls.verify_quote(verbatim_quote, source_text):
            # Hallucination guard triggered
            return None

        # Clamp confidence for LLM outputs
        adjusted_confidence = min(84.0, confidence)  # Force review queue if not verified by rule

        return {
            "field_name": field_name,
            "field_value": extracted_value,
            "source_text": verbatim_quote,
            "page_number": page_number,
            "confidence": adjusted_confidence,
            "extraction_method": ExtractionMethod.LLM.value,
            "verification_status": "REVIEW_REQUIRED",
        }
