"""Declarative YAML portal configuration loader."""

from pathlib import Path
from typing import Any
import yaml
from scraper.core.logging import get_logger
from scraper.core.exceptions import ConfigurationError

logger = get_logger(__name__)

PORTALS_DIR = Path(__file__).resolve().parent.parent / "config" / "portals"


def load_portal_config(portal_code: str) -> dict[str, Any]:
    """
    Load and parse portal configuration YAML file.
    Example: load_portal_config("KPSC") looks for config/portals/kpsc.yaml.
    """
    filename = f"{portal_code.lower()}.yaml"
    config_path = PORTALS_DIR / filename

    if not config_path.exists():
        logger.error("Portal configuration file not found", path=str(config_path))
        raise ConfigurationError(f"Portal configuration for '{portal_code}' not found at {config_path}")

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
            logger.debug("Loaded portal configuration successfully", portal=portal_code)
            return config
    except Exception as exc:
        logger.error("Failed to parse YAML configuration", path=str(config_path), error=str(exc))
        raise ConfigurationError(f"Error reading YAML file {config_path}: {exc}") from exc
