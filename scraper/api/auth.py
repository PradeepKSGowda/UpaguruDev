"""Internal API security and Bearer authentication dependency."""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from scraper.config.settings import get_settings

security = HTTPBearer()


def verify_scraper_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Validate Bearer token against configured SCRAPER_API_SECRET."""
    settings = get_settings()
    expected_token = settings.scraper_api_secret

    if not expected_token or credentials.credentials != expected_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing Scraper API Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return credentials.credentials
