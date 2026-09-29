"""Core typed domain models and DTOs for Multi-Exam Recruitment Intelligence.

Defines Pydantic V2 data structures for document discovery, extraction,
classification, cycle resolution, event versioning, relationships, and evidence provenance.
"""

from datetime import date, datetime
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field


class OrganizationType(str, Enum):
    CENTRAL_COMMISSION = "CENTRAL_COMMISSION"
    STATE_PSC = "STATE_PSC"
    RECRUITMENT_BOARD = "RECRUITMENT_BOARD"
    BANKING_INSTITUTE = "BANKING_INSTITUTE"
    PSU = "PSU"
    OTHER = "OTHER"


class DocumentType(str, Enum):
    ANNUAL_CALENDAR = "ANNUAL_CALENDAR"
    SHORT_NOTICE = "SHORT_NOTICE"
    INITIAL_NOTIFICATION = "INITIAL_NOTIFICATION"
    RECRUITMENT_NOTIFICATION = "RECRUITMENT_NOTIFICATION"
    APPLICATION_NOTICE = "APPLICATION_NOTICE"
    APPLICATION_EXTENSION = "APPLICATION_EXTENSION"
    APPLICATION_CORRECTION_NOTICE = "APPLICATION_CORRECTION_NOTICE"
    CORRIGENDUM = "CORRIGENDUM"
    ADDENDUM = "ADDENDUM"
    CLARIFICATION = "CLARIFICATION"
    SYLLABUS = "SYLLABUS"
    VACANCY_UPDATE = "VACANCY_UPDATE"
    ELIGIBILITY_UPDATE = "ELIGIBILITY_UPDATE"
    FEE_UPDATE = "FEE_UPDATE"
    EXAM_DATE_NOTICE = "EXAM_DATE_NOTICE"
    EXAM_DATE_CHANGE = "EXAM_DATE_CHANGE"
    CITY_INTIMATION = "CITY_INTIMATION"
    ADMIT_CARD = "ADMIT_CARD"
    ANSWER_KEY = "ANSWER_KEY"
    FINAL_ANSWER_KEY = "FINAL_ANSWER_KEY"
    OBJECT_WINDOW_NOTICE = "OBJECT_WINDOW_NOTICE"
    RESULT = "RESULT"
    CUT_OFF = "CUT_OFF"
    MERIT_LIST = "MERIT_LIST"
    DAF_NOTICE = "DAF_NOTICE"
    OPTION_PREFERENCE_NOTICE = "OPTION_PREFERENCE_NOTICE"
    MAINS_NOTICE = "MAINS_NOTICE"
    SKILL_TEST_NOTICE = "SKILL_TEST_NOTICE"
    PHYSICAL_TEST_NOTICE = "PHYSICAL_TEST_NOTICE"
    DOCUMENT_VERIFICATION_NOTICE = "DOCUMENT_VERIFICATION_NOTICE"
    MEDICAL_EXAM_NOTICE = "MEDICAL_EXAM_NOTICE"
    INTERVIEW_NOTICE = "INTERVIEW_NOTICE"
    INTERVIEW_SCHEDULE = "INTERVIEW_SCHEDULE"
    PROVISIONAL_ALLOTMENT = "PROVISIONAL_ALLOTMENT"
    FINAL_RESULT = "FINAL_RESULT"
    RESERVE_LIST = "RESERVE_LIST"
    WITHDRAWAL_NOTICE = "WITHDRAWAL_NOTICE"
    IMPORTANT_NOTICE = "IMPORTANT_NOTICE"
    PRESS_RELEASE = "PRESS_RELEASE"
    OTHER = "OTHER"


