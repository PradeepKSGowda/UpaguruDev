"""Headless Chromium browser fetcher using Playwright for dynamic JavaScript portals."""

from typing import Any, Optional
from playwright.async_api import async_playwright, Browser, BrowserContext, Playwright
from scraper.fetch.base import BaseFetcher
from scraper.core.logging import get_logger
from scraper.core.exceptions import FetchError

logger = get_logger(__name__)

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


class PlaywrightFetcher(BaseFetcher):
    """Playwright Chromium driver with bot evasion and dynamic rendering capabilities."""

    def __init__(self, headless: bool = True, timeout_seconds: int = 30):
        self.headless = headless
        self.timeout_seconds = timeout_seconds
        self._playwright: Optional[Playwright] = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None

    async def _ensure_browser(self) -> BrowserContext:
        """Initialize browser and browser context lazily."""
        if self._context is None:
            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(
                headless=self.headless,
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled",
                ],
            )
            self._context = await self._browser.new_context(
                user_agent=USER_AGENT,
                viewport={"width": 1920, "height": 1080},
                locale="en-IN",
                ignore_https_errors=True,
            )
        return self._context

    async def fetch(self, url: str, wait_selector: Optional[str] = None, **kwargs: Any) -> str:
        """Navigate to URL via headless Chromium and return fully evaluated DOM HTML."""
        context = await self._ensure_browser()
        page = await context.new_page()

        try:
            logger.info("Navigating to dynamic portal URL with Playwright", url=url)
            await page.goto(url, timeout=self.timeout_seconds * 1000, wait_until="domcontentloaded")

            if wait_selector:
                logger.debug("Waiting for DOM selector to resolve", selector=wait_selector)
                try:
                    await page.wait_for_selector(wait_selector, timeout=10000)
                except Exception:
                    logger.warning("Timeout waiting for selector, continuing with available DOM", selector=wait_selector)

            # Wait a brief moment for dynamic hydration
            await page.wait_for_timeout(1000)
            content = await page.content()
            return content
        except Exception as exc:
            logger.error("Playwright navigation failed", url=url, error=str(exc))
            raise FetchError(f"Playwright navigation failed for {url}: {exc}") from exc
        finally:
            await page.close()

    async def close(self) -> None:
        """Tear down browser context, browser instance, and Playwright driver."""
        if self._context:
            await self._context.close()
            self._context = None
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None
        logger.debug("Playwright browser driver terminated cleanly")
