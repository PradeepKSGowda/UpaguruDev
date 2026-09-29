"""Unit tests for Organization Adapters (UPSC, KPSC, SSC, RRB, IBPS)."""

from pathlib import Path
import unittest
from crawler.adapters.registry import SOURCE_ADAPTERS, get_adapter
from crawler.core.models import ExtractedDocumentPayload


class TestAdapters(unittest.TestCase):
    """Test organization adapters against real fixtures."""

    def setUp(self):
        self.fixtures_dir = Path(__file__).parent / "fixtures"

    def test_all_five_adapters_registered(self):
        expected_orgs = {"UPSC", "KPSC", "SSC", "RRB", "IBPS"}
        self.assertEqual(expected_orgs.intersection(SOURCE_ADAPTERS.keys()), expected_orgs)

    def test_upsc_adapter_reference_and_exam_resolution(self):
        adapter = get_adapter("UPSC")
        fixture_file = self.fixtures_dir / "upsc" / "01_initial_notification.txt"
        with open(fixture_file, "r", encoding="utf-8") as f:
            text = f.read()

        doc = ExtractedDocumentPayload(
            organization_code="UPSC",
            source_url="https://upsc.gov.in/notice-05.pdf",
            canonical_url="https://upsc.gov.in/notice-05.pdf",
            title="Civil Services (Preliminary) Examination, 2026",
            normalized_title="civil services preliminary examination 2026",
            text_content=text,
        )

        refs = adapter.extract_references(doc)
        self.assertTrue(any("05/2026-CSP" in r.raw_reference for r in refs))

        exams = adapter.resolve_exams(doc)
        self.assertEqual(len(exams), 1)
        self.assertEqual(exams[0].exam_code, "UPSC_CSE")

    def test_kpsc_adapter_kas_resolution(self):
        adapter = get_adapter("KPSC")
        fixture_file = self.fixtures_dir / "kpsc" / "01_kas_notification.txt"
        with open(fixture_file, "r", encoding="utf-8") as f:
            text = f.read()

        doc = ExtractedDocumentPayload(
            organization_code="KPSC",
            source_url="https://kpsc.kar.nic.in/kas.pdf",
            canonical_url="https://kpsc.kar.nic.in/kas.pdf",
            title="Recruitment for Gazetted Probationers 2026",
            normalized_title="recruitment gazetted probationers 2026",
            text_content=text,
        )

        refs = adapter.extract_references(doc)
        self.assertTrue(any("RTB-2/2026" in r.raw_reference for r in refs))

        exams = adapter.resolve_exams(doc)
        self.assertEqual(len(exams), 1)
        self.assertEqual(exams[0].exam_code, "KPSC_KAS")

    def test_ssc_adapter_cgl_resolution(self):
        adapter = get_adapter("SSC")
        fixture_file = self.fixtures_dir / "ssc" / "01_cgl_notification.txt"
        with open(fixture_file, "r", encoding="utf-8") as f:
            text = f.read()

        doc = ExtractedDocumentPayload(
            organization_code="SSC",
            source_url="https://ssc.gov.in/cgl.pdf",
            canonical_url="https://ssc.gov.in/cgl.pdf",
            title="Combined Graduate Level Examination, 2026",
            normalized_title="combined graduate level examination 2026",
            text_content=text,
        )

        exams = adapter.resolve_exams(doc)
        self.assertEqual(len(exams), 1)
        self.assertEqual(exams[0].exam_code, "SSC_CGL")

    def test_rrb_adapter_cen_resolution(self):
        adapter = get_adapter("RRB")
        fixture_file = self.fixtures_dir / "rrb" / "01_ntpc_cen.txt"
        with open(fixture_file, "r", encoding="utf-8") as f:
            text = f.read()

        doc = ExtractedDocumentPayload(
            organization_code="RRB",
            source_url="https://rrbcdg.gov.in/cen01.pdf",
            canonical_url="https://rrbcdg.gov.in/cen01.pdf",
            title="CEN 01/2026 NTPC Posts",
            normalized_title="cen 01 2026 ntpc posts",
            text_content=text,
        )

        refs = adapter.extract_references(doc)
        self.assertTrue(any("01/2026" in r.raw_reference for r in refs))

        exams = adapter.resolve_exams(doc)
        self.assertEqual(len(exams), 1)
        self.assertEqual(exams[0].exam_code, "RRB_NTPC")

    def test_ibps_adapter_crp_resolution(self):
        adapter = get_adapter("IBPS")
        fixture_file = self.fixtures_dir / "ibps" / "01_crp_po_notification.txt"
        with open(fixture_file, "r", encoding="utf-8") as f:
            text = f.read()

        doc = ExtractedDocumentPayload(
            organization_code="IBPS",
            source_url="https://ibps.in/crp-po.pdf",
            canonical_url="https://ibps.in/crp-po.pdf",
            title="CRP PO/MT-XVI for Vacancies of 2026-27",
            normalized_title="crp po mt xvi vacancies 2026 27",
            text_content=text,
        )

        refs = adapter.extract_references(doc)
        self.assertTrue(any("CRP PO/MT-XVI" in r.raw_reference for r in refs))

        exams = adapter.resolve_exams(doc)
        self.assertEqual(len(exams), 1)
        self.assertEqual(exams[0].exam_code, "IBPS_PO")


if __name__ == "__main__":
    unittest.main()
