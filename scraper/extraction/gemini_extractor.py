"""Gemini LLM structured extraction engine and confidence scoring algorithm."""

import os
from dataclasses import dataclass
from typing import Any, Optional

from scraper.config.settings import get_settings
from scraper.core.exceptions import ConfigurationError, ExtractionError
from scraper.core.logging import get_logger
from scraper.extraction.schemas import NotificationExtractedData

logger = get_logger(__name__)

try:
    import google.generativeai as genai
    from google.generativeai.types import GenerationConfig
    HAS_GENAI = True
except ImportError:  # pragma: no cover
    genai = None  # type: ignore[assignment]
    GenerationConfig = None  # type: ignore[assignment]
    HAS_GENAI = False


@dataclass
class ConfidenceResult:
    """Structured evaluation of extraction completeness and confidence."""

    completeness_score: float
    confidence_score: float
    validation_warnings: list[str]
    priority_review: bool
    field_breakdown: dict[str, float]


def calculate_confidence_score(
    data: NotificationExtractedData,
    llm_confidence_hint: Optional[float] = None,
    priority_threshold: float = 0.85,
) -> ConfidenceResult:
    """Calculate the deterministic completeness score and validation warnings.

    Weights:
      - title: 0.15
      - conducting_body: 0.10
      - dates: 0.15 (application_start, application_end, notification_date)
      - vacancies: 0.15 (total_vacancies > 0 or vacancy items specified)
      - qualifications: 0.15 (at least one qualification specified)
      - age_limits: 0.10 (min_age or max_age specified)
      - application_fee: 0.10 (general fee, details, or exemption specified)
      - selection_process: 0.10 (at least one selection stage defined)

    Total Sum = 1.00 (100%)

    Args:
        data: Validated NotificationExtractedData instance.
        llm_confidence_hint: Optional raw confidence from model if available.
        priority_threshold: Threshold below which drafts are flagged for urgent HITL review (default 0.85).

    Returns:
        ConfidenceResult containing score, warning messages, and priority flag.
    """
    field_scores: dict[str, float] = {}
    warnings: list[str] = []

    # 1. Job Title (0.15)
    if data.title and len(data.title.strip()) > 5:
        field_scores["title"] = 0.15
    else:
        field_scores["title"] = 0.0
        warnings.append("Notification title is missing or suspiciously short.")

    # 2. Conducting Body (0.10)
    if data.conducting_body and len(data.conducting_body.strip()) >= 3:
        field_scores["conducting_body"] = 0.10
    else:
        field_scores["conducting_body"] = 0.0
        warnings.append("Recruiting organization / conducting body missing.")

    # 3. Important Dates (0.15)
    date_score = 0.0
    dates = data.important_dates
    if dates:
        if dates.application_end:
            date_score += 0.08
        else:
            warnings.append("Application closing date (deadline) is missing.")

        if dates.application_start:
            date_score += 0.04
        if dates.notification_date:
            date_score += 0.03
    else:
        warnings.append("No important recruitment dates could be extracted.")
    field_scores["dates"] = min(date_score, 0.15)

    # 4. Vacancies (0.15)
    vacancy_score = 0.0
    if data.total_vacancies and data.total_vacancies > 0:
        vacancy_score += 0.10
    if data.vacancies and len(data.vacancies) > 0:
        vacancy_score += 0.05
    if vacancy_score == 0.0:
        warnings.append("Total vacancy count and post-wise breakdown missing.")
    field_scores["vacancies"] = min(vacancy_score, 0.15)

    # 5. Qualifications (0.15)
    if data.qualifications and len(data.qualifications) > 0:
        field_scores["qualifications"] = 0.15
    else:
        field_scores["qualifications"] = 0.0
        warnings.append("Educational qualification criteria missing.")

    # 6. Age Limits (0.10)
    age = data.age_limit
    if age and (age.min_age is not None or age.max_age is not None):
        field_scores["age_limits"] = 0.10
    else:
        field_scores["age_limits"] = 0.0
        warnings.append("Age eligibility criteria missing.")

    # 7. Application Fee (0.10)
    fee = data.application_fee
    if fee and (
        fee.general is not None
        or fee.details is not None
        or fee.sc_st is not None
        or fee.women is not None
    ):
        field_scores["application_fee"] = 0.10
    else:
        field_scores["application_fee"] = 0.0
        warnings.append("Application fee schedule or exemption rules missing.")

    # 8. Selection Process (0.10)
    if data.selection_process and len(data.selection_process) > 0:
        field_scores["selection_process"] = 0.10
    else:
        field_scores["selection_process"] = 0.0
        warnings.append("Selection stages / examination scheme missing.")

    # Calculate aggregate completeness score
    completeness = round(sum(field_scores.values()), 3)

    # Overall confidence: blended with LLM confidence hint if provided
    if llm_confidence_hint is not None and 0.0 <= llm_confidence_hint <= 1.0:
        confidence = round(0.70 * completeness + 0.30 * llm_confidence_hint, 3)
    elif data.confidence_score is not None:
        confidence = round(0.70 * completeness + 0.30 * data.confidence_score, 3)
    else:
        confidence = completeness

    # Flag for priority human review if score is low or if it's an amendment/corrigendum
    priority_review = False
    if completeness < priority_threshold or confidence < priority_threshold:
        priority_review = True
        warnings.append(
            f"Extraction confidence/completeness ({min(completeness, confidence):.2f}) is below "
            f"the {priority_threshold:.2f} threshold: Flagged for priority manual review."
        )
    if data.is_corrigendum:
        priority_review = True
        warnings.append("Notification is marked as a Corrigendum/Amendment: Flagged for priority review.")

    return ConfidenceResult(
        completeness_score=completeness,
        confidence_score=confidence,
        validation_warnings=warnings,
        priority_review=priority_review,
        field_breakdown=field_scores,
    )


