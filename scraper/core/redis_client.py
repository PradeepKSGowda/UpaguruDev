"""Upstash Redis client and distributed locking for PDF deduplication."""

from typing import Optional, Set
import redis
from scraper.config.settings import get_settings
from scraper.core.logging import get_logger

logger = get_logger(__name__)

_redis_client: Optional[redis.Redis] = None
_in_memory_locks: Set[str] = set()


def get_redis_client() -> Optional[redis.Redis]:
    """Return singleton Redis client instance or None if not configured."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    settings = get_settings()
    if not settings.redis_url:
        logger.warning("REDIS_URL not configured. Running with in-memory lock fallback.")
        return None

    try:
        _redis_client = redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5,
        )
        # Test connection
        _redis_client.ping()
        logger.info("Connected to Redis successfully for deduplication locking")
        return _redis_client
    except Exception as exc:
        logger.warning("Could not connect to Redis, falling back to in-memory deduplication locks", error=str(exc))
        _redis_client = None
        return None


def get_lock_key(portal_code: str, sha256_hash: str) -> str:
    """Generate standardized Redis deduplication lock key."""
    return f"lock:crawler:{portal_code.lower()}:{sha256_hash}"


def is_pdf_locked(portal_code: str, sha256_hash: str) -> bool:
    """
    Check whether a PDF hash is locked or previously processed in Redis.
    Falls back to in-memory set if Redis is unavailable.
    """
    key = get_lock_key(portal_code, sha256_hash)
    client = get_redis_client()

    if client:
        try:
            return bool(client.exists(key))
        except Exception as exc:
            logger.warning("Redis exists check failed, checking in-memory cache", error=str(exc))

    return key in _in_memory_locks


def acquire_pdf_lock(portal_code: str, sha256_hash: str, ttl_seconds: int = 86400) -> bool:
    """
    Acquire a distributed deduplication lock for 24 hours (86,400 seconds).
    Returns True if acquired (new document), False if already locked.
    """
    key = get_lock_key(portal_code, sha256_hash)
    client = get_redis_client()

    if client:
        try:
            # Set key if not exists (NX) with expiration (EX)
            acquired = bool(client.set(key, "locked", ex=ttl_seconds, nx=True))
            if acquired:
                logger.debug("Acquired Redis deduplication lock", key=key, ttl=ttl_seconds)
            return acquired
        except Exception as exc:
            logger.warning("Redis lock acquisition failed, using in-memory set", error=str(exc))

    # In-memory fallback
    if key in _in_memory_locks:
        return False
    _in_memory_locks.add(key)
    return True


def release_pdf_lock(portal_code: str, sha256_hash: str) -> None:
    """Release or clear lock (typically used on crawl failure to allow retry)."""
    key = get_lock_key(portal_code, sha256_hash)
    client = get_redis_client()

    if client:
        try:
            client.delete(key)
            logger.debug("Released Redis deduplication lock", key=key)
        except Exception as exc:
            logger.warning("Failed to release Redis lock", error=str(exc))

    _in_memory_locks.discard(key)
