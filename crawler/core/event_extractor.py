"""Semantic Context-Aware Event Extraction and Stage Mapping Pipeline.

Extracts examination milestones (Application Open/Close, Prelims, Mains, CBT,
Admit Card, Results) with verbatim textual provenance, excluding non-event dates
(such as birth date eligibility cutoffs).
"""

from datetime import datetime
import re
from typing import Optional
from crawler.core.models import EventType, ExtractionMethod, ExtractedEventCandidate


class EventExtractor:
    """7-step context-aware timeline milestone and date extractor."""

    # Date parsing regex patterns
    DATE_PATTERNS = [
        # DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
        re.compile(r"\b(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{4})\b"),
        # DD Month YYYY (e.g. 24th May, 2026 or 24 May 2026)
        re.compile(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(\d{4})\b", re.IGNORECASE),
        # Month YYYY (e.g. August, 2026 or August 2026)
        re.compile(r"\b(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(\d{4})\b", re.IGNORECASE),
    ]

    MONTH_MAP = {
        "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
        "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
    }

    # Semantic event label patterns
    EVENT_LABELS: list[tuple[EventType, Optional[str], re.Pattern]] = [
        (
            EventType.APPLICATION_CLOSE,
            "APPLICATION",
            re.compile(r"\b(?:last\s+date\s+for\s+(?:submission|receipt(?:\s+of\s+applications)?)|closing\s+date|last\s+date\s+to\s+apply|registration\s+closes?)\b", re.IGNORECASE),
        ),
        (
            EventType.APPLICATION_OPEN,
            "APPLICATION",
            re.compile(r"\b(?:opening\s+date|application\s+commences?|registration\s+opens?|commencement\s+of\s+submission)\b", re.IGNORECASE),
        ),
        (
            EventType.PRELIMS_EXAM,
            "PRELIMS",
            re.compile(r"(?:\bpreliminary\s+examination|\bprelims\s+exam|\bcivil\s+services\s+\(preliminary\))", re.IGNORECASE),
        ),
        (
            EventType.MAINS_EXAM,
            "MAINS",
            re.compile(r"(?:\bmain\s+examination|\bmains\s+exam|\bcivil\s+services\s+\(main\))", re.IGNORECASE),
        ),
        (
            EventType.TIER_1_EXAM,
            "TIER_1",
            re.compile(r"\b(?:tier[\s\-]*i(?!\w)|tier[\s\-]*1)\b", re.IGNORECASE),
        ),
        (
            EventType.TIER_2_EXAM,
            "TIER_2",
            re.compile(r"\b(?:tier[\s\-]*ii(?!\w)|tier[\s\-]*2)\b", re.IGNORECASE),
        ),
        (
            EventType.CBT_1,
            "CBT_1",
            re.compile(r"\b(?:1st\s+stage\s+cbt|cbt[\s\-]*1)\b", re.IGNORECASE),
        ),
        (
            EventType.CBT_2,
            "CBT_2",
            re.compile(r"\b(?:2nd\s+stage\s+cbt|cbt[\s\-]*2)\b", re.IGNORECASE),
        ),
        (
            EventType.ADMIT_CARD_RELEASE,
            "ADMIT_CARD",
            re.compile(r"\b(?:download\s+of\s+e-admit\s+card|admit\s+card\s+available|hall\s+ticket\s+release)\b", re.IGNORECASE),
        ),
        (
            EventType.PERSONALITY_TEST,
            "INTERVIEW",
            re.compile(r"\b(?:personality\s+test|interview|viva[\s\-]*voce)\b", re.IGNORECASE),
        ),
    ]

    # Exclusion patterns: Birth dates, age bounds, or certificates that MUST NOT become exam dates
    EXCLUSION_PATTERNS = [
        re.compile(r"\b(?:born\s+not\s+earlier\s+than|born\s+not\s+later\s+than|date\s+of\s+birth)\b", re.IGNORECASE),
        re.compile(r"\b(?:age\s+limit|crucial\s+date\s+for\s+age)\b", re.IGNORECASE),
    ]

    @classmethod
    def extract_events(
        cls,
        text: str,
        page_number: Optional[int] = 1,
    ) -> list[ExtractedEventCandidate]:
        """
        Scan text line-by-line and block-by-block for milestone dates.

        Excludes age cutoffs and attaches verbatim provenance snippets.
        """
        events: list[ExtractedEventCandidate] = []
        if not text:
            return events

        lines = text.splitlines()

        for idx, line in enumerate(lines):
            line_clean = line.strip()
            if not line_clean or len(line_clean) < 10:
                continue

            # Step 3: Exclusion filtering (DOB & age limit clauses)
            if any(p.search(line_clean) for p in cls.EXCLUSION_PATTERNS):
                continue

            # Context window: prioritize current line, fallback to preceding line for wrapped rows
            has_label_in_line = any(pat.search(line_clean) for _, _, pat in cls.EVENT_LABELS)
            context_window = line_clean if has_label_in_line else (f"{lines[idx - 1]} {line_clean}" if idx > 0 else line_clean)

            # Step 4: Semantic context classification
            for event_type, stage, label_pat in cls.EVENT_LABELS:
                for match in label_pat.finditer(context_window):
                    # Search for date in clause following the matched label
                    clause_tail = context_window[match.start():]
                    dt_parsed, date_text = cls._parse_first_date(clause_tail)
                    if not dt_parsed:
                        dt_parsed, date_text = cls._parse_first_date(context_window)

                    if dt_parsed and date_text:
                        events.append(
                            ExtractedEventCandidate(
                                event_type=event_type,
                                stage=stage,
                                event_name=cls._format_event_name(event_type),
                                start_datetime=dt_parsed,
                                date_text_original=date_text,
                                source_text=context_window[:200].strip(),
                                page_number=page_number,
                                confidence=90.0,
                                extraction_method=ExtractionMethod.RULE,
                            )
                        )

        # Deduplicate event candidates within the same document
        deduped: list[ExtractedEventCandidate] = []
        seen_keys: set[tuple[Any, Any, Any]] = set()
        for ev in events:
            key = (ev.event_type, (ev.stage or "").upper(), ev.start_datetime.isoformat() if ev.start_datetime else ev.date_text_original)
            if key not in seen_keys:
                seen_keys.add(key)
                deduped.append(ev)

        return deduped

    @classmethod
    def _parse_first_date(cls, text: str) -> tuple[Optional[datetime], Optional[str]]:
        """Extract the first valid date string and return (datetime, verbatim_string)."""
        # If rescheduled or extended, prioritize date following 'rescheduled to' / 'extended to'
        target_clause_match = re.search(r"\b(?:rescheduled\s+to|extended\s+to|postponed\s+to|revised\s+to)\s+(.*)", text, re.IGNORECASE)
        eval_text = target_clause_match.group(1) if target_clause_match else text

        # Mask out notice citation dates, e.g. "dated 14.02.2026", "notice dated 14th Feb 2026", "dated: 14/02/2026"
        clean_text = re.sub(
            r"\b(?:dated|vide\s+(?:notice\s+|notification\s+)?dated|notification\s+dated)\s*[:\-]?\s*(?:\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+\d{4})",
            " ",
            eval_text,
            flags=re.IGNORECASE,
        )

        # Try DD.MM.YYYY
        m1 = cls.DATE_PATTERNS[0].search(clean_text)
        if m1:
            day, month, year = int(m1.group(1)), int(m1.group(2)), int(m1.group(3))
            try:
                dt = datetime(year, month, day)
                return dt, m1.group(0)
            except ValueError:
                pass

        # Try DD Month YYYY
        m2 = cls.DATE_PATTERNS[1].search(clean_text)
        if m2:
            day = int(m2.group(1))
            month_str = m2.group(2).lower()
            year = int(m2.group(3))
            month = cls.MONTH_MAP.get(month_str, 1)
            try:
                dt = datetime(year, month, day)
                return dt, m2.group(0)
            except ValueError:
                pass

        # Try Month YYYY
        m3 = cls.DATE_PATTERNS[2].search(clean_text)
        if m3:
            month_str = m3.group(1).lower()
            year = int(m3.group(2))
            month = cls.MONTH_MAP.get(month_str, 1)
            try:
                dt = datetime(year, month, 1)
                return dt, m3.group(0)
            except ValueError:
                pass

        return None, None

    @staticmethod
    def _format_event_name(event_type: EventType) -> str:
        """Create human-friendly milestone label."""
        return event_type.value.replace("_", " ").title()
