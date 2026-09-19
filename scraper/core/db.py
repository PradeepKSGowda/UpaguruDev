"""Supabase client initialization and database operations wrapper."""

from typing import Any, Optional

try:
    from supabase import create_client, Client
except ImportError:
    create_client = None  # type: ignore[assignment]
    Client = Any  # type: ignore[misc, assignment]

from scraper.config.settings import get_settings
from scraper.core.logging import get_logger
from scraper.core.exceptions import DatabaseError

logger = get_logger(__name__)

_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """Return singleton Supabase client authenticated with service role key."""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    if create_client is None:
        raise DatabaseError(
            "The 'supabase' Python package is not installed in the local environment. "
            "Please run: pip install -r scraper/requirements.txt (or run inside Docker)."
        )

    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.warning("Supabase credentials not configured. Running in mock/offline mode.")
        raise DatabaseError(
            "Supabase credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) missing from environment."
        )

    try:
        _supabase_client = create_client(
            supabase_url=settings.supabase_url,
            supabase_key=settings.supabase_service_role_key,
        )
        logger.info("Supabase client initialized successfully", url=settings.supabase_url)
        return _supabase_client
    except Exception as exc:
        logger.error("Failed to initialize Supabase client", error=str(exc))
        raise DatabaseError(f"Failed to initialize Supabase client: {exc}") from exc


def is_pdf_hash_duplicate(sha256_hash: str) -> bool:
    """Check if the given SHA-256 PDF hash already exists in public.pdf_documents."""
    try:
        client = get_supabase_client()
        response = (
            client.table("pdf_documents")
            .select("id")
            .eq("sha256_hash", sha256_hash)
            .limit(1)
            .execute()
        )
        return len(response.data) > 0
    except DatabaseError:
        return False
    except Exception as exc:
        logger.error("Error checking PDF deduplication hash", hash=sha256_hash, error=str(exc))
        return False


def insert_pdf_document(document_data: dict[str, Any]) -> dict[str, Any]:
    """Insert a new record into public.pdf_documents."""
    client = get_supabase_client()
    try:
        response = client.table("pdf_documents").insert(document_data).execute()
        return response.data[0] if response.data else {}
    except Exception as exc:
        logger.error("Failed to insert into pdf_documents", error=str(exc))
        raise DatabaseError(f"Failed to insert pdf_document: {exc}") from exc


def create_crawl_run(portal_code: str) -> dict[str, Any]:
    """Create a new record in public.crawl_runs to track execution."""
    client = get_supabase_client()
    try:
        response = client.table("crawl_runs").insert({"portal_code": portal_code, "status": "running"}).execute()
        return response.data[0] if response.data else {}
    except Exception as exc:
        logger.error("Failed to create crawl_run", portal=portal_code, error=str(exc))
        raise DatabaseError(f"Failed to create crawl_run: {exc}") from exc


def update_crawl_run(run_id: str, updates: dict[str, Any]) -> None:
    """Update crawl_runs status and telemetry upon completion or failure."""
    client = get_supabase_client()
    try:
        client.table("crawl_runs").update(updates).eq("id", run_id).execute()
    except Exception as exc:
        logger.error("Failed to update crawl_run", run_id=run_id, error=str(exc))


def insert_draft_notification(draft_payload: dict[str, Any]) -> dict[str, Any]:
    """
    Insert an extracted draft notification into public.draft_notifications.
    NON-NEGOTIABLE HITL INVARIANT: Status is strictly 'pending_review'.
    """
    client = get_supabase_client()
    draft_payload["status"] = "pending_review"
    if not draft_payload.get("source_name"):
        draft_payload["source_name"] = "Official Notification"

    try:
        response = client.table("draft_notifications").insert(draft_payload).execute()
        return response.data[0] if response.data else {}
    except Exception as exc:
        logger.error("Failed to insert draft_notification", error=str(exc))
        raise DatabaseError(f"Failed to insert draft_notification: {exc}") from exc
