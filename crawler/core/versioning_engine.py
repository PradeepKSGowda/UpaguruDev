"""Non-Destructive Event and Field Versioning Engine.

Enforces historical auditability: when dates, schedules, or vacancies change
via Corrigenda or Notices, the engine supersedes the active record in place
(is_current = False, status = 'SUPERSEDED') and inserts the new version with
an unbroken supersedes_event_id / supersedes_version_id chain.
"""

from typing import Any, Optional
from crawler.core.models import ExtractedEventCandidate, ExtractedFieldChange


class VersioningEngine:
    """Manages versioning and supersession for exam events and cycle attributes."""

    @classmethod
    def process_event_supersession(
        cls,
        new_event: ExtractedEventCandidate,
        existing_events: list[dict[str, Any]],
        document_id: str,
        change_reason: Optional[str] = None,
    ) -> tuple[Optional[dict[str, Any]], Optional[dict[str, Any]]]:
        """
        Evaluate if a new event candidate supersedes an existing active event.

        Args:
            new_event: Newly extracted event candidate
            existing_events: Active and historical events currently on the cycle
            document_id: ID of the document introducing this event
            change_reason: Explanation of the change (e.g. 'Rescheduled via Notice')

        Returns:
            (prior_event_update, new_event_insert)
            If the event is completely identical, returns (None, None) for idempotency.
        """
        # Find active matching event by (event_type, stage)
        active_match = None
        for ev in existing_events:
            if not ev.get("is_current", True):
                continue
            if ev.get("event_type") == new_event.event_type.value:
                # Compare stages if present
                ev_stage = (ev.get("stage") or "").upper()
                new_stage = (new_event.stage or "").upper()
                if not ev_stage or not new_stage or ev_stage == new_stage:
                    active_match = ev
                    break

        # Case 1: Brand new event milestone on this cycle
        if not active_match:
            new_record = {
                "source_document_id": document_id,
                "event_type": new_event.event_type.value,
                "stage": new_event.stage,
                "event_name": new_event.event_name,
                "start_datetime": new_event.start_datetime.isoformat() if new_event.start_datetime else None,
                "end_datetime": new_event.end_datetime.isoformat() if new_event.end_datetime else None,
                "is_date_tbd": new_event.is_date_tbd,
                "date_precision": new_event.date_precision,
                "date_text_original": new_event.date_text_original,
                "status": "SCHEDULED",
                "confidence": new_event.confidence,
                "verification_status": "AUTO_VERIFIED" if new_event.confidence >= 85.0 else "UNVERIFIED",
                "is_current": True,
                "version_number": 1,
                "supersedes_event_id": None,
                "change_reason": None,
            }
            return None, new_record

        # Case 2: Idempotency check — identical dates (compare normalized ISO datetimes or raw strings)
        existing_date_text = (active_match.get("date_text_original") or "").strip().lower()
        new_date_text = new_event.date_text_original.strip().lower()

        new_dt_iso = new_event.start_datetime.isoformat() if new_event.start_datetime else None
        active_dt_iso = active_match.get("start_datetime")

        dt_match = bool(new_dt_iso and active_dt_iso and new_dt_iso == active_dt_iso)
        raw_match = existing_date_text == new_date_text

        if dt_match or raw_match:
            # Exact or semantically equivalent date, no supersession needed
            return None, None

        # Case 3: Date changed — Non-Destructive Supersession
        old_version = active_match.get("version_number", 1)
        prior_update = {
            "id": active_match.get("id", "prior_event_id"),
            "is_current": False,
            "status": "SUPERSEDED",
        }

        new_record = {
            "source_document_id": document_id,
            "event_type": new_event.event_type.value,
            "stage": new_event.stage,
            "event_name": new_event.event_name,
            "start_datetime": new_event.start_datetime.isoformat() if new_event.start_datetime else None,
            "end_datetime": new_event.end_datetime.isoformat() if new_event.end_datetime else None,
            "is_date_tbd": new_event.is_date_tbd,
            "date_precision": new_event.date_precision,
            "date_text_original": new_event.date_text_original,
            "status": "SCHEDULED",
            "confidence": new_event.confidence,
            "verification_status": "REVIEW_REQUIRED" if new_event.confidence < 85.0 else "AUTO_VERIFIED",
            "is_current": True,
            "version_number": old_version + 1,
            "supersedes_event_id": active_match.get("id", "prior_event_id"),
            "change_reason": change_reason or f"Revised from '{active_match.get('date_text_original')}' via Corrigendum/Notice",
        }

        return prior_update, new_record

    @classmethod
    def process_field_supersession(
        cls,
        field_change: ExtractedFieldChange,
        existing_versions: list[dict[str, Any]],
        document_id: str,
    ) -> tuple[Optional[dict[str, Any]], dict[str, Any]]:
        """
        Supersede cycle attributes (e.g., total vacancies modified by corrigendum).

        Returns: (prior_version_update, new_version_insert)
        """
        active_field = next(
            (v for v in existing_versions if v.get("is_current", True) and v.get("field_name") == field_change.field_name),
            None,
        )

        prior_update = None
        supersedes_id = None
        old_val = None

        if active_field:
            prior_update = {
                "id": active_field["id"],
                "is_current": False,
            }
            supersedes_id = active_field["id"]
            old_val = active_field.get("new_value_json")

        new_version_insert = {
            "field_name": field_change.field_name,
            "old_value_json": old_val,
            "new_value_json": field_change.new_value,
            "change_summary": field_change.change_summary or f"Updated {field_change.field_name}",
            "source_document_id": document_id,
            "is_current": True,
            "supersedes_version_id": supersedes_id,
            "verification_status": "AUTO_VERIFIED" if field_change.confidence >= 85.0 else "UNVERIFIED",
        }

        return prior_update, new_version_insert
