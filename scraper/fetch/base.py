"""Base abstract class for page fetchers."""

from abc import ABC, abstractmethod
from typing import Any, Optional


class BaseFetcher(ABC):
    """Abstract interface for all web fetching engines."""

    @abstractmethod
    async def fetch(self, url: str, wait_selector: Optional[str] = None, **kwargs: Any) -> str:
        """Fetch raw HTML content from target URL."""
        pass

    @abstractmethod
    async def close(self) -> None:
        """Release underlying network connections or browser processes."""
        pass
