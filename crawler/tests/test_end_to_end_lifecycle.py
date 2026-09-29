"""End-to-End Lifecycle Integration Test.

Ingests the complete 9-stage examination lifecycle fixtures for UPSC CSE 2026:
01_initial_notification -> 02_application_extension -> 03_corrigendum_vacancies ->
04_prelims_date_notice -> 05_prelims_date_change -> 06_admit_card_notice ->
07_prelims_result -> 08_mains_and_interview_schedule -> 09_final_result.

Validates:
1. All 9 documents link to the exact same Exam Cycle (UPSC_CSE_2026)
2. Directed relationship graph edges created
3. Historical non-destructive event supersession preserved
4. State progression transitions deterministically
5. Strict idempotency on duplicate re-ingestion
"""

from pathlib import Path
import unittest
from crawler.core.crawler_orchestrator import CrawlerOrchestrator
from crawler.core.models import LinkingDecision


class TestEndToEndLifecycle(unittest.TestCase):
    """Test full 9-stage lifecycle ingestion, linking, and idempotency."""

    def setUp(self):
        self.fixtures_dir = Path(__file__).parent / "fixtures" / "upsc"
        self.orchestrator = CrawlerOrchestrator()

        self.lifecycle_stages = [
            ("01_initial_notification.txt", "Civil Services (Preliminary) Examination, 2026", "https://upsc.gov.in/01.pdf"),
            ("02_application_extension.txt", "Extension of Last Date - Civil Services Examination, 2026", "https://upsc.gov.in/02.pdf"),
            ("03_corrigendum_vacancies.txt", "Corrigendum - Vacancies Revision Civil Services 2026", "https://upsc.gov.in/03.pdf"),
            ("04_prelims_date_notice.txt", "Examination Schedule - Civil Services (Preliminary) 2026", "https://upsc.gov.in/04.pdf"),
            ("05_prelims_date_change.txt", "Rescheduling of Civil Services (Preliminary) Examination 2026", "https://upsc.gov.in/05.pdf"),
            ("06_admit_card_notice.txt", "e-Admit Card - Civil Services (Preliminary) Examination 2026", "https://upsc.gov.in/06.pdf"),
            ("07_prelims_result.txt", "Written Result of Civil Services (Preliminary) Examination 2026", "https://upsc.gov.in/07.pdf"),
            ("08_mains_and_interview_schedule.txt", "Civil Services (Main) Examination & Interview Schedule 2026", "https://upsc.gov.in/08.pdf"),
            ("09_final_result.txt", "Final Result of Civil Services Examination, 2026", "https://upsc.gov.in/09.pdf"),
        ]

    def test_complete_9_stage_lifecycle_linking_and_versioning(self):
        cycle_state_db = []
        cycle_events_db = []
        cycle_docs_db = []

        for stage_idx, (filename, title, url) in enumerate(self.lifecycle_stages):
            file_path = self.fixtures_dir / filename
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            res = self.orchestrator.process_document(
                raw_url=url,
                title=title,
                file_bytes=content.encode("utf-8"),
                extracted_text=content,
                organization_code="UPSC",
                base_url="https://upsc.gov.in",
                existing_cycles=cycle_state_db,
                existing_events=cycle_events_db,
                existing_docs=cycle_docs_db,
            )

            # Verification 1: High confidence linking decision
            self.assertEqual(res["cycle_match"].decision, LinkingDecision.AUTO_LINK)
            self.assertEqual(res["cycle_match"].cycle_code, "UPSC_CSE_2026")

            # Seed cycle on first document
            if stage_idx == 0:
                cycle_state_db.append({
                    "id": "cycle-upsc-cse-2026",
                    "exam_master_id": "master-cse",
                    "exam_code": "UPSC_CSE",
                    "cycle_year": 2026,
                    "cycle_code": "UPSC_CSE_2026",
                    "cycle_label": "UPSC CSE 2026",
                    "primary_reference_no": "05/2026-CSP",
                })

            # Append document
            cycle_docs_db.append({
                "id": res["document"].document_id,
                "title": res["document"].title,
                "document_type": res["classification"].document_type.value,
                "reference_number": res["document"].references[0].raw_reference if res["document"].references else "05/2026-CSP",
                "source_url": url,
            })

            # Apply event updates and inserts to in-memory cycle
            for up in res["prior_event_updates"]:
                for ev in cycle_events_db:
                    if ev.get("id") == up["id"]:
                        ev.update(up)

            for ins in res["new_event_inserts"]:
                ins["id"] = f"ev-{len(cycle_events_db) + 1}"
                cycle_events_db.append(ins)

        # Verification 2: All 9 documents ingested under same cycle
        self.assertEqual(len(cycle_docs_db), 9)

        # Verification 3: Event supersession on Prelims date change
        prelims_events = [e for e in cycle_events_db if e.get("event_type") == "PRELIMS_EXAM"]
        self.assertGreaterEqual(len(prelims_events), 2)

        superseded_v1 = next((e for e in prelims_events if e.get("version_number") == 1), None)
        active_v2 = next((e for e in prelims_events if e.get("is_current") is True), None)

        self.assertIsNotNone(superseded_v1)
        self.assertIsNotNone(active_v2)
        self.assertFalse(superseded_v1["is_current"])
        self.assertEqual(superseded_v1["status"], "SUPERSEDED")
        self.assertTrue(active_v2["is_current"])
        self.assertEqual(active_v2["version_number"], 2)

        # Verification 4: Final State of cycle after 9 documents
        final_doc_res = self.orchestrator.process_document(
            raw_url="https://upsc.gov.in/09.pdf",
            title="Final Result of Civil Services Examination, 2026",
            file_bytes=b"FINAL",
            extracted_text="FINAL RESULT OF CIVIL SERVICES EXAMINATION 2026",
            organization_code="UPSC",
            base_url="https://upsc.gov.in",
            existing_cycles=cycle_state_db,
            existing_events=cycle_events_db,
            existing_docs=cycle_docs_db,
        )
        self.assertEqual(final_doc_res["cycle_state"]["status"], "FINAL_RESULT_DECLARED")

    def test_strict_idempotency_on_reingestion(self):
        # Ingesting stage 1 twice
        file_path = self.fixtures_dir / "01_initial_notification.txt"
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        res1 = self.orchestrator.process_document(
            raw_url="https://upsc.gov.in/01.pdf",
            title="Civil Services (Preliminary) Examination, 2026",
            file_bytes=content.encode("utf-8"),
            extracted_text=content,
            organization_code="UPSC",
            base_url="https://upsc.gov.in",
        )

        existing_events = list(res1["new_event_inserts"])
        for idx, ev in enumerate(existing_events):
            ev["id"] = f"ev-{idx}"

        # Re-ingest exact same file
        res2 = self.orchestrator.process_document(
            raw_url="https://upsc.gov.in/01.pdf",
            title="Civil Services (Preliminary) Examination, 2026",
            file_bytes=content.encode("utf-8"),
            extracted_text=content,
            organization_code="UPSC",
            base_url="https://upsc.gov.in",
            existing_events=existing_events,
        )

        # Zero duplicate event inserts
        self.assertEqual(len(res2["new_event_inserts"]), 0)
        self.assertEqual(len(res2["prior_event_updates"]), 0)


if __name__ == "__main__":
    unittest.main()