class EventType(str, Enum):
    NOTIFICATION_RELEASE = "NOTIFICATION_RELEASE"
    APPLICATION_OPEN = "APPLICATION_OPEN"
    APPLICATION_CLOSE = "APPLICATION_CLOSE"
    APPLICATION_EXTENSION = "APPLICATION_EXTENSION"
    FEE_PAYMENT_OPEN = "FEE_PAYMENT_OPEN"
    FEE_PAYMENT_CLOSE = "FEE_PAYMENT_CLOSE"
    APPLICATION_CORRECTION_OPEN = "APPLICATION_CORRECTION_OPEN"
    APPLICATION_CORRECTION_CLOSE = "APPLICATION_CORRECTION_CLOSE"
    EXAM_CITY_INTIMATION = "EXAM_CITY_INTIMATION"
    ADMIT_CARD_RELEASE = "ADMIT_CARD_RELEASE"
    PRELIMS_EXAM = "PRELIMS_EXAM"
    TIER_1_EXAM = "TIER_1_EXAM"
    TIER_2_EXAM = "TIER_2_EXAM"
    MAINS_EXAM = "MAINS_EXAM"
    CBT_EXAM = "CBT_EXAM"
    CBT_1 = "CBT_1"
    CBT_2 = "CBT_2"
    CBAT_EXAM = "CBAT_EXAM"
    SKILL_TEST = "SKILL_TEST"
    TYPING_TEST = "TYPING_TEST"
    PHYSICAL_TEST = "PHYSICAL_TEST"
    DOCUMENT_VERIFICATION = "DOCUMENT_VERIFICATION"
    MEDICAL_EXAM = "MEDICAL_EXAM"
    DAF_OPEN = "DAF_OPEN"
    DAF_CLOSE = "DAF_CLOSE"
    OPTION_PREFERENCE_OPEN = "OPTION_PREFERENCE_OPEN"
    OPTION_PREFERENCE_CLOSE = "OPTION_PREFERENCE_CLOSE"
    INTERVIEW = "INTERVIEW"
    PERSONALITY_TEST = "PERSONALITY_TEST"
    PROVISIONAL_ANSWER_KEY = "PROVISIONAL_ANSWER_KEY"
    ANSWER_KEY_OBJECTION_OPEN = "ANSWER_KEY_OBJECTION_OPEN"
    ANSWER_KEY_OBJECTION_CLOSE = "ANSWER_KEY_OBJECTION_CLOSE"
    FINAL_ANSWER_KEY = "FINAL_ANSWER_KEY"
    RESULT = "RESULT"
    CUT_OFF = "CUT_OFF"
    SCORECARD_RELEASE = "SCORECARD_RELEASE"
    PROVISIONAL_ALLOTMENT = "PROVISIONAL_ALLOTMENT"
    FINAL_RESULT = "FINAL_RESULT"
    JOINING = "JOINING"
    OTHER = "OTHER"


class RelationshipType(str, Enum):
    CONTINUATION_OF = "CONTINUATION_OF"
    UPDATE_OF = "UPDATE_OF"
    CORRIGENDUM_OF = "CORRIGENDUM_OF"
    ADDENDUM_OF = "ADDENDUM_OF"
    EXTENSION_OF = "EXTENSION_OF"
    DATE_CHANGE_OF = "DATE_CHANGE_OF"
    VACANCY_REVISION_OF = "VACANCY_REVISION_OF"
    RESULT_FOR = "RESULT_FOR"
    CUT_OFF_FOR = "CUT_OFF_FOR"
    ADMIT_CARD_FOR = "ADMIT_CARD_FOR"
    ANSWER_KEY_FOR = "ANSWER_KEY_FOR"
    SYLLABUS_FOR = "SYLLABUS_FOR"
    INTERVIEW_NOTICE_FOR = "INTERVIEW_NOTICE_FOR"
    DAF_FOR = "DAF_FOR"
    WITHDRAWAL_OF = "WITHDRAWAL_OF"
    SUPERSEDES = "SUPERSEDES"
    CLARIFIES = "CLARIFIES"
    RELATED_TO = "RELATED_TO"


class LinkingDecision(str, Enum):
    AUTO_LINK = "AUTO_LINK"
    REVIEW_RECOMMENDED = "REVIEW_RECOMMENDED"
    DO_NOT_LINK = "DO_NOT_LINK"
    MANUAL_LINK = "MANUAL_LINK"
    REJECTED = "REJECTED"


class ExtractionMethod(str, Enum):
    RULE = "RULE"
    REGEX = "REGEX"
    TABLE_PARSER = "TABLE_PARSER"
    LLM = "LLM"
    MANUAL = "MANUAL"


class CycleStatus(str, Enum):
    DISCOVERED = "DISCOVERED"
    APPLICATION_OPEN = "APPLICATION_OPEN"
    APPLICATION_CLOSED = "APPLICATION_CLOSED"
    EXAM_SCHEDULED = "EXAM_SCHEDULED"
    EXAM_IN_PROGRESS = "EXAM_IN_PROGRESS"
    EXAM_COMPLETED = "EXAM_COMPLETED"
    RESULT_PENDING = "RESULT_PENDING"
    RESULT_DECLARED = "RESULT_DECLARED"
    INTERVIEW_SCHEDULED = "INTERVIEW_SCHEDULED"
    FINAL_RESULT_DECLARED = "FINAL_RESULT_DECLARED"
    COMPLETED = "COMPLETED"
    WITHDRAWN = "WITHDRAWN"
    ARCHIVED = "ARCHIVED"


