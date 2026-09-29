"""Declarative portal configuration loader with dynamic database overrides."""

from pathlib import Path
from typing import Any
import yaml
from scraper.core.logging import get_logger
from scraper.core.exceptions import ConfigurationError

logger = get_logger(__name__)

PORTALS_DIR = Path(__file__).resolve().parent.parent / "config" / "portals"


def load_portal_config(portal_code: str) -> dict[str, Any]:
    """
    Load portal configuration YAML file and merge with dynamic database overrides.
    Example: load_portal_config("UPSC") loads config/portals/upsc.yaml, then checks
    public.crawler_portals for any admin-configured current_target_url.
    """
    normalized_code = portal_code.strip().upper()
    filename = f"{portal_code.lower()}.yaml"
    config_path = PORTALS_DIR / filename

    if not config_path.exists():
        logger.error("Portal configuration file not found", path=str(config_path))
        raise ConfigurationError(f"Portal configuration for '{portal_code}' not found at {config_path}")

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f) or {}
            logger.debug("Loaded base portal configuration from YAML", portal=normalized_code)
    except Exception as exc:
        logger.error("Failed to parse YAML configuration", path=str(config_path), error=str(exc))
        raise ConfigurationError(f"Error reading YAML file {config_path}: {exc}") from exc

    # Attempt dynamic DB override from public.crawler_portals
    try:
        from scraper.core.db import get_supabase_client
        client = get_supabase_client()
        res = (
            client.table("crawler_portals")
            .select("current_target_url, wait_selector, is_active")
            .eq("portal_code", normalized_code)
            .limit(1)
            .execute()
        )
        if res.data and len(res.data) > 0:
            db_portal = res.data[0]
            if db_portal.get("current_target_url"):
                old_url = config.get("notifications_url")
                config["notifications_url"] = db_portal["current_target_url"]
                logger.info(
                    "Applied dynamic database target URL override",
                    portal=normalized_code,
                    old_url=old_url,
                    new_url=config["notifications_url"],
                )
            if db_portal.get("wait_selector"):
                config["wait_selector"] = db_portal["wait_selector"]
    except Exception as db_exc:
        # Non-fatal: if DB is unreachable or in mock/offline mode, fallback to YAML
        logger.debug("Dynamic portal DB override skipped; using YAML default", error=str(db_exc))

    return config