class GeminiExtractor:
    """Production extraction engine powered by Google Gemini Structured Outputs."""

    EXTRACTION_SYSTEM_PROMPT = (
        "You are an expert government recruitment notification parser specialized in Indian "
        "public sector examinations (UPSC, SSC, State PSCs like KPSC, Railways RRB, Banking, etc.).\n\n"
        "Your task is to extract all key recruitment details from the official government notice text.\n\n"
        "CRITICAL INVARIANTS & RULES:\n"
        "1. STRICT NULL DISCIPLINE: Never hallucinate, invent, or guess missing information. If a field "
        "is not explicitly stated or is ambiguous in the text, you MUST set it to null. Do NOT use placeholder "
        "strings like 'N/A', 'TBD', '--', or 'Not specified'.\n"
        "2. DATE FORMAT: Extract all dates strictly in ISO 8601 format (YYYY-MM-DD). If day is not known, "
        "provide the raw date string in 'raw_date_snippet' and leave structured date null.\n"
        "3. NUMERIC VALUES: Extract numeric values as numbers (integers or floats). For total vacancies, "
        "provide the exact integer count.\n"
        "4. CORRIGENDUM DETECTION: Check if this notice modifies, extends, cancels, or amends an earlier "
        "notification. If so, set is_corrigendum to true and identify parent_notification_number.\n"
        "5. CATEGORY RESERVATION BREAKDOWN: In vacancies and fees, capture reserved category specifics "
        "(SC, ST, OBC, EWS, PwBD, Ex-Servicemen) wherever available.\n"
    )

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: float = 0.1,
    ):
        """Initialize the Gemini extractor client.

        Args:
            api_key: Google Gemini API key. Defaults to settings or env var.
            model_name: Model identifier (e.g. gemini-1.5-pro or gemini-1.5-flash).
            temperature: Sampling temperature (default 0.1 for high determinism).
        """
        settings = get_settings()
        self.api_key = api_key or settings.gemini_api_key or os.environ.get("GEMINI_API_KEY", "")
        self.model_name = model_name or settings.gemini_model or "gemini-1.5-pro"
        self.temperature = temperature
        self._model: Any = None

        if not self.api_key:
            logger.warning(
                "Gemini API key is not configured. Extraction calls will require key passing or fail.",
                component="GeminiExtractor",
            )

    def _get_model(self) -> Any:
        """Lazily initialize and return the GenerativeModel instance with Structured Outputs."""
        if self._model is not None:
            return self._model

        if not HAS_GENAI:
            raise ExtractionError(
                "google-generativeai package is not installed in the environment.",
                details={"package": "google-generativeai"},
            )

        if not self.api_key:
            raise ConfigurationError(
                "Cannot initialize Gemini model: GEMINI_API_KEY is not configured.",
                details={"model": self.model_name},
            )

        try:
            genai.configure(api_key=self.api_key)
            self._model = genai.GenerativeModel(
                model_name=self.model_name,
                system_instruction=self.EXTRACTION_SYSTEM_PROMPT,
                generation_config={
                    "response_mime_type": "application/json",
                    "response_schema": NotificationExtractedData,
                    "temperature": self.temperature,
                    "max_output_tokens": 8192,
                },
            )
            logger.info(
                "Gemini GenerativeModel configured with Structured Outputs",
                model=self.model_name,
                temperature=self.temperature,
            )
            return self._model
        except Exception as exc:
            logger.error("Failed to configure Gemini GenerativeModel", error=str(exc))
            raise ExtractionError(
                f"Failed to configure Gemini model: {exc}",
                details={"model": self.model_name, "error": str(exc)},
            ) from exc

    def extract(self, raw_text: str) -> NotificationExtractedData:
        """Extract structured recruitment data from raw notification text.

        Args:
            raw_text: Extracted plain text from the PDF document.

        Returns:
            Validated NotificationExtractedData Pydantic model instance.

        Raises:
            ExtractionError: If Gemini API fails, times out, or output violates schema.
        """
        if not raw_text or len(raw_text.strip()) < 50:
            raise ExtractionError(
                "Raw text is empty or too short for meaningful recruitment extraction.",
                details={"text_length": len(raw_text) if raw_text else 0},
            )

        model = self._get_model()

        user_prompt = (
            "Extract all government recruitment notification details from the following official text:\n\n"
            "--- BEGIN NOTIFICATION TEXT ---\n"
            f"{raw_text[:120000]}\n"  # Guardrail against token overflows (Gemini 1.5 has large context window)
            "--- END NOTIFICATION TEXT ---\n\n"
            "Extract the complete structured data matching the required schema. Observe strict null discipline."
        )

        try:
            logger.info(
                "Submitting document text to Gemini for structured extraction",
                text_chars=len(raw_text),
                model=self.model_name,
            )
            response = model.generate_content(user_prompt)

            if not response or not response.text:
                raise ExtractionError(
                    "Gemini API returned an empty response.",
                    details={"model": self.model_name},
                )

            # Validate against Pydantic schema
            extracted = NotificationExtractedData.model_validate_json(response.text)
            logger.info(
                "Successfully extracted and validated structured recruitment data",
                title=extracted.title,
                notification_number=extracted.notification_number,
                vacancies=extracted.total_vacancies,
            )
            return extracted

        except ExtractionError:
            raise
        except Exception as exc:
            logger.error("Gemini structured extraction failed", error=str(exc))
            raise ExtractionError(
                f"Gemini structured extraction failed: {exc}",
                details={"model": self.model_name, "error": str(exc)},
            ) from exc

    async def extract_async(self, raw_text: str) -> NotificationExtractedData:
        """Asynchronously extract structured recruitment data from raw notification text.

        Args:
            raw_text: Extracted plain text from the PDF document.

        Returns:
            Validated NotificationExtractedData Pydantic model instance.
        """
        if not raw_text or len(raw_text.strip()) < 50:
            raise ExtractionError(
                "Raw text is empty or too short for meaningful recruitment extraction.",
                details={"text_length": len(raw_text) if raw_text else 0},
            )

        model = self._get_model()

        user_prompt = (
            "Extract all government recruitment notification details from the following official text:\n\n"
            "--- BEGIN NOTIFICATION TEXT ---\n"
            f"{raw_text[:120000]}\n"
            "--- END NOTIFICATION TEXT ---\n\n"
            "Extract the complete structured data matching the required schema. Observe strict null discipline."
        )

        try:
            logger.info(
                "Submitting document text to Gemini async for structured extraction",
                text_chars=len(raw_text),
                model=self.model_name,
            )
            response = await model.generate_content_async(user_prompt)

            if not response or not response.text:
                raise ExtractionError(
                    "Gemini API returned an empty response.",
                    details={"model": self.model_name},
                )

            extracted = NotificationExtractedData.model_validate_json(response.text)
            logger.info(
                "Successfully extracted and validated structured data (async)",
                title=extracted.title,
                notification_number=extracted.notification_number,
            )
            return extracted

        except ExtractionError:
            raise
        except Exception as exc:
            logger.error("Gemini async structured extraction failed", error=str(exc))
            raise ExtractionError(
                f"Gemini async structured extraction failed: {exc}",
                details={"model": self.model_name, "error": str(exc)},
            ) from exc
