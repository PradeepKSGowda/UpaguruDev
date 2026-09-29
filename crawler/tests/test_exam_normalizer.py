"""Unit tests for 7-Stage Exam Title Normalization & Discriminative Resolution."""

import unittest
from crawler.core.exam_normalizer import ExamNormalizer


class TestExamNormalizer(unittest.TestCase):
    """Test normalizer accuracy and discriminators preventing false merges."""

    def test_unicode_and_stage_suffix_stripping(self):
        raw = "CIVIL SERVICES (PRELIMINARY) EXAMINATION, 2026 – Time Table"
        cleaned, captured = ExamNormalizer.normalize_title(raw)
        self.assertIn("civil services", cleaned.lower())
        self.assertNotIn("2026", cleaned)

    def test_abbreviation_expansion(self):
        raw = "UPSC CSE 2026 Notice"
        cleaned, _ = ExamNormalizer.normalize_title(raw)
        self.assertIn("Civil Services Examination", cleaned)

    def test_discriminator_distinguishes_cse_from_ese(self):
        # Civil Services vs Engineering Services
        cse_text = "Union Public Service Commission Civil Services Examination, 2026 notice"
        ese_text = "Union Public Service Commission Engineering Services Examination, 2026 notice"

        cand_cse = ExamNormalizer.resolve_exam(text=cse_text, organization_code="UPSC")
        cand_ese = ExamNormalizer.resolve_exam(text=ese_text, organization_code="UPSC")

        self.assertIsNotNone(cand_cse)
        self.assertIsNotNone(cand_ese)
        self.assertEqual(cand_cse.exam_code, "UPSC_CSE")
        self.assertEqual(cand_ese.exam_code, "UPSC_ESE")
        self.assertNotEqual(cand_cse.exam_code, cand_ese.exam_code)

    def test_discriminator_distinguishes_ssc_cgl_from_chsl(self):
        cgl_text = "Staff Selection Commission Combined Graduate Level Examination 2026"
        chsl_text = "Staff Selection Commission Combined Higher Secondary Level Examination 2026"

        cand_cgl = ExamNormalizer.resolve_exam(text=cgl_text, organization_code="SSC")
        cand_chsl = ExamNormalizer.resolve_exam(text=chsl_text, organization_code="SSC")

        self.assertIsNotNone(cand_cgl)
        self.assertIsNotNone(cand_chsl)
        self.assertEqual(cand_cgl.exam_code, "SSC_CGL")
        self.assertEqual(cand_chsl.exam_code, "SSC_CHSL")


if __name__ == "__main__":
    unittest.main()
