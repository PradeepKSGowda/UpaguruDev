"""Pydantic V2 schemas for AI-powered recruitment notification extraction."""

from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class ImportantDates(BaseModel):
    """Critical dates governing the recruitment lifecycle."""
    model_config = ConfigDict(extra="ignore")

    notification_date: Optional[str] = Field(
        None, description="Date on which the notification was published (YYYY-MM-DD)"
    )
    application_start: Optional[str] = Field(
        None, description="Start date for online/offline application submission (YYYY-MM-DD)"
    )
    application_end: Optional[str] = Field(
        None, description="Final closing deadline for application submission (YYYY-MM-DD)"
    )
    exam_date: Optional[str] = Field(
        None, description="Scheduled date or date range for the examination (YYYY-MM-DD)"
    )
    admit_card_date: Optional[str] = Field(
        None, description="Anticipated release date for hall tickets / admit cards (YYYY-MM-DD)"
    )
    raw_date_snippet: Optional[str] = Field(
        None, description="Original verbatim date clause from notification text if ambiguous"
    )


class AgeLimit(BaseModel):
    """Age eligibility criteria and community-specific concessions."""
    model_config = ConfigDict(extra="ignore")

    min_age: Optional[int] = Field(None, description="Minimum permissible age in completed years")
    max_age: Optional[int] = Field(None, description="Maximum permissible age for unreserved candidates")
    cutoff_date: Optional[str] = Field(None, description="Crucial date for determining age eligibility (YYYY-MM-DD)")
    relaxation_details: Optional[dict[str, int]] = Field(
        default=None,
        description="Concession in years per category, e.g. {'SC/ST': 5, 'OBC': 3, 'PWD': 10}",
    )


class ApplicationFee(BaseModel):
    """Application and processing fee schedule."""
    model_config = ConfigDict(extra="ignore")

    general: Optional[float] = Field(None, description="Application fee in INR for General / Unreserved candidates")
    obc: Optional[float] = Field(None, description="Fee in INR for Other Backward Classes (OBC)")
    sc_st: Optional[float] = Field(None, description="Fee in INR for SC / ST candidates")
    women: Optional[float] = Field(None, description="Fee in INR for female candidates")
    ex_serviceman: Optional[float] = Field(None, description="Fee in INR for Ex-Servicemen")
    payment_mode: Optional[str] = Field(None, description="Permissible payment methods (Online, Challan, Demand Draft)")
    details: Optional[str] = Field(None, description="Exemption clauses and fee concession conditions")


class VacancyDetail(BaseModel):
    """Individual post designation and post-wise vacancy quota."""
    model_config = ConfigDict(extra="ignore")

    post_name: str = Field(..., description="Official title or designation of the advertised post")
    department: Optional[str] = Field(None, description="Hiring government department, ministry, or cadence")
    count: Optional[int] = Field(None, description="Number of vacancies declared for this specific post")
    pay_scale: Optional[str] = Field(None, description="Salary scale, Pay Level, or Matrix band, e.g. Level-10 (Rs. 56,100 - 1,77,500)")
    category_quota: Optional[dict[str, int]] = Field(
        default=None, description="Quota breakdown by reservation category, e.g. {'UR': 40, 'OBC': 27, 'SC': 15, 'ST': 7, 'EWS': 10}"
    )


class QualificationDetail(BaseModel):
    """Educational qualifications, technical certifications, and mandatory experience."""
    model_config = ConfigDict(extra="ignore")

    degree_level: str = Field(
        ...,
        description="Minimum education tier: 10th Pass, 12th Pass, Diploma, Bachelor's Degree, Master's Degree, PhD, MBBS, LLB",
    )
    discipline: Optional[str] = Field(
        None, description="Field of study or specialization required (e.g. Civil Engineering, Computer Science, Law)"
    )
    mandatory_certifications: Optional[list[str]] = Field(
        default=None, description="Required certificates (e.g. Typing speed, Computer proficiency, Heavy vehicle driving license)"
    )
    experience_years: Optional[int] = Field(
        None, description="Minimum mandatory post-qualification experience in years"
    )


