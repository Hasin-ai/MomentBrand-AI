"""
Brain-response analysis proxy for the Kaggle-hosted TRIBE v2 API.
"""
from __future__ import annotations

import json
import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.encoders import jsonable_encoder

from config import settings
from services.db import execute_returning, fetch_all, fetch_one

router = APIRouter(prefix="/brain", tags=["Brain Response"])

_ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp", "image/bmp"}
_MAX_UPLOAD_BYTES = 12 * 1024 * 1024


def _brain_base_url() -> str:
    base = (settings.BRAIN_API_BASE_URL or "").strip().rstrip("/")
    if not base:
        raise HTTPException(
            status_code=503,
            detail="BRAIN_API_BASE_URL is not configured. Start the Kaggle notebook and set its public ngrok URL.",
        )
    return base


def _extract_overall_score(payload: dict) -> float | None:
    try:
        score = payload.get("neuromarketing_analysis", {}).get("overall_ad_engagement_index")
        return float(score) if score is not None else None
    except (TypeError, ValueError):
        return None


def _save_analysis(
    payload: dict,
    *,
    campaign_id: Optional[str],
    campaign_name: Optional[str],
    source_filename: Optional[str],
) -> dict:
    if campaign_id:
        campaign = fetch_one("SELECT id FROM campaigns WHERE id = %s", [campaign_id])
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")

    analysis_id = uuid.uuid4().hex
    payload = jsonable_encoder(payload)
    rows = execute_returning(
        """
        INSERT INTO brain_analyses
            (id, campaign_id, campaign_name, source_filename, status, overall_score,
             response_json, brain_activation_image_url, neuromarketing_chart_url)
        VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
        RETURNING *
        """,
        [
            analysis_id,
            campaign_id,
            payload.get("campaign_name") or campaign_name,
            source_filename,
            payload.get("status") or "success",
            _extract_overall_score(payload),
            json.dumps(payload),
            payload.get("brain_activation_image_url"),
            payload.get("neuromarketing_chart_url"),
        ],
    )
    return rows[0]


@router.get("/health")
async def brain_health():
    base = _brain_base_url()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(f"{base}/health")
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail=f"Brain API is unreachable: {exc}") from exc

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text[:500])
    return response.json()


async def analyze_image_bytes(
    body: bytes,
    *,
    filename: str = "ad-image.png",
    content_type: str = "image/png",
    campaign_id: Optional[str] = None,
    campaign_name: Optional[str] = None,
    normalize_scores: bool = True,
    cleanup_all: bool = True,
) -> dict:
    base = _brain_base_url()
    if not body:
        raise HTTPException(status_code=400, detail="Uploaded file was empty.")
    if len(body) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Ad image is too large. Upload an image under 12 MB.")
    if content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Unsupported image type. Upload a PNG, JPEG, WebP, or BMP ad image.",
        )

    files = {
        "file": (
            filename or "ad-image.png",
            body,
            content_type or "application/octet-stream",
        )
    }
    data = {
        "normalize_scores": str(normalize_scores).lower(),
        "cleanup_all": str(cleanup_all).lower(),
    }
    if campaign_name:
        data["campaign_name"] = campaign_name

    try:
        async with httpx.AsyncClient(timeout=settings.BRAIN_API_TIMEOUT_SECONDS) as client:
            response = await client.post(f"{base}/analyze-ad", files=files, data=data)
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="Brain API analysis timed out.") from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail=f"Brain API is unreachable: {exc}") from exc

    try:
        payload = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Brain API returned a non-JSON response.") from exc

    if response.status_code >= 400 or payload.get("status") == "error":
        message = payload.get("message") or payload.get("detail") or response.text[:500]
        raise HTTPException(
            status_code=response.status_code if response.status_code >= 400 else 502,
            detail={
                "status": "error",
                "error_type": payload.get("error_type", "brain_api_error"),
                "message": message,
            },
        )

    saved = _save_analysis(
        payload,
        campaign_id=campaign_id,
        campaign_name=campaign_name,
        source_filename=filename,
    )
    return {
        "analysis_id": saved["id"],
        "analysis": jsonable_encoder(saved),
        "brain_response": payload,
    }


@router.post("/analyze")
async def analyze_brain_response(
    file: UploadFile = File(...),
    campaign_id: Optional[str] = Form(None),
    campaign_name: Optional[str] = Form(None),
    normalize_scores: bool = Form(True),
    cleanup_all: bool = Form(True),
):
    return await analyze_image_bytes(
        await file.read(),
        filename=file.filename or "ad-image.png",
        content_type=file.content_type or "application/octet-stream",
        campaign_id=campaign_id,
        campaign_name=campaign_name,
        normalize_scores=normalize_scores,
        cleanup_all=cleanup_all,
    )


@router.get("/analyses/{analysis_id}")
async def get_brain_analysis(analysis_id: str):
    row = fetch_one("SELECT * FROM brain_analyses WHERE id = %s", [analysis_id])
    if not row:
        raise HTTPException(status_code=404, detail="Brain analysis not found")
    return jsonable_encoder(row)


@router.get("/campaigns/{campaign_id}/brain-analyses")
async def list_campaign_brain_analyses(campaign_id: str):
    rows = fetch_all(
        """
        SELECT * FROM brain_analyses
        WHERE campaign_id = %s
        ORDER BY created_at DESC
        """,
        [campaign_id],
    )
    return jsonable_encoder(rows)
