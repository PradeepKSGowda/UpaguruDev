"""Rule and Keyword Document Type Classifier for Government Examination Publications.

Maps titles, circular subjects, and extracted headers to standard DocumentType enums
with confidence scoring, rule traceability, and multi-exam detection.
"""

import re
from crawler.core.models import ClassificationResult, DocumentType


class DocumentClassifier:
    """Classifies official documents into canonical recruitment publication types."""

    RULES: list[tuple[DocumentType, re.Pattern, float, bool]] = [
        # (DocumentType, pattern, confidence, is_multi_exam)
        (
            DocumentType.ANNUAL_CALENDAR,
            re.compile(r"\b(?:Annual\s+Programme|Annual\s+Calendar|Calendar\s+of\s+Examinations?|Examination\s+Calendar)\b", re.IGNORECASE),
            95.0,
            True,
        ),
        (
            DocumentType.APPLICATION_EXTENSION,
            re.compile(r"\b(?:extension\s+of\s+(?:last\s+)?date|last\s+date\s+extended|deadline\s+extended)\b", re.IGNORECASE),
            95.0,
            False,
        ),
        (
            DocumentType.CORRIGENDUM,
            re.compile(r"\b(?:corrigendum|addendum|errata|in\s+partial\s+modification)\b", re.IGNORECASE),
            95.0,
            False,
        ),
        (
            DocumentType.VACANCY_UPDATE,
            re.compile(r"\b(?:revision\s+of\s+vacancies|revised\s+vacanc(?:y|ies)|tentative\s+vacancies)\b", re.IGNORECASE),
            90.0,
            False,
        ),
        (
            DocumentType.EXAM_DATE_CHANGE,
            re.compile(r"\b(?:rescheduled|postponed|deferment\s+of\s+exam|revised\s+schedule|change\s+of\s+date)\b", re.IGNORECASE),
            95.0,
            False,
        ),
        (
            DocumentType.EXAM_DATE_NOTICE,
            re.compile(r"\b(?:time[\s\-]*table|examination\s+schedule|date\s+of\s+examination|schedule\s+of\s+exam)\b", re.IGNORECASE),
            90.0,
            False,
        ),
        (
            DocumentType.CITY_INTIMATION,
            re.compile(r"\b(?:city\s+intimation|advance\s+intimation\s+slip|exam\s+city)\b", re.IGNORECASE),
            95.0,
            False,
        ),
        (
            DocumentType.ADMIT_CARD,
            re.compile(r"\b(?:admit\s+card|e-admit\s+card|hall\s+ticket|call\s+letter|e-summon)\b", re.IGNORECASE),
            95.0,
            False,
        ),
        (
            DocumentType.FINAL_ANSWER_KEY,
            re.compile(r"\b(?:final\s+answer\s+key)\b", re.IGNORECASE),
            95.0,
            False,
        ),
        (
            DocumentType.OBJECT_WINDOW_NOTICE,
            re.compile(r"\b(?:objection\s+(?:tracker|window|portal)|representation\s+against\s+answer\s+key)\b", re.IGNORECASE),
            90.0,
            False,
        ),
        (
            DocumentType.ANSWER_KEY,
            re.compile(r"\b(?:answer\s+key|tentative\s+answer\s+key|provisional\s+key)\b", re.IGNORECASE),
            90.0,
            False,
        ),
        (
            DocumentType.FINAL_RESULT,
            re.compile(r"\b(?:final\s+result|final\s+select\s+list|provisional\s+allotment|merit\s+list)\b", re.IGNORECASE),
            95.0,
            False,
        ),
        (
            DocumentType.CUT_OFF,
            re.compile(r"\b(?:cut[\s\-]*off\s+marks?|minimum\s+qualifying\s+marks?)\b", re.IGNORECASE),
            90.0,
            False,
        ),
        (
            DocumentType.RESULT,
            re.compile(r"\b(?:written\s+result|result\s+of|roll\s+numbers\s+of\s+qualified\s+candidates|result\s+declared)\b", re.IGNORECASE),
            90.0,
            False,
        ),
        (
            DocumentType.DAF_NOTICE,
            re.compile(r"\b(?:detailed\s+application\s+form|daf[\s\-]*[I|II|1|2]|option[\s\-]*cum[\s\-]*preference)\b", re.IGNORECASE),
            95.0,
            False,
        ),
        (
            DocumentType.INTERVIEW_SCHEDULE,
            re.compile(r"\b(?:interview\s+schedule|personality\s+test\s+schedule|schedule\s+of\s+interview)\b", re.IGNORECASE),
            90.0,
            False,
        ),
        (
            DocumentType.WITHDRAWAL_NOTICE,
            re.compile(r"\b(?:cancellation\s+notice|withdrawal\s+of\s+notification|recruitment\s+cancelled)\b", re.IGNORECASE),
            95.0,
            False,
        ),
        (
            DocumentType.RECRUITMENT_NOTIFICATION,
            re.compile(r"\b(?:detailed\s+notification|recruitment\s+advertisement|examination\s+notice\s+no|detailed\s+cen)\b", re.IGNORECASE),
            90.0,
            False,
        ),
    ]

    @classmethod
    def classify(cls, title: str, text: str = "") -> ClassificationResult:
        """Classify document type using title and first 4000 characters of text."""
        combined = f"{title}\n{text[:4000]}"
        matched_rules: list[str] = []

        for doc_type, pattern, base_conf, is_multi in cls.RULES:
            match = pattern.search(combined)
            if match:
                matched_rules.append(f"regex_match:{doc_type.value}:{match.group(0)}")
                return ClassificationResult(
                    document_type=doc_type,
                    confidence=base_conf,
                    matched_rules=matched_rules,
                    is_multi_exam=is_multi,
                )

        # Default fallback
        if "notice" in combined.lower():
            return ClassificationResult(
                document_type=DocumentType.IMPORTANT_NOTICE,
                confidence=60.0,
                matched_rules=["default_notice_fallback"],
                is_multi_exam=False,
            )

        return ClassificationResult(
            document_type=DocumentType.OTHER,
            confidence=40.0,
            matched_rules=["no_rule_matched"],
            is_multi_exam=False,
        )