class SelectionStage(BaseModel):
    """Single stage in the multi-tier selection process."""
    model_config = ConfigDict(extra="ignore")

    stage_order: int = Field(..., description="Sequential order of this stage (1, 2, 3...)")
    stage_name: str = Field(
        ...,
        description="Name of stage: Preliminary Exam, Mains Exam, Physical Efficiency Test (PET), Interview, Document Verification",
    )
    exam_format: Optional[str] = Field(
        None, description="Format: Computer Based Test (CBT), Pen-Paper OMR, Descriptive Written, Physical, Viva-Voce"
    )
    marks: Optional[int] = Field(None, description="Maximum marks allotted to this stage")
    duration_hours: Optional[float] = Field(None, description="Duration of examination in hours")


class NotificationExtractedData(BaseModel):
    """
    Root output schema for Gemini AI Structured Outputs.
    Guarantees 100% JSON compliance with public.draft_notifications.parsed_json.
    
    NON-NEGOTIABLE NULL DISCIPLINE:
    Never invent or estimate missing fields. If information is absent from
    the official document, the field must resolve to None (null).
    """
    model_config = ConfigDict(extra="ignore")

    # Core Identifiers
    title: str = Field(..., description="Official title of the exam or recruitment notification")
    conducting_body: str = Field(..., description="Agency conducting the recruitment, e.g. KPSC, UPSC, SSC, RRB")
    notification_number: Optional[str] = Field(
        None, description="Official advertisement or notification reference number, e.g. Advt No. 05/2024"
    )
    category: Optional[str] = Field(
        None, description="Exam category: Civil Services, Engineering, Defense, Police, Banking, Railway, Teaching, Medical"
    )
    state_or_central: Optional[str] = Field(
        None, description="'Central' or the specific Indian State name (e.g. 'Karnataka', 'Maharashtra')"
    )

    # Vacancy Aggregation
    total_vacancies: Optional[int] = Field(
        None, description="Aggregated total vacancies declared across all posts in this notification"
    )
    vacancies_breakdown: list[VacancyDetail] = Field(
        default_factory=list, description="List of individual post vacancies with category allocations"
    )

    # Structured Child Models
    important_dates: ImportantDates = Field(
        default_factory=ImportantDates, description="Critical operational deadlines and exam dates"
    )
    qualifications: list[QualificationDetail] = Field(
        default_factory=list, description="Prescribed educational qualifications and requirements"
    )
    age_limits: AgeLimit = Field(
        default_factory=AgeLimit, description="Age eligibility boundaries and category concessions"
    )
    application_fee: ApplicationFee = Field(
        default_factory=ApplicationFee, description="Application fees and fee exemption rules"
    )
    selection_process: list[SelectionStage] = Field(
        default_factory=list, description="Ordered stages of the candidate selection methodology"
    )

    # Links & Official Portals
    official_pdf_url: Optional[str] = Field(
        None, description="Public download URL for the official notification PDF"
    )
    apply_online_url: Optional[str] = Field(
        None, description="Direct URL to the portal application submission page"
    )
    official_website: Optional[str] = Field(
        None, description="Official portal homepage URL of the recruiting agency"
    )

    # Corrigendum / Amendment Handling
    is_corrigendum: bool = Field(
        False, description="True if this document is an amendment, corrigendum, or deadline extension notice"
    )
    corrigendum_details: Optional[str] = Field(
        None, description="Summary of modifications enacted by this corrigendum"
    )

    # Telemetry & Quality Assurance
    field_confidence: dict[str, float] = Field(
        default_factory=dict, description="Self-assessed confidence score per extracted field (0.0 to 1.0)"
    )
    validation_warnings: list[str] = Field(
        default_factory=list, description="Automated warnings for missing mandatory dates, fees, or qualifications"
    )
