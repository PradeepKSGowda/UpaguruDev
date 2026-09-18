"""Domain exceptions for the UPA-GURU Scraper Microservice."""


class ScraperBaseException(Exception):
    """Base class for all scraper domain exceptions."""

    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ConfigurationError(ScraperBaseException):
    """Raised when environment variables or portal configurations are invalid."""
    pass


class FetchError(ScraperBaseException):
    """Raised when HTTP or browser navigation fails."""
    pass


class PDFDownloadError(ScraperBaseException):
    """Raised when PDF download exceeds limits, times out, or fails integrity checks."""
    pass


class DeduplicationError(ScraperBaseException):
    """Raised when deduplication locks or hash collisions halt processing."""
    pass


class ExtractionError(ScraperBaseException):
    """Raised when LLM structured extraction or schema validation fails."""
    pass


class DatabaseError(ScraperBaseException):
    """Raised when Supabase or PostgreSQL operations fail."""
    pass
