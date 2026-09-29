# How to Add a New Organization in < 30 Minutes

## Overview & Architecture Contract

In **UPA-GURU**, the core intelligence engine (normalization, reference extraction, classification, confidence scoring, cycle resolution, event non-destructive supersession, state progression, and deduplication) is completely organization-agnostic.

To add a new organization (such as **RBI, NABARD, SEBI, SBI, DRDO, AFCAT, NTA**, or any State Public Service Commission / Police Recruitment Board), you do **NOT** rewrite parsing pipelines or fork crawlers. You only supply:

1. **Declarative Configuration:** `crawler/configs/<org>.yaml`
2. **Source Adapter:** `crawler/adapters/<org>.py` subclassing `RecruitmentSourceAdapter`
3. **Registry Entry:** Register the adapter in `crawler/adapters/registry.py`
4. **Sanitized Fixtures & Test:** `crawler/tests/fixtures/<org>/` and verification test in `crawler/tests/test_adapters.py`

Total estimated setup time: **15 to 30 minutes**.

---

## Step 1: Create the Declarative Config (`crawler/configs/<org>.yaml`)

Create `crawler/configs/<org>.yaml` defining the organization identity, listing URLs, reference number regexes, exam codes, aliases, stage mappings, and document classification keywords.

### Example: Adding RBI (Reserve Bank of India)

```yaml
organization:
  code: "RBI"
  name: "Reserve Bank of India - Services Board"
  short_name: "RBI"
  organization_type: "BANKING_INSTITUTE"
  official_website: "https://rbi.org.in"
  state: null

discovery:
  base_url: "https://opportunities.rbi.org.in"
  listing_pages:
    - url: "https://opportunities.rbi.org.in/scripts/vacancies.aspx"
      label: "Current Vacancies"
    - url: "https://opportunities.rbi.org.in/scripts/results.aspx"
      label: "Results"

reference_patterns:
  - type: "ADVERTISEMENT_NO"
    regex: '(?i)(?:Advt\.?\s*No\.?|Advertisement\s+No\.?)\s*[:\-]?\s*(\d+[A-Za-z]?\s*/\s*\d{4}(?:-\d{2,4})?)'
    canonical_format: "RBI:ADVT:{0}"

exams:
  - exam_code: "RBI_GRADE_B"
    name: "Officers in Grade 'B' (Direct Recruit - DR) (General/DEPR/DSIM)"
    short_name: "Grade B"
    category: "BANKING"
    aliases:
      - "RBI Grade B"
      - "Officers in Grade B"
      - "Officers in Gr B (DR)"
    discriminators:
      include: ["grade b", "gr b"]
      exclude: ["grade a", "assistant"]

  - exam_code: "RBI_ASSISTANT"
    name: "Recruitment for the Post of Assistant"
    short_name: "Assistant"
    category: "BANKING"
    aliases:
      - "RBI Assistant"
      - "Assistant Recruitment"
    discriminators:
      include: ["assistant"]
      exclude: ["grade b"]

stages:
  "phase-i": { stage: "PHASE_1", event_type: "CBT_1" }
  "phase 1": { stage: "PHASE_1", event_type: "CBT_1" }
  "phase-ii": { stage: "PHASE_2", event_type: "CBT_2" }
  "phase 2": { stage: "PHASE_2", event_type: "CBT_2" }
  "interview": { stage: "INTERVIEW", event_type: "INTERVIEW" }
```

---

## Step 2: Implement the Adapter (`crawler/adapters/<org>.py`)

Create `crawler/adapters/rbi.py` extending `RecruitmentSourceAdapter`. The adapter defines how discovery parses the organization's HTML portal or API feeds.

