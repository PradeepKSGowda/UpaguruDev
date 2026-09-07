# ADR-011: Blob & Media Storage System Architecture

## Status
Accepted

## Date
2026-09-02

## Context & Problem Statement
UPA-GURU processes thousands of official government notification PDF attachments, gazette downloads, and organization logos (e.g. KPSC, UPSC, SSC, RRB logos).

Storage requirements:
- Reliable storage of official PDF documents and image assets.
- Fast global CDN distribution for public downloads.
- Private, secure storage for raw crawler-downloaded PDFs prior to Admin HITL verification.
- Content integrity checks to verify PDF files are not corrupted during scraping.

## Decision Outcome
Adopt **Supabase Storage** (backed by AWS S3) structured into isolated buckets with distinct access policies.

## Storage Bucket Layout

| Bucket Name | Access Level | Contents | CDN Caching |
| :--- | :--- | :--- | :--- |
| **`public-notifications`** | Public Read | Official verified PDF notifications & syllabi documents. | Enabled (`Cache-Control: max-age=31536000`) |
| **`public-logos`** | Public Read | Organization and exam body logo images (`logo_url`). | Enabled (`Cache-Control: max-age=31536000`) |
| **`draft-attachments`** | Private / Admin Only | Raw PDF extractions from Python scrapers prior to HITL approval. | Disabled (Signed URLs with 15-minute expiry) |

## PDF Processing & Upload Pipeline
1. **Python Crawler**: Downloads raw PDF from government portal $\rightarrow$ Stores file in `draft-attachments` bucket.
2. **AI Extraction Engine**: Reads PDF from `draft-attachments` bucket $\rightarrow$ Executes LLM structured parsing.
3. **Admin HITL Publish**: Upon admin approval, the backend moves/promotes the verified PDF to `public-notifications` bucket and attaches the immutable URL to `notifications.official_pdf_url`.

## Consequences

### Positive
- Strict separation between unverified crawler PDFs and published candidate attachments.
- Global CDN caching guarantees instant PDF downloads for candidates without hitting application server disk/memory.
- Standard S3 API compatibility allows easy migration if required.

### Negative
- PDF file size limits (50MB max per attachment) must be configured on upload endpoints.

## Compliance & Guardrails
- Complies strictly with `.agents/rules/AGENTS.md` Rule 3 (Row Level Security on storage buckets).
