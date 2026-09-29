"""Structured Decision Logging and Audit Trail Writer.

Maintains an immutable record of all automated linking, supersession,
classification decisions, and administrator overrides.
"""

from datetime import datetime, timezone
import json
from typing import Any, Optional


class AuditLogger:
    """Writes structured audit logs for recruitment intelligence actions."""

    @classmethod
    def create_log_entry(
        cls,
        action: str,
        entity_type: str,
        entity_id: str,
        actor_type: str = "CRAWLER",
        actor_id: Optional[str] = "SYSTEM",
        before_state: Optional[dict[str, Any]] = None,
        after_state: Optional[dict[str, Any]] = None,
        reasons: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """Format an audit log entry conforming to the audit_logs schema."""
        return {
            "actor_type": actor_type,
            "actor_id": actor_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "before_json": before_state or {},
            "after_json": after_state or {},
            "reasons_json": reasons or [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

    @classmethod
    def persist_log(cls, entry: dict[str, Any], client: Any = None) -> None:
        """Write audit entry to database or fallback to structured console logging."""
        if client is not None:
            try:
                client.table("audit_logs").insert(entry).execute()
                return
            except Exception:
                pass

        # Structured fallback output
        print(f"[AUDIT] {entry['action']} on {entry['entity_type']}:{entry['entity_id']} - Reasons: {json.dumps(entry['reasons_json'])}")
