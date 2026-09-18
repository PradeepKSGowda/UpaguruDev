"""UPA-GURU Scraper Microservice Entrypoint.

FastAPI worker service for crawling government portals, extracting exam notifications,
parsing structured recruitment data via Gemini AI, and inserting drafts for HITL review.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator, Any
from fastapi import FastAPI, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from scraper.config.settings import get_settings
from scraper.core.logging import configure_logging, get_logger
from scraper.core.storage import ensure_cache_directory
from scraper.scheduler.cron import start_scheduler, stop_scheduler
from scraper.api import api_router

# Configure structured logging at import time
configure_logging()
logger = get_logger("scraper.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Microservice lifecycle event handlers for startup and shutdown."""
    settings = get_settings()
    logger.info(
        "Starting UPA-GURU Scraper Microservice",
        environment=settings.environment,
        port=settings.port,
        headless=settings.headless_browser,
    )
    ensure_cache_directory()
    start_scheduler()
    yield
    stop_scheduler()
    logger.info("Shutting down UPA-GURU Scraper Microservice cleanly")


app = FastAPI(
    title="UPA-GURU Scraper Microservice",
    description="Automated crawler, PDF processor, and Gemini AI structured extraction worker for government recruitment notifications.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if get_settings().environment != "production" else None,
    redoc_url="/redoc" if get_settings().environment != "production" else None,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include operational API router (protected endpoints)
app.include_router(api_router)


@app.get(
    "/health",
    tags=["System"],
    summary="Microservice Liveness & Readiness Health Check",
    status_code=status.HTTP_200_OK,
)
async def health_check() -> dict[str, Any]:
    """
    Health check endpoint for Docker, AWS ECS Fargate, Kubernetes, and uptime monitoring.
    Returns HTTP 200 with service metadata when healthy.
    """
    settings = get_settings()
    return {
        "status": "ok",
        "service": "upa-guru-scraper",
        "version": "1.0.0",
        "environment": settings.environment,
        "database_configured": bool(settings.supabase_url and settings.supabase_service_role_key),
        "ai_engine_configured": bool(settings.gemini_api_key),
    }


@app.get(
    "/",
    tags=["System"],
    summary="Root Service Information",
    status_code=status.HTTP_200_OK,
)
async def root() -> dict[str, str]:
    """Root endpoint describing service responsibility and sacred HITL invariant."""
    return {
        "service": "UPA-GURU Scraper & AI Extraction Engine",
        "status": "operational",
        "invariant": "All output routed exclusively to draft_notifications for human review.",
    }


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "scraper.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=(settings.environment == "development"),
    )
