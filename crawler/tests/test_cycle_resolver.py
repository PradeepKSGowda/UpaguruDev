"""Unit tests for Deterministic Cycle Resolver and Confidence Gating."""

import unittest
from crawler.core.cycle_resolver import CycleResolver
from crawler.core.models import (
    ExtractedDocumentPayload,
    LinkingDecision,
    ReferenceIdentity,
    ResolvedExamCandidate,
)


class TestCycleResolver(unittest.TestCase):
    """Test multi-signal matching and threshold gating."""

    def setUp(self):
        self.exam_cse = ResolvedExamCandidate(
            exam_code="UPSC_CSE",
            canonical_name="Civil Services Examination",
            confidence=100.0,
        )
        self.existing_cycles = [
            {
                "id": "cycle-cse-2026",
                "exam_master_id": "master-cse",
                "exam_code": "UPSC_CSE",
                "cycle_year": 2026,
                "cycle_code": "UPSC_CSE_2026",
                "cycle_label": "UPSC CSE 2026",
                "primary_reference_no": "05/2026-CSP",
            }
        ]

    def test_exact_reference_match_auto_links(self):
        doc = ExtractedDocumentPayload(
            organization_code="UPSC",
            source_url="https://upsc.gov.in/notice.pdf",
            canonical_url="https://upsc.gov.in/notice.pdf",
            title="Corrigendum - Civil Services Examination",
            normalized_title="corrigendum civil services examination",
            text_content="Corrigendum with respect to Examination Notice No. 05/2026-CSP",
            references=[
                ReferenceIdentity(
                    reference_type="EXAM_NOTICE_NO",
                    raw_reference="05/2026-CSP",
                    normalized_reference="UPSC:EXAM_NOTICE_NO:05/2026-CSP",
                )
            ],
        )

        match = CycleResolver.resolve_cycle(
            doc=doc,
            exam_candidate=self.exam_cse,
            existing_cycles=self.existing_cycles,
        )

        self.assertEqual(match.decision, LinkingDecision.AUTO_LINK)
        self.assertEqual(match.exam_cycle_id, "cycle-cse-2026")
        self.assertGreaterEqual(match.score, 85.0)

    def test_omitted_year_resolved_via_existing_cycle(self):
        doc = ExtractedDocumentPayload(
            organization_code="UPSC",
            source_url="https://upsc.gov.in/interview.pdf",
            canonical_url="https://upsc.gov.in/interview.pdf",
            title="Notice regarding Personality Test for Civil Services Examination",
            normalized_title="notice personality test civil services examination",
            text_content="Personality test schedule for candidates of Civil Services Examination",
            references=[],
        )

        match = CycleResolver.resolve_cycle(
            doc=doc,
            exam_candidate=self.exam_cse,
            existing_cycles=self.existing_cycles,
        )

        # Inferred year matches active cycle
        self.assertIn(match.decision, (LinkingDecision.AUTO_LINK, LinkingDecision.REVIEW_RECOMMENDED))
        self.assertEqual(match.exam_cycle_id, "cycle-cse-2026")

    def test_conflicting_year_does_not_auto_link_to_2026(self):
        doc = ExtractedDocumentPayload(
            organization_code="UPSC",
            source_url="https://upsc.gov.in/2025.pdf",
            canonical_url="https://upsc.gov.in/2025.pdf",
            title="Civil Services Examination, 2025 Marks Reserve List",
            normalized_title="civil services examination 2025 marks reserve list",
            text_content="Reserve list for Civil Services Examination 2025",
            references=[],
        )

        match = CycleResolver.resolve_cycle(
            doc=doc,
            exam_candidate=self.exam_cse,
            existing_cycles=self.existing_cycles,
        )

        # Must propose new 2025 cycle or avoid linking to 2026
        self.assertNotEqual(match.exam_cycle_id, "cycle-cse-2026")
        self.assertEqual(match.cycle_year, 2025)


if __name__ == "__main__":
    unittest.main()
