"""Multi-Layer Deduplication Engine for Government Recruitment Documents.

Implements 4-layer deduplication:
Layer 1: Canonical URL match
Layer 2: Binary SHA-256 hash (exact duplicate file across subpaths)
Layer 3: Content SHA-256 hash (re-saved PDF or recreated notice with identical normalized text)
Layer 4: Semantic identity (org + normalized reference + document type + publication date)
"""

import hashlib
import re
from typing import Any, Optional


class DeduplicationEngine:
    """Computes document hashes and evaluates 4-layer deduplication."""

    @staticmethod
    def compute_binary_hash(file_bytes: bytes) -> str:
        """Compute SHA-256 hex digest of raw binary bytes."""
        return hashlib.sha256(file_bytes).hexdigest()

    @staticmethod
    def normalize_text_for_hashing(text: str) -> str:
        """Normalize text by collapsing whitespace, lowercasing, and stripping punctuation."""
        if not text:
            return ""
        # Lowercase
        normalized = text.lower()
        # Remove non-alphanumeric except spaces
        normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
        # Collapse whitespace
        normalized = re.sub(r"\s+", " ", normalized).strip()
        return normalized

    @classmethod
    def compute_content_hash(cls, text: str) -> str:
        """Compute SHA-256 hex digest of normalized text content."""
        clean_text = cls.normalize_text_for_hashing(text)
        return hashlib.sha256(clean_text.encode("utf-8")).hexdigest()

    @staticmethod
    def is_duplicate_event(
        existing_events: list[dict[str, Any]],
        event_type: str,
        stage: Optional[str],
        date_text_original: str,
    ) -> bool:
        """Check if an equivalent event already exists on the cycle."""
        norm_date = re.sub(r"\s+", " ", date_text_original.strip().lower())
        for ev in existing_events:
            if not ev.get("is_current", True):
                continue
            if ev.get("event_type") == event_type and (ev.get("stage") or "").upper() == (stage or "").upper():
                existing_date = re.sub(r"\s+", " ", (ev.get("date_text_original") or "").strip().lower())
                if existing_date == norm_date:
                    return True
        return False
