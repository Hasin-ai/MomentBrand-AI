"""
Backend-served local file storage.
"""
from __future__ import annotations

from pathlib import Path

from config import settings


def upload_file_to_storage(bucket_name: str, file_path: str, file_bytes: bytes, content_type: str) -> str:
    safe_path = Path(bucket_name) / file_path.lstrip("/")
    root = Path(settings.UPLOADS_DIR).expanduser().resolve()
    target = (root / safe_path).resolve()
    if not str(target).startswith(str(root)):
        raise ValueError("Invalid upload path")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(file_bytes)

    public_base = (settings.PUBLIC_BASE_URL or "").rstrip("/")
    public_path = "/uploads/" + "/".join(safe_path.parts)
    return public_base + public_path if public_base else public_path
