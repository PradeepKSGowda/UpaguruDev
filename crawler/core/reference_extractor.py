"""Multi-Organization Official Reference Number Extractor.

Extracts and canonicalizes official recruitment identifiers across UPSC, SSC, RRB, IBPS, and KPSC:
- Examination Notice Numbers (e.g. '05/2026-CSP')
- Advertisement Numbers (e.g. 'Advt. No. 01/2026')
- Centralized Employment Notice (CEN) numbers (e.g. 'CEN 01/2026')
- Common Recruitment Process (CRP) codes (e.g. 'CRP PO/MT-XVI')
- File / Circular Numbers (e.g. 'F.No. 1/2/2026-E.I(B)', 'PSC 1 RTB-2/2026')
"""

import re
from typing import Optional
from crawler.core.models import ReferenceIdentity


class ReferenceExtractor:
    """Extracts and normalizes official government reference identifiers."""

    # Pre-compiled Regex patterns per organization
    PATTERNS = {
        "RRB": [
            (
                "CEN_NO",
                re.compile(
                    r"\b(?:CEN|Centrali[sz]ed\s+Employment\s+Notice)\s*(?:No\.?)?\s*[:\-]?\s*([A-Z0-9_\-]+/\d{4})\b",
                    re.IGNORECASE,
                ),
            ),
            (
                "CEN_NO",
                re.compile(r"\b(CEN\s*\d{2}/\d{4})\b", re.IGNORECASE),
            ),
        ],
        "IBPS": [
            (
                "CRP_CODE",
                re.compile(
                    r"\b(CRP\s*(?:PO/MT|CLERKS?|SPL|RRBs?|[A-Z/\-]+)[\s\-]+[IVXLCDM\d]+)\b",
                    re.IGNORECASE,
                ),
            ),
        ],
        "UPSC": [
            (
                "EXAM_NOTICE_NO",
                re.compile(
                    r"\b(?:Exam(?:ination)?\s+Notice\s+No\.?|Notice\s+No\.?)\s*[:\-]?\s*([0-9]{1,3}/\d{4}[\-A-Z0-9_]*)\b",
                    re.IGNORECASE,
                ),
            ),
            (
                "ADVERTISEMENT_NO",
                re.compile(
                    r"\b(?:Advt\.?|Advertisement)\s+No\.?\s*[:\-]?\s*([0-9]{1,3}/\d{4})\b",
                    re.IGNORECASE,
                ),
            ),
            (
                "FILE_NO",
                re.compile(
                    r"\b(?:F\.?\s*No\.?)\s*[:\-]?\s*([0-9A-Z/.\-\(\)]+-[A-Z0-9\(\)]+)\b",
                    re.IGNORECASE,
                ),
            ),
        ],
        "SSC": [
            (
                "FILE_NO",
                re.compile(
                    r"\b(?:F\.?\s*No\.?)\s*[:\-]?\s*([A-Z0-9_\-/\.]+)\b",
                    re.IGNORECASE,
                ),
            ),
            (
                "PHASE_NO",
                re.compile(
                    r"\b(?:Phase[\s\-]+[IVXLCDM\d]+/\d{4}(?:/Selection\s*Posts)?)\b",
                    re.IGNORECASE,
                ),
            ),
            (
                "NOTICE_NO",
                re.compile(
                    r"\b(?:Notice\s+No\.?)\s*[:\-]?\s*([A-Z0-9_\-/\.]+)\b",
                    re.IGNORECASE,
                ),
            ),
        ],
        "KPSC": [
            (
                "NOTIFICATION_NO",
                re.compile(
                    r"\b(?:Notification\s+No\.?|No\.?)\s*[:\-]?\s*(PSC\s+[0-9A-Za-z\s_\-/\.]*?\d{4})\b",
                    re.IGNORECASE,
                ),
            ),
            (
                "FILE_NO",
                re.compile(
                    r"\b([E|R]\(\d+\)\s*\d+/\d{2,4}(?:-\d{2,4})?)\b",
                    re.IGNORECASE,
                ),
            ),
        ],
    }

    # Universal fallback patterns for any commission
    GENERIC_PATTERNS = [
        ("ADVERTISEMENT_NO", re.compile(r"\b(?:Advt\.?|Advertisement)\s*No\.?\s*[:\-]?\s*([0-9A-Z/_\-]+)\b", re.IGNORECASE)),
        ("NOTIFICATION_NO", re.compile(r"\b(?:Notification\s+No\.?)\s*[:\-]?\s*([0-9A-Z/_\-]+)\b", re.IGNORECASE)),
        ("FILE_NO", re.compile(r"\b(?:File\s+No\.?|F\.?\s*No\.?)\s*[:\-]?\s*([0-9A-Z/_\.\-]+)\b", re.IGNORECASE)),
    ]

    @classmethod
    def extract_references(
        cls,
        text: str,
        title: str = "",
        url: str = "",
        organization_code: str = "",
    ) -> list[ReferenceIdentity]:
        """
        Scan text, title, and URL for official reference numbers.

        Returns deduplicated list of ReferenceIdentity objects with canonical forms.
        """
        found_refs: list[ReferenceIdentity] = []
        seen_normalized: set[str] = set()

        search_blocks = [
            ("title", title, 1),
            ("url", url, 1),
            ("text_head", text[:8000] if text else "", 1),
            ("text_tail", text[-4000:] if len(text) > 8000 else "", 2),
        ]

        org_key = organization_code.upper() if organization_code else "UPSC"
        patterns_to_try = cls.PATTERNS.get(org_key, []) + cls.GENERIC_PATTERNS

        for block_name, block_text, page_hint in search_blocks:
            if not block_text:
                continue

            for ref_type, pattern in patterns_to_try:
                for match in pattern.finditer(block_text):
                    raw_val = match.group(1).strip() if match.groups() else match.group(0).strip()
                    # Clean up punctuation at ends
                    raw_val = raw_val.strip(" .,;:-")
                    if len(raw_val) < 3 or raw_val.isdigit():
                        continue

                    norm_val = cls._canonicalize(org_key, ref_type, raw_val)
                    if norm_val in seen_normalized:
                        continue

                    seen_normalized.add(norm_val)
                    snippet = block_text[max(0, match.start() - 30): min(len(block_text), match.end() + 30)].strip()

                    found_refs.append(
                        ReferenceIdentity(
                            reference_type=ref_type,
                            raw_reference=raw_val,
                            normalized_reference=norm_val,
                            source_snippet=snippet,
                            page_number=page_hint,
                            confidence=95.0 if block_name in ("title", "text_head") else 85.0,
                        )
                    )

        return found_refs

    @staticmethod
    def _canonicalize(org: str, ref_type: str, raw_val: str) -> str:
        """Create canonical representation, e.g., 'UPSC:ADVT:01/2026'."""
        cleaned = re.sub(r"\s+", "", raw_val).upper()
        # Remove redundant prefixes inside the value if already present
        cleaned = re.sub(r"^(ADVT\.?NO\.?|NOTIFICATIONNO\.?|CENNO\.?|CEN)", "", cleaned)
        cleaned = cleaned.strip(":-/")
        return f"{org}:{ref_type}:{cleaned}"
