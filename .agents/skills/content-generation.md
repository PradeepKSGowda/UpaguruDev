# Skill: AI Content Generation & Extraction (`content-generation.md`)

## Input
- **Raw Government Document**: Extracted PDF text string, OCR output, or official gazette notification URL.
- **Conducting Body & Source**: Conducting authority (e.g., KPSC, UPSC, SSC, RRB) and portal metadata.
- **Target Distribution Channels**: Candidate portal summary, Telegram markdown broadcast, WhatsApp template message, FCM Web Push text.
- **Language / Locale Context**: English (primary) and regional languages (e.g., Kannada, Tamil) where applicable.

---

## Output
- **Structured JSON Extraction**: Validated JSON payload matching `draft_notifications.parsed_json` schema (title, vacancies, dates, age limits, qualifications, selection stages).
- **Extraction Confidence Score**: Floating point number between `0.00` and `1.00` based on extraction completeness and field certainty.
- **Candidate-Friendly Summary**: Clear 3-paragraph plain English summary explaining eligibility, key dates, and application procedure.
- **Multi-Channel Push Alert Copy**:
  - **Telegram Alert**: Markdown-formatted broadcast with emoji highlights and action links.
  - **WhatsApp Alert**: Structured parameters matching Meta-approved notification templates.
  - **Web Push (FCM)**: Title (< 50 chars) and body (< 120 chars) optimized for mobile notification trays.

---

## Checklist
- [ ] Dates parsed strictly into ISO 8601 format (`YYYY-MM-DD`).
- [ ] Extraction confidence score explicitly calculated based on core fields presence (title, vacancies, end date, qualification).
- [ ] If confidence score < 0.85, the draft record is flagged with a warning for priority Admin HITL review.
- [ ] Vacancy numbers verified against breakdown tables in the source document; zero hallucination.
- [ ] Official PDF source URL preserved and linked directly.
- [ ] Telegram copy adheres to MarkdownV2 formatting without unescaped special characters.
- [ ] Push notification text fits within device notification display limits without truncation.
- [ ] Gemini prompt uses Structured Outputs (`response_schema` / Pydantic model).

---

## Prompt Template
```markdown
You are the AI Extraction Engine for UPA-GURU, utilizing Google Gemini Structured Outputs.
Parse and summarize the following government exam notification document:

Source Body: [CONDUCTING_BODY]
Source URL: [OFFICIAL_SOURCE_URL]
Raw Document Text:
"""
[RAW_TEXT_FROM_PDF_OR_OCR]
"""

Tasks:
1. Extract all structured parameters into the defined JSON schema (title, notification_number, vacancies, dates, qualifications, age limits).
2. Compute an extraction_confidence_score between 0.00 and 1.00.
3. Write a concise candidate-friendly summary (Eligibility, Key Dates, How to Apply).
4. Draft multi-channel push copy for Telegram, WhatsApp, and Web Push.
5. Return strictly valid JSON adhering to the Pydantic schema.
```

---

## Examples

### Example 1: Gemini Extraction Pipeline (Python)
```python
"""
Module: extraction/gemini_extractor.py
Intent: Uses Google Gemini API with Structured Outputs to parse raw PDF text into JSON.
"""
import os
from pydantic import BaseModel, Field
from typing import List, Optional
import google.generativeai as genai

# Define Pydantic Schema for Structured Output
class NotificationExtractedData(BaseModel):
    title: str = Field(description="Official title of the recruitment notification")
    conducting_body: str = Field(description="Abbreviated authority name e.g. KPSC, UPSC")
    notification_number: Optional[str] = Field(description="Official notification or gazette number")
    total_vacancies: int = Field(default=0, description="Total advertised vacancy count")
    application_start_date: str = Field(description="Application opening date YYYY-MM-DD")
    application_end_date: str = Field(description="Application closing date YYYY-MM-DD")
    exam_date: Optional[str] = Field(default=None, description="Tentative examination date YYYY-MM-DD")
    qualification_required: List[str] = Field(description="Required educational qualifications")
    age_limit_min: Optional[int] = Field(default=None, description="Minimum age requirement")
    age_limit_max: Optional[int] = Field(default=None, description="Maximum age requirement (general category)")
    selection_process: List[str] = Field(default=[], description="Stages of selection e.g. Prelims, Mains, Interview")
    confidence_score: float = Field(ge=0.0, le=1.0, description="Confidence assessment score")

def extract_notification_from_text(raw_text: str, source_body: str) -> NotificationExtractedData:
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = genai.GenerativeModel("gemini-1.5-flash")

    system_instruction = """
    You are an expert Indian government examination notification parser.
    Extract the required recruitment details with zero hallucination.
    Format all dates strictly as YYYY-MM-DD.
    If total vacancies are not explicitly stated, set total_vacancies to 0.
    """

    prompt = f"Conducting Body: {source_body}\n\nDocument Text:\n{raw_text[:15000]}"
    
    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            response_schema=NotificationExtractedData,
            temperature=0.1
        )
    )

    return NotificationExtractedData.model_validate_json(response.text)
```

---

## Failure Conditions
- **Hallucinated Dates or Vacancies**: Inferring or inventing dates not present in the source text.
- **Unvalidated JSON**: Inserting raw LLM output into `draft_notifications.parsed_json` without schema validation.
- **Missing Confidence Score**: Inserting default 0.00 without running validation metrics.
- **Broken Markdown**: Unescaped special characters in Telegram MarkdownV2 breaking message delivery.
- **Overly Verbose Push Alerts**: Web push text exceeding 120 characters causing mobile tray truncation.
