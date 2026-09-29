"""Unit tests for URL Canonicalization and 4-Layer Deduplication."""

import unittest
from crawler.core.deduplication import DeduplicationEngine
from crawler.core.url_canonicalizer import URLCanonicalizer


class TestURLAndDeduplication(unittest.TestCase):
    """Test URL normalization and hashing layers."""

    def test_url_canonicalization_strips_tracking_params(self):
        raw = "https://upsc.gov.in/examinations/active-exams?utm_source=telegram&utm_medium=channel&fbclid=12345"
        canonical = URLCanonicalizer.canonicalize(raw)
        self.assertEqual(canonical, "https://upsc.gov.in/examinations/active-exams")

    def test_url_canonicalization_preserves_cms_params(self):
        raw = "https://kpsc.kar.nic.in/notice.aspx?noticeId=456&file=doc.pdf&utm_campaign=winter"
        canonical = URLCanonicalizer.canonicalize(raw)
        self.assertIn("file=doc.pdf", canonical)
        self.assertIn("noticeId=456", canonical)
        self.assertNotIn("utm_campaign", canonical)

    def test_url_canonicalization_resolves_relative_and_slashes(self):
        base = "https://ssc.gov.in/portal/"
        raw = "documents//notice.pdf"
        canonical = URLCanonicalizer.canonicalize(raw, base_url=base)
        self.assertEqual(canonical, "https://ssc.gov.in/portal/documents/notice.pdf")

    def test_binary_hash_identical_for_same_bytes(self):
        data1 = b"PDF_SAMPLE_DATA_123"
        data2 = b"PDF_SAMPLE_DATA_123"
        h1 = DeduplicationEngine.compute_binary_hash(data1)
        h2 = DeduplicationEngine.compute_binary_hash(data2)
        self.assertEqual(h1, h2)

    def test_content_hash_normalizes_whitespace_and_punctuation(self):
        t1 = "Civil  Services (Preliminary)   Examination, 2026."
        t2 = "Civil Services Preliminary Examination 2026"
        h1 = DeduplicationEngine.compute_content_hash(t1)
        h2 = DeduplicationEngine.compute_content_hash(t2)
        self.assertEqual(h1, h2)


if __name__ == "__main__":
    unittest.main()