# ---------------------------------------------------------------------------
# DTOs
# ---------------------------------------------------------------------------

class DiscoveredLink(BaseModel):
    """Link candidate discovered on an official portal listing page."""
    model_config = ConfigDict(extra="ignore")

    raw_url: str
    canonical_url: str
    title: str
    listing_page_url: Optional[str] = None
    published_date_raw: Optional[str] = None
    is_direct_pdf: bool = True
    context_text: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ReferenceIdentity(BaseModel):
    """Extracted government circular or advertisement reference."""
    model_config = ConfigDict(extra="ignore")

    reference_type: str  # ADVERTISEMENT_NO, NOTIFICATION_NO, CEN_NO, CRP_CODE, FILE_NO
    raw_reference: str
    normalized_reference: str
    source_snippet: Optional[str] = None
    page_number: Optional[int] = None
    confidence: float = 100.0


class ExtractedDocumentPayload(BaseModel):
    """Document after download and text extraction."""
    model_config = ConfigDict(extra="ignore")

    document_id: Optional[str] = None
    organization_code: str
    source_url: str
    canonical_url: str
    title: str
    normalized_title: str
    mime_type: str = "application/pdf"
    file_size_bytes: Optional[int] = None
    document_hash: Optional[str] = None
    content_hash: Optional[str] = None
    text_content: str = ""
    page_count: int = 1
    page_texts: list[str] = Field(default_factory=list)
    publication_date: Optional[date] = None
    is_multi_exam: bool = False
    references: list[ReferenceIdentity] = Field(default_factory=list)
    raw_metadata: dict[str, Any] = Field(default_factory=dict)


class ClassificationResult(BaseModel):
    """Result of document type classification."""
    model_config = ConfigDict(extra="ignore")

    document_type: DocumentType
    document_subtype: Optional[str] = None
    confidence: float
    matched_rules: list[str] = Field(default_factory=list)
    is_multi_exam: bool = False


class ResolvedExamCandidate(BaseModel):
    """Canonical Exam Master resolved from title or body text."""
    model_config = ConfigDict(extra="ignore")

    exam_code: str
    canonical_name: str
    confidence: float
    matched_alias: Optional[str] = None
    category: Optional[str] = None
    stages: list[str] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)


class CycleMatchCandidate(BaseModel):
    """Proposed attachment to a specific cycle iteration."""
    model_config = ConfigDict(extra="ignore")

    exam_master_id: Optional[str] = None
    exam_cycle_id: Optional[str] = None
    cycle_code: str
    cycle_year: Optional[int] = None
    cycle_label: str
    score: float
    decision: LinkingDecision
    reasons: list[str] = Field(default_factory=list)
    signals: dict[str, Any] = Field(default_factory=dict)
    is_new_cycle: bool = False


class ExtractedEventCandidate(BaseModel):
    """Semantic milestone event extracted from document text."""
    model_config = ConfigDict(extra="ignore")

    event_type: EventType
    stage: Optional[str] = None
    event_name: str
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    is_date_tbd: bool = False
    date_precision: str = "DAY"  # EXACT_TIME, DAY, MONTH_ONLY, QUARTER, TBD
    date_text_original: str
    source_text: str
    page_number: Optional[int] = None
    section: Optional[str] = None
    confidence: float = 90.0
    extraction_method: ExtractionMethod = ExtractionMethod.RULE


class RelationshipCandidate(BaseModel):
    """Inter-document relationship link candidate."""
    model_config = ConfigDict(extra="ignore")

    target_document_id: Optional[str] = None
    target_reference: Optional[str] = None
    relationship_type: RelationshipType
    confidence: float
    reason: str
    signals: dict[str, Any] = Field(default_factory=dict)


class ExtractedFieldChange(BaseModel):
    """Attribute revision extracted from a corrigendum or notice."""
    model_config = ConfigDict(extra="ignore")

    field_name: str  # total_vacancies, age_limit_cutoff_date, application_fee, etc.
    old_value: Optional[Any] = None
    new_value: Any
    change_summary: Optional[str] = None
    source_text: str
    page_number: Optional[int] = None
    section: Optional[str] = None
    confidence: float = 90.0
    extraction_method: ExtractionMethod = ExtractionMethod.RULE


class EvidenceItem(BaseModel):
    """Granular verbatim provenance item."""
    model_config = ConfigDict(extra="ignore")

    field_name: str
    field_value: Any
    page_number: Optional[int] = None
    section: Optional[str] = None
    source_text: str
    extraction_method: ExtractionMethod
    confidence: float
