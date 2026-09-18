"""Dual-engine PDF text extractor using pypdf with pdfplumber fallback."""

import io
from dataclasses import dataclass
from typing import Optional
from pypdf import PdfReader
from scraper.core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class ExtractedPDFText:
    """Encapsulates extracted text and structural metadata."""
    text: str
    page_count: int
    char_count: int
    engine_used: str
    is_scanned_image: bool = False


class PDFTextExtractor:
    """Extracts clean text and metadata from PDF bytes using a two-stage strategy."""

    @staticmethod
    def extract(pdf_bytes: bytes) -> ExtractedPDFText:
        """
        Extract text from PDF byte buffer.
        Strategy:
        1. Fast extraction via pypdf.
        2. If character yield is low or layout complex, fallback to pdfplumber.
        """
        stream = io.BytesIO(pdf_bytes)

        # Stage 1: Try pypdf for high-speed extraction
        text_chunks: list[str] = []
        page_count = 0
        try:
            reader = PdfReader(stream)
            page_count = len(reader.pages)
            for idx, page in enumerate(reader.pages):
                page_text = page.extract_text() or ""
                text_chunks.append(page_text.strip())

            full_pypdf_text = "\n\n".join(chunk for chunk in text_chunks if chunk)
            char_count = len(full_pypdf_text)

            # Heuristic: If average characters per page >= 100, pypdf extraction is high quality
            if page_count > 0 and (char_count / page_count) >= 100:
                logger.info(
                    "Extracted PDF text via pypdf",
                    pages=page_count,
                    chars=char_count,
                )
                return ExtractedPDFText(
                    text=full_pypdf_text,
                    page_count=page_count,
                    char_count=char_count,
                    engine_used="pypdf",
                    is_scanned_image=False,
                )

        except Exception as exc:
            logger.warning("pypdf extraction encountered an issue, falling back to pdfplumber", error=str(exc))

        # Stage 2: Fallback to pdfplumber for complex or tabular layouts
        try:
            import pdfplumber

            stream.seek(0)
            plumber_chunks: list[str] = []
            with pdfplumber.open(stream) as pdf:
                page_count = len(pdf.pages)
                for page in pdf.pages:
                    page_text = page.extract_text(layout=True) or ""
                    # Also extract tables if present
                    tables = page.extract_tables()
                    for table in tables:
                        for row in table:
                            row_str = " | ".join(cell or "" for cell in row if cell)
                            if row_str:
                                page_text += f"\n{row_str}"
                    plumber_chunks.append(page_text.strip())

            full_plumber_text = "\n\n".join(c for c in plumber_chunks if c)
            char_count = len(full_plumber_text)

            is_scanned = char_count < 100 and page_count > 0
            if is_scanned:
                logger.warning("Low character count detected. PDF appears to be a scanned image.", pages=page_count, chars=char_count)

            logger.info("Extracted PDF text via pdfplumber", pages=page_count, chars=char_count, scanned=is_scanned)
            return ExtractedPDFText(
                text=full_plumber_text,
                page_count=page_count,
                char_count=char_count,
                engine_used="pdfplumber",
                is_scanned_image=is_scanned,
            )

        except Exception as exc:
            logger.error("Both pypdf and pdfplumber extraction failed", error=str(exc))
            # Return whatever pypdf managed to gather
            fallback_text = "\n\n".join(text_chunks)
            return ExtractedPDFText(
                text=fallback_text,
                page_count=page_count,
                char_count=len(fallback_text),
                engine_used="pypdf_partial",
                is_scanned_image=len(fallback_text) < 100,
            )
