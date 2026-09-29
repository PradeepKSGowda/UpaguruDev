"""PDF Extraction Engine with Page-Level Indexing, Table Support, and OCR Fallback Hooks.

Extracts text page-by-page, captures layout blocks, and flags scanned image documents.
"""

import io
from dataclasses import dataclass, field
from typing import Any, Optional

try:
    import pdfplumber
except ImportError:
    pdfplumber = None  # type: ignore

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None  # type: ignore


@dataclass
class ExtractedPDFResult:
    """Consolidated extraction payload for a PDF file."""
    full_text: str
    page_count: int
    page_texts: list[str] = field(default_factory=list)
    tables: list[list[list[Optional[str]]]] = field(default_factory=list)
    is_scanned: bool = False
    ocr_applied: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)


class PDFExtractor:
    """Safe, multi-engine PDF extractor with page tracking and layout preservation."""

    MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB safety guard

    @classmethod
    def extract_from_bytes(
        cls,
        pdf_bytes: bytes,
        extract_tables: bool = True,
        ocr_fallback: bool = False,
    ) -> ExtractedPDFResult:
        """
        Extract text, pages, and tables from in-memory PDF bytes.

        Args:
            pdf_bytes: Raw binary PDF content
            extract_tables: Whether to run structured table extraction
            ocr_fallback: Whether to attempt OCR on scanned pages

        Returns:
            ExtractedPDFResult with page-indexed text and metadata
        """
        if not pdf_bytes:
            return ExtractedPDFResult(full_text="", page_count=0)

        if len(pdf_bytes) > cls.MAX_FILE_SIZE_BYTES:
            raise ValueError(f"PDF exceeds max allowed size of {cls.MAX_FILE_SIZE_BYTES} bytes")

        page_texts: list[str] = []
        extracted_tables: list[list[list[Optional[str]]]] = []
        is_scanned = False
        pdf_metadata: dict[str, Any] = {}

        # 1. Primary extraction with pdfplumber if available
        if pdfplumber is not None:
            try:
                with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                    pdf_metadata = dict(pdf.metadata or {})
                    for page in pdf.pages:
                        text = page.extract_text(layout=True) or ""
                        page_texts.append(text)

                        if extract_tables:
                            page_tables = page.extract_tables()
                            if page_tables:
                                extracted_tables.extend(page_tables)

            except Exception:
                # Fallback to pypdf if pdfplumber encounters an error
                page_texts = []
                extracted_tables = []

        # 2. Fallback to pypdf
        if not page_texts and PdfReader is not None:
            try:
                reader = PdfReader(io.BytesIO(pdf_bytes))
                pdf_metadata = dict(reader.metadata or {})
                for page in reader.pages:
                    text = page.extract_text() or ""
                    page_texts.append(text)
            except Exception as e:
                page_texts = [f"Extraction failed: {e}"]

        total_pages = len(page_texts)
        full_text = "\n\n--- Page Break ---\n\n".join(page_texts)

        # Scanned page detection heuristic
        char_count = sum(len(p.strip()) for p in page_texts)
        if total_pages > 0 and (char_count / total_pages) < 50:
            is_scanned = True

        # OCR fallback hook if document is scanned
        ocr_applied = False
        if is_scanned and ocr_fallback:
            try:
                import pytesseract  # type: ignore
                from pdf2image import convert_from_bytes  # type: ignore

                images = convert_from_bytes(pdf_bytes, first_page=1, last_page=min(total_pages, 5))
                ocr_texts = [pytesseract.image_to_string(img) for img in images]
                if any(len(t.strip()) > 50 for t in ocr_texts):
                    page_texts = ocr_texts
                    full_text = "\n\n--- Page Break (OCR) ---\n\n".join(page_texts)
                    ocr_applied = True
                    is_scanned = False
            except Exception:
                # pytesseract or poppler not available in runtime; keep text as-is
                pass

        return ExtractedPDFResult(
            full_text=full_text,
            page_count=total_pages,
            page_texts=page_texts,
            tables=extracted_tables,
            is_scanned=is_scanned,
            ocr_applied=ocr_applied,
            metadata=pdf_metadata,
        )
