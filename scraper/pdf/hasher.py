"""Streaming SHA-256 hash digest calculation for PDF deduplication."""

import hashlib
from typing import BinaryIO


def compute_bytes_sha256(data: bytes) -> str:
    """Compute standard SHA-256 hex digest for in-memory byte buffer."""
    hasher = hashlib.sha256()
    hasher.update(data)
    return hasher.hexdigest()


def compute_stream_sha256(stream: BinaryIO, chunk_size: int = 65536) -> str:
    """Compute SHA-256 hex digest for streaming file or socket to prevent memory bloat."""
    hasher = hashlib.sha256()
    while chunk := stream.read(chunk_size):
        hasher.update(chunk)
    return hasher.hexdigest()
