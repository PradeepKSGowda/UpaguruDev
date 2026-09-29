"""Unit tests for Document Linker & Inter-Document Relationship Detection."""

import unittest
from crawler.core.document_linker import DocumentLinker
from crawler.core.models import ExtractedDocumentPayload, RelationshipType


class TestDocumentLinker(unittest.TestCase):
    """Test relationship phrase detection."""

    def test_detect_corrigendum_relationship(self):
        doc = ExtractedDocumentPayload(
            organization_code="UPSC",
            source_url="https://upsc.gov.in/corrigendum.pdf",
            canonical_url="https://upsc.gov.in/corrigendum.pdf",
            title="Corrigendum to Civil Services Examination 2026",
            normalized_title="corrigendum civil services examination",
            text_content="In partial modification of Examination Notice No. 05/2026-CSP dated 14.02.2026, vacancies are revised.",
        )
        existing_docs = [
            {"id": "doc-01", "reference_number": "05/2026-CSP", "document_type": "RECRUITMENT_NOTIFICATION"}
        ]

        rels = DocumentLinker.detect_relationships(doc, existing_cycle_documents=existing_docs)
        self.assertGreaterEqual(len(rels), 1)
        rel = rels[0]
        self.assertEqual(rel.relationship_type, RelationshipType.CORRIGENDUM_OF)
        self.assertEqual(rel.target_document_id, "doc-01")

    def test_detect_extension_relationship(self):
        doc = ExtractedDocumentPayload(
            organization_code="UPSC",
            source_url="https://upsc.gov.in/extension.pdf",
            canonical_url="https://upsc.gov.in/extension.pdf",
            title="Important Notice - Extension of Date",
            normalized_title="important notice extension of date",
            text_content="In continuation of Notice No. 05/2026-CSP, the last date is extended to 10.03.2026.",
        )
        existing_docs = [
            {"id": "doc-01", "reference_number": "05/2026-CSP", "document_type": "RECRUITMENT_NOTIFICATION"}
        ]

        rels = DocumentLinker.detect_relationships(doc, existing_cycle_documents=existing_docs)
        self.assertGreaterEqual(len(rels), 1)
        self.assertEqual(rels[0].relationship_type, RelationshipType.EXTENSION_OF)


if __name__ == "__main__":
    unittest.main()
