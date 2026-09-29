"""Unit tests for Multi-Exam Document Splitting and M:N Linking."""

from pathlib import Path
import unittest
from crawler.core.document_classifier import DocumentClassifier
from crawler.core.models import DocumentType


class TestMultiExamDocuments(unittest.TestCase):
    """Test multi-exam PDF detection and cycle fan-out."""

    def setUp(self):
        fixture_path = Path(__file__).parent / "fixtures" / "upsc" / "annual_calendar_2026.txt"
        with open(fixture_path, "r", encoding="utf-8") as f:
            self.calendar_text = f.read()

    def test_annual_calendar_classified_as_multi_exam(self):
        title = "Annual Programme of Examinations / Recruitment Tests (RTs) - 2026"
        res = DocumentClassifier.classify(title=title, text=self.calendar_text)

        self.assertEqual(res.document_type, DocumentType.ANNUAL_CALENDAR)
        self.assertTrue(res.is_multi_exam)
        self.assertGreaterEqual(res.confidence, 90.0)

    def test_extract_multiple_exams_from_calendar_text(self):
        lines = self.calendar_text.splitlines()
        exam_names = []
        for line in lines:
            if "|" in line and not line.startswith("Sl."):
                parts = [p.strip() for p in line.split("|")]
                if parts and len(parts) >= 2:
                    exam_names.append(parts[0])

        self.assertGreaterEqual(len(exam_names), 5)
        self.assertTrue(any("Engineering Services" in name for name in exam_names))
        self.assertTrue(any("Civil Services" in name for name in exam_names))
        self.assertTrue(any("Forest Service" in name for name in exam_names))


if __name__ == "__main__":
    unittest.main()