```python
"""RBI Recruitment Source Adapter."""

import re
from typing import List, Optional
from crawler.adapters.base import RecruitmentSourceAdapter
from crawler.core.models import (
    DiscoveredLink,
    ExtractedDocumentPayload,
    ClassificationResult,
    DocumentType,
)


class RBIAdapter(RecruitmentSourceAdapter):
    """Adapter for Reserve Bank of India (RBI Services Board)."""

    organization_code: str = "RBI"

    def discover_documents(self) -> List[DiscoveredLink]:
        """
        Scrape RBI Opportunities portal table or RSS feed.
        Yields DiscoveredLink items with source_url, title, and listing date.
        """
        # In production: fetch HTML via session with politeness headers and extract table rows
        # return discovered links
        return []

    def normalize_title(self, title: str) -> str:
        """Apply RBI-specific title cleanup."""
        cleaned = super().normalize_title(title)
        cleaned = re.sub(r"(?i)\s*-\s*reserve\s+bank\s+of\s+india", "", cleaned)
        return cleaned.strip()

    def classify_document(self, doc: ExtractedDocumentPayload) -> ClassificationResult:
        """Classify RBI notices (Mark sheet, Phase-I result, Call letter, Vacancy circular)."""
        title_lower = (doc.title or "").lower()
        if "call letter" in title_lower or "admission letter" in title_lower:
            return ClassificationResult(
                document_type=DocumentType.ADMIT_CARD,
                confidence=95.0,
                matched_rules=["rbi_call_letter_keyword"],
            )
        if "mark sheet" in title_lower or "marks cutoff" in title_lower:
            return ClassificationResult(
                document_type=DocumentType.CUT_OFF,
                confidence=90.0,
                matched_rules=["rbi_cutoff_keyword"],
            )
        return super().classify_document(doc)
```

---

## Step 3: Register in Adapter Registry (`crawler/adapters/registry.py`)

Add the import and entry in `crawler/adapters/registry.py`:

```python
from crawler.adapters.rbi import RBIAdapter

SOURCE_ADAPTERS: dict[str, type[RecruitmentSourceAdapter]] = {
    "UPSC": UPSCAdapter,
    "KPSC": KPSCAdapter,
    "SSC": SSCAdapter,
    "RRB": RRBAdapter,
    "IBPS": IBPSAdapter,
    "RBI": RBIAdapter,  # <--- Added
}
```

---

## Step 4: Add Offline Fixtures & Test Verification

Create a sample text fixture in `crawler/tests/fixtures/rbi/01_grade_b_notification.txt`:

```text
RESERVE BANK OF INDIA SERVICES BOARD, MUMBAI
ADV. NO. 1A / 2026-27
RECRUITMENT FOR THE POST OF OFFICERS IN GRADE 'B' (DIRECT RECRUIT - DR) (GENERAL/DEPR/DSIM)
Applications are invited from eligible candidates for 291 posts of Officers in Grade B.
Important Dates:
Website Link Open for Online Registration: 01.07.2026 to 21.07.2026
Phase-I Examination: 15.08.2026
Phase-II Examination: 19.09.2026
```

Add test case in `crawler/tests/test_adapters.py`:

```python
def test_rbi_adapter_resolution(self):
    adapter = SOURCE_ADAPTERS["RBI"]({})
    doc = ExtractedDocumentPayload(
        raw_url="https://opportunities.rbi.org.in/grade_b.pdf",
        canonical_url="https://opportunities.rbi.org.in/grade_b.pdf",
        title="Recruitment for the Post of Officers in Grade B - Advt 1A/2026-27",
        text_content="RESERVE BANK OF INDIA ADV. NO. 1A / 2026-27 Officers in Grade B 2026",
    )
    exams = adapter.resolve_exams(doc)
    self.assertEqual(len(exams), 1)
    self.assertEqual(exams[0].exam_code, "RBI_GRADE_B")
    
    cycle = adapter.detect_cycle(doc, exams[0])
    self.assertEqual(cycle.cycle_year, 2026)
    self.assertEqual(cycle.cycle_code, "RBI_GRADE_B_2026")
```

Run test suite:
```bash
python -m pytest crawler/tests/ -v
```

---

## What the Common Core Automatically Handles for You:

Once configured, the common core handles all of the following without any custom code:
1. **URL Canonicalization & Stripping Tracking Params** (`url_canonicalizer.py`)
2. **4-Layer Deduplication** (URL, SHA-256 binary hash, SHA-256 normalized content hash, Reference+Type+Date)
3. **Reference Canonicalization** (`reference_extractor.py`)
4. **Document Type Classification** across 35+ recruitment document types
5. **Cycle Resolution & Confidence Scoring** (AUTO_LINK vs REVIEW_REQUIRED)
6. **Corrigenda & Date Rescheduling Detection** (`document_linker.py`)
7. **Non-Destructive Event & Field Supersession** (`versioning_engine.py`)
8. **Cycle Lifecycle State Transitions** (`state_engine.py`)
9. **Data Quality Invariant Validation** (`data_quality.py`)
10. **HITL Review Queue Enqueuing & Candidate Timeline API Delivery**
