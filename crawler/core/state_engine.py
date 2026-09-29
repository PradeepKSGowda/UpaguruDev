"""Cycle Lifecycle State Machine and Latest Update Calculator.

Deterministically derives an Exam Cycle's operational status and current stage
from active, verified events and documents.
"""

from datetime import datetime, timezone
from typing import Any, Optional
from crawler.core.models import CycleStatus


class StateEngine:
    """Calculates lifecycle state and semantic latest update for an Exam Cycle."""

    # Semantic priority rank for document types when resolving latest_update
    DOC_TYPE_SIGNIFICANCE = {
        "FINAL_RESULT": 100,
        "PROVISIONAL_ALLOTMENT": 95,
        "INTERVIEW_SCHEDULE": 90,
        "RESULT": 85,
        "CUT_OFF": 80,
        "FINAL_ANSWER_KEY": 75,
        "ANSWER_KEY": 70,
        "ADMIT_CARD": 65,
        "EXAM_DATE_CHANGE": 60,
        "EXAM_DATE_NOTICE": 55,
        "CORRIGENDUM": 50,
        "VACANCY_UPDATE": 45,
        "APPLICATION_EXTENSION": 40,
        "RECRUITMENT_NOTIFICATION": 30,
        "INITIAL_NOTIFICATION": 25,
        "SYLLABUS": 20,
        "IMPORTANT_NOTICE": 15,
        "ANNUAL_CALENDAR": 10,
        "OTHER": 0,
    }

    @classmethod
    def calculate_cycle_state(
        cls,
        events: list[dict[str, Any]],
        documents: list[dict[str, Any]],
        reference_time: Optional[datetime] = None,
    ) -> tuple[CycleStatus, Optional[str]]:
        """
        Derive cycle status and current stage from active events and documents.

        Args:
            events: List of event records for this cycle
            documents: List of attached document records for this cycle
            reference_time: Current evaluation time (defaults to utcnow)

        Returns:
            (status, current_stage)
        """
        now = reference_time or datetime.now(timezone.utc)
        current_events = [e for e in events if e.get("is_current", True)]
        event_types = {e.get("event_type") for e in current_events}

        # 1. Check for withdrawal
        if any(d.get("document_type") == "WITHDRAWAL_NOTICE" for d in documents):
            return CycleStatus.WITHDRAWN, None

        # 2. Check for Final Result
        if "FINAL_RESULT" in event_types or any(d.get("document_type") == "FINAL_RESULT" for d in documents):
            return CycleStatus.FINAL_RESULT_DECLARED, "FINAL"

        # 3. Check for Interview / Personality Test
        if "INTERVIEW" in event_types or "PERSONALITY_TEST" in event_types or any(d.get("document_type") in ("INTERVIEW_SCHEDULE", "INTERVIEW_NOTICE") for d in documents):
            return CycleStatus.INTERVIEW_SCHEDULED, "INTERVIEW"

        # 4. Check for Results
        if "RESULT" in event_types or any(d.get("document_type") == "RESULT" for d in documents):
            return CycleStatus.RESULT_DECLARED, "RESULT"

        # 5. Check for Exam Scheduled / Completed
        exam_events = [e for e in current_events if "EXAM" in (e.get("event_type") or "") or "CBT" in (e.get("event_type") or "")]
        if exam_events:
            # Check latest exam date
            latest_exam = max(exam_events, key=lambda e: e.get("start_datetime") or "")
            start_str = latest_exam.get("start_datetime")
            stage = latest_exam.get("stage", "PRELIMS")

            if start_str:
                try:
                    dt = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    if dt < now:
                        return CycleStatus.EXAM_COMPLETED, stage
                    else:
                        return CycleStatus.EXAM_SCHEDULED, stage
                except Exception:
                    return CycleStatus.EXAM_SCHEDULED, stage

        # 6. Check Application Dates
        app_close = next((e for e in current_events if e.get("event_type") == "APPLICATION_CLOSE"), None)
        if app_close and app_close.get("end_datetime"):
            try:
                dt_close = datetime.fromisoformat(app_close["end_datetime"].replace("Z", "+00:00"))
                if dt_close.tzinfo is None:
                    dt_close = dt_close.replace(tzinfo=timezone.utc)
                if dt_close < now:
                    return CycleStatus.APPLICATION_CLOSED, "APPLICATION"
                else:
                    return CycleStatus.APPLICATION_OPEN, "APPLICATION"
            except Exception:
                pass

        if "APPLICATION_OPEN" in event_types:
            return CycleStatus.APPLICATION_OPEN, "APPLICATION"

        return CycleStatus.DISCOVERED, "INITIAL"

    @classmethod
    def calculate_latest_update(
        cls,
        documents: list[dict[str, Any]],
    ) -> Optional[dict[str, Any]]:
        """
        Compute the most meaningful published update for candidate display.

        Ranks by publication_date descending, breaking ties with semantic significance.
        """
        if not documents:
            return None

        def sort_key(doc: dict[str, Any]) -> tuple[str, int]:
            pub_date = str(doc.get("publication_date") or doc.get("discovered_at") or "1970-01-01")[:10]
            sig = cls.DOC_TYPE_SIGNIFICANCE.get(doc.get("document_type", "OTHER"), 0)
            return pub_date, sig

        sorted_docs = sorted(documents, key=sort_key, reverse=True)
        latest_doc = sorted_docs[0]

        return {
            "document_id": latest_doc.get("id"),
            "title": latest_doc.get("title"),
            "document_type": latest_doc.get("document_type"),
            "publication_date": latest_doc.get("publication_date"),
            "source_url": latest_doc.get("source_url"),
        }
