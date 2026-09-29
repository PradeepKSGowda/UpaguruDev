"""Unit tests for Non-Destructive Event & Field Versioning."""

from datetime import datetime
import unittest
from crawler.core.models import EventType, ExtractedEventCandidate
from crawler.core.versioning_engine import VersioningEngine


class TestEventVersioning(unittest.TestCase):
    """Test non-destructive supersession and unbroken version chains."""

    def test_new_milestone_created_with_version_1(self):
        ev = ExtractedEventCandidate(
            event_type=EventType.PRELIMS_EXAM,
            stage="PRELIMS",
            event_name="Preliminary Examination",
            start_datetime=datetime(2026, 5, 24),
            date_text_original="24th May, 2026",
            source_text="Examination on 24th May, 2026",
        )
        prior_up, new_ins = VersioningEngine.process_event_supersession(
            new_event=ev,
            existing_events=[],
            document_id="doc-01",
        )

        self.assertIsNone(prior_up)
        self.assertIsNotNone(new_ins)
        self.assertTrue(new_ins["is_current"])
        self.assertEqual(new_ins["version_number"], 1)
        self.assertIsNone(new_ins["supersedes_event_id"])

    def test_date_rescheduled_supersedes_prior_version(self):
        existing_event = {
            "id": "event-v1",
            "event_type": "PRELIMS_EXAM",
            "stage": "PRELIMS",
            "event_name": "Preliminary Examination",
            "date_text_original": "24th May, 2026",
            "is_current": True,
            "version_number": 1,
        }

        # Date rescheduled to 14.06.2026
        new_ev = ExtractedEventCandidate(
            event_type=EventType.PRELIMS_EXAM,
            stage="PRELIMS",
            event_name="Preliminary Examination",
            start_datetime=datetime(2026, 6, 14),
            date_text_original="14.06.2026",
            source_text="rescheduled to 14.06.2026",
        )

        prior_up, new_ins = VersioningEngine.process_event_supersession(
            new_event=new_ev,
            existing_events=[existing_event],
            document_id="doc-05",
        )

        # Prior version superseded
        self.assertIsNotNone(prior_up)
        self.assertEqual(prior_up["id"], "event-v1")
        self.assertFalse(prior_up["is_current"])
        self.assertEqual(prior_up["status"], "SUPERSEDED")

        # New version active with incremented version number
        self.assertIsNotNone(new_ins)
        self.assertTrue(new_ins["is_current"])
        self.assertEqual(new_ins["version_number"], 2)
        self.assertEqual(new_ins["supersedes_event_id"], "event-v1")
        self.assertEqual(new_ins["source_document_id"], "doc-05")

    def test_idempotent_reingestion_does_not_duplicate_version(self):
        existing_event = {
            "id": "event-v1",
            "event_type": "PRELIMS_EXAM",
            "stage": "PRELIMS",
            "event_name": "Preliminary Examination",
            "date_text_original": "24th May, 2026",
            "is_current": True,
            "version_number": 1,
        }

        # Identical date candidate
        same_ev = ExtractedEventCandidate(
            event_type=EventType.PRELIMS_EXAM,
            stage="PRELIMS",
            event_name="Preliminary Examination",
            start_datetime=datetime(2026, 5, 24),
            date_text_original="24th May, 2026",
            source_text="Examination on 24th May, 2026",
        )

        prior_up, new_ins = VersioningEngine.process_event_supersession(
            new_event=same_ev,
            existing_events=[existing_event],
            document_id="doc-01",
        )

        self.assertIsNone(prior_up)
        self.assertIsNone(new_ins)


if __name__ == "__main__":
    unittest.main()
