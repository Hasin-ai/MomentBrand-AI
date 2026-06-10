"""
MomentBrand AI — Campaigns Router
POST /api/campaigns/plan
POST /api/campaigns/generate
POST /api/campaigns/generate-all
POST /api/campaigns/{id}/plan-video
POST /api/campaigns/{id}/generate-video
"""
import asyncio
import html
import json
import shutil
import time
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field, field_validator

from config import settings
from models.blueprint import (
    Blueprint,
    CampaignGenerateResponse,
    CampaignPlanRequest,
    CampaignPlanResponse,
)
from models.video import VideoPlan, VideoGenerateResponse
from services.gemini import plan_campaign, generate_captions, generate_ad_concepts
from services.video_planner import plan_video
from services.video_generator import render_and_upload_video
from services.supabase_client import get_brand, get_supabase, upload_file_to_storage
from services.db import execute_returning, fetch_all, fetch_one
from services.ad_variants import generate_ad_variants
from services.ad_generation import (
    GenerateAdsRequest,
    generate_campaign_ads as run_agentic_ad_generation,
    generate_campaign_variants_only,
)
from services.flux import generate_background
from services.removebg import remove_background as strip_bg
from compositor.template import build_html
from compositor.renderer import render_poster_async

_MOCK_DATA_DIR = Path(__file__).parent.parent.parent / "mock-data"


def _read_image(url_or_path: str) -> bytes:
    """
    Read image bytes from a local file path or URL.
    Local upload URLs are resolved from disk; other HTTP URLs use requests.
    """
    import requests as _requests

    if not url_or_path.startswith("http"):
        return Path(url_or_path).read_bytes()

    resp = _requests.get(url_or_path, timeout=15)
    resp.raise_for_status()
    return resp.content


def _load_cached_posters() -> Optional[dict]:
    """Return cached demo poster response if all three URLs are populated."""
    cached_path = _MOCK_DATA_DIR / "cached_posters.json"
    if not cached_path.exists():
        return None
    try:
        data = json.loads(cached_path.read_text(encoding="utf-8"))
        urls = data.get("formats", {})
        if all(urls.get(ar) for ar in ("1:1", "9:16", "16:9")):
            return {
                "campaign_id": "volt-bd-demo-cached",
                "formats": [
                    {"name": "Instagram Post", "aspect_ratio": "1:1", "poster_url": urls["1:1"]},
                    {"name": "Instagram Story", "aspect_ratio": "9:16", "poster_url": urls["9:16"]},
                    {"name": "Facebook Cover", "aspect_ratio": "16:9", "poster_url": urls["16:9"]},
                ],
                "total_generation_time_seconds": 0.0,
            }
    except Exception:
        pass
    return None

router = APIRouter(tags=["Campaigns"])

# Aspect ratio → (poster column, storage-safe label)
_POSTER_COLUMN = {"1:1": "poster_1x1_url", "9:16": "poster_9x16_url", "16:9": "poster_16x9_url"}

# Canonical formats used by /campaigns/generate-all
_ALL_FORMATS = [
    {"name": "Instagram Post", "width": 1080, "height": 1080, "aspect_ratio": "1:1"},
    {"name": "Instagram Story", "width": 1080, "height": 1920, "aspect_ratio": "9:16"},
    {"name": "Facebook Cover", "width": 1200, "height": 675, "aspect_ratio": "16:9"},
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ar_label(aspect_ratio: str) -> str:
    """Storage-safe label for an aspect ratio, e.g. '1:1' -> '1x1'."""
    return aspect_ratio.replace(":", "x")


def _brand_profile(brand_data: dict) -> dict:
    """Strip DB-specific fields, leaving only what the planner prompt needs."""
    return {
        key: brand_data.get(key)
        for key in (
            "brand_name", "tagline", "tagline_bn", "industry", "target_audience",
            "brand_personality", "colors", "typography", "voice", "do_not_use",
        )
    }


def _plan_blueprint(
    brand_id: str,
    brand_data: dict,
    prompt: str,
    format_spec: dict,
    adherence_level: str,
    product_image_available: bool,
) -> tuple[Blueprint, int]:
    """Plan a campaign with Gemini and return a validated Blueprint + retry count."""
    blueprint_dict, model_used, retries = plan_campaign(
        brand=_brand_profile(brand_data),
        prompt=prompt,
        format_spec=format_spec,
        adherence_level=adherence_level,
        product_image_available=product_image_available,
    )

    blueprint_dict["brand_id"] = brand_id

    voice = brand_data.get("voice")
    language = voice.get("language", "en") if isinstance(voice, dict) else "en"

    metadata = blueprint_dict.setdefault("metadata", {})
    metadata.update({
        "adherence_level": adherence_level,
        "model_used": model_used,
        "retry_count": retries,
        "language": language,
        "prompt": prompt,  # persist the original brief inside the blueprint
    })

    return Blueprint(**blueprint_dict), retries


async def _render_blueprint(
    blueprint: Blueprint,
    brand_data: dict,
    campaign_id: str,
    temp_dir: Path,
) -> tuple[str, Optional[str], float]:
    """
    Generate the background (Flux), render the poster (Playwright), upload both.
    Sync I/O (Flux + local storage uploads) runs in a thread-pool executor so it
    doesn't block the event loop and can overlap with other concurrent renders.
    """
    start = time.time()
    label = _ar_label(blueprint.format.aspect_ratio)
    loop = asyncio.get_running_loop()

    # 1. Background — run sync HTTP in executor so other renders proceed in parallel
    bg_url: Optional[str] = None
    bg_prompt = blueprint.background.prompt if blueprint.background else None
    negative_prompt = ", ".join(brand_data.get("do_not_use", []))
    if bg_prompt:
        try:
            bg_bytes = await loop.run_in_executor(
                None, lambda: generate_background(
                    prompt=bg_prompt,
                    width=1024,
                    height=1024,
                    negative_prompt=negative_prompt,
                )
            )
            bg_url = await loop.run_in_executor(
                None, lambda: upload_file_to_storage(
                    "assets", f"{campaign_id}/background_{label}.png", bg_bytes, "image/png"
                )
            )
        except Exception as e:
            print(f"Warning: Background generation failed ({label}): {e}")

    # 2. Compose HTML + Playwright render (truly async — overlaps with other renders)
    product_image_url = brand_data.get("product_image_url")
    if product_image_url and settings.REMOVEBG_API_KEY:
        try:
            import mimetypes
            content_type = mimetypes.guess_type(str(product_image_url))[0] or "image/png"
            _purl = product_image_url  # capture for lambda
            _ct = content_type
            img_bytes = await loop.run_in_executor(None, lambda: _read_image(_purl))
            stripped = await loop.run_in_executor(None, lambda: strip_bg(img_bytes, _ct))
            nobg_path = temp_dir / f"product_nobg_{label}.png"
            await loop.run_in_executor(None, lambda: nobg_path.write_bytes(stripped))
            product_image_url = str(nobg_path)
            print(f"Remove.bg: product background stripped for {label} ({content_type})")
        except Exception as e:
            import traceback
            print(f"ERROR: Remove.bg failed ({label}): {e}")
            traceback.print_exc()

    assets = {
        "logo_url": brand_data.get("logo_url"),
        "product_image_url": product_image_url,
        "background_url": bg_url,
    }
    html = build_html(blueprint.model_dump(), brand_data, assets)
    out_path = temp_dir / f"poster_{label}.png"
    final_png_path = await render_poster_async(
        html, blueprint.format.width, blueprint.format.height, str(out_path)
    )

    # 3. Upload poster — executor again so upload doesn't block the loop
    with open(final_png_path, "rb") as f:
        final_bytes = f.read()
    poster_url = await loop.run_in_executor(
        None, lambda: upload_file_to_storage(
            "campaigns", f"{campaign_id}/poster_{label}.png", final_bytes, "image/png"
        )
    )

    return poster_url, bg_url, time.time() - start


async def _plan_and_render_format(
    brand_id: str,
    brand_data: dict,
    prompt: str,
    fmt: dict,
    adherence_level: str,
    product_image_available: bool,
    campaign_id: str,
    temp_dir: Path,
) -> dict:
    """
    Plan (Gemini, sync → executor) + render (Playwright, async) one format.
    Designed to be run concurrently via asyncio.gather for all three formats.
    """
    loop = asyncio.get_running_loop()
    blueprint, _ = await loop.run_in_executor(
        None,
        lambda: _plan_blueprint(
            brand_id=brand_id,
            brand_data=brand_data,
            prompt=prompt,
            format_spec=fmt,
            adherence_level=adherence_level,
            product_image_available=product_image_available,
        ),
    )
    poster_url, bg_url, elapsed = await _render_blueprint(
        blueprint, brand_data, campaign_id, temp_dir
    )
    return {
        "blueprint": blueprint,
        "fmt": fmt,
        "poster_url": poster_url,
        "bg_url": bg_url,
        "elapsed": elapsed,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/campaigns/plan", response_model=CampaignPlanResponse)
async def plan_campaign_endpoint(request: CampaignPlanRequest):
    """Plan a campaign, generating a blueprint from a brand profile and prompt."""
    brand_data = get_brand(request.brand_id)
    if not brand_data:
        raise HTTPException(status_code=404, detail=f"Brand {request.brand_id} not found")

    try:
        blueprint, retries = _plan_blueprint(
            brand_id=request.brand_id,
            brand_data=brand_data,
            prompt=request.prompt,
            format_spec=request.format.model_dump(),
            adherence_level=request.adherence_level,
            product_image_available=request.product_image_available,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Campaign planning failed: {e}")

    # The blueprint is returned to the frontend; it is NOT saved here. The
    # finalized blueprint is sent to /campaigns/generate, which persists it.
    return CampaignPlanResponse(blueprint=blueprint, retries_used=retries)


@router.post("/campaigns/generate", response_model=CampaignGenerateResponse)
async def generate_campaign_endpoint(blueprint: Blueprint):
    """
    Execute a finalized blueprint: Flux background, Playwright render,
    upload to local storage, and persist the campaign row.
    """
    brand_data = get_brand(blueprint.brand_id)
    if not brand_data:
        raise HTTPException(status_code=404, detail=f"Brand {blueprint.brand_id} not found")

    campaign_id = str(uuid.uuid4())
    temp_dir = Path(f"/tmp/momentbrand_{campaign_id}")
    temp_dir.mkdir(parents=True, exist_ok=True)

    try:
        poster_url, bg_url, elapsed = await _render_blueprint(
            blueprint, brand_data, campaign_id, temp_dir
        )

        captions = generate_captions(brand_data, blueprint.model_dump())

        ar = blueprint.format.aspect_ratio
        db_payload = {
            "id": campaign_id,
            "brand_id": blueprint.brand_id,
            "campaign_name": blueprint.campaign_name,
            "campaign_strategy": blueprint.campaign_strategy,
            "adherence_level": blueprint.metadata.adherence_level,
            "language": blueprint.metadata.language,
            "blueprint": blueprint.model_dump(mode="json"),
            _POSTER_COLUMN.get(ar, "poster_1x1_url"): poster_url,
            "background_url": bg_url,
            "generation_time_seconds": round(elapsed, 2),
            "model_used": blueprint.metadata.model_used,
            "retry_count": blueprint.metadata.retry_count,
        }
        get_supabase().table("campaigns").insert(db_payload).execute()

        return CampaignGenerateResponse(
            campaign_id=campaign_id,
            poster_url=poster_url,
            background_url=bg_url,
            generation_time_seconds=round(elapsed, 2),
            captions=captions,
        )
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_dir.exists():
            shutil.rmtree(temp_dir)


class GenerateAllRequest(BaseModel):
    brand_id: str
    prompt: str = Field(..., min_length=12, max_length=2000)
    adherence_level: Literal["strict", "moderate", "creative"] = "moderate"
    product_image_available: bool = False


class CampaignContextRequest(BaseModel):
    brief: str = Field(..., min_length=12, max_length=2000)
    objective: Literal["awareness", "traffic", "conversion", "engagement"] = "awareness"
    audience_segment: str | None = Field(default=None, max_length=240)
    product_offer: str | None = Field(default=None, max_length=240)
    tone_override: str | None = Field(default=None, max_length=80)
    language: Literal["English", "Bengali", "Both"] = "English"
    safety_notes: str | None = Field(default=None, max_length=1000)
    platform_intent: str | None = Field(default=None, max_length=120)
    image_context_notes: str | None = Field(default=None, max_length=1000)
    image_context_images: list[dict] = Field(default_factory=list, max_length=3)

    @field_validator(
        "brief",
        "audience_segment",
        "product_offer",
        "tone_override",
        "safety_notes",
        "platform_intent",
        "image_context_notes",
        mode="before",
    )
    @classmethod
    def _strip_text(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("image_context_images")
    @classmethod
    def _validate_image_context_images(cls, value):
        allowed_types = {"image/png", "image/jpeg", "image/webp"}
        cleaned = []
        for item in value or []:
            if not isinstance(item, dict):
                raise ValueError("Each image context item must be an object.")
            url = str(item.get("url") or "").strip()
            filename = str(item.get("filename") or "").strip()
            content_type = str(item.get("content_type") or "").strip()
            size_bytes = item.get("size_bytes")
            role = str(item.get("role") or "reference").strip()
            if not url or not filename or content_type not in allowed_types:
                raise ValueError("Image context items must include url, filename, and a supported content_type.")
            if not isinstance(size_bytes, int) or size_bytes <= 0 or size_bytes > 5 * 1024 * 1024:
                raise ValueError("Image context size_bytes must be between 1 byte and 5 MB.")
            if role not in {"reference", "edit_source"}:
                raise ValueError("Image context role must be reference or edit_source.")
            cleaned.append({
                "url": url,
                "filename": filename,
                "content_type": content_type,
                "size_bytes": size_bytes,
                "role": role,
            })
        return cleaned


class CampaignLayoutRequest(BaseModel):
    formats: list[Literal["1:1", "9:16", "16:9"]] = Field(default_factory=lambda: ["1:1"])
    layout_direction: Literal[
        "product hero",
        "lifestyle moment",
        "text-first announcement",
        "offer card",
        "meme/reactive",
        "cultural moment",
    ] = "cultural moment"
    creative_density: Literal["minimal", "balanced", "high-information"] = "balanced"
    cta_style: str = Field("Join the moment", min_length=2, max_length=80)
    product_usage: Literal["required", "optional", "avoid"] = "optional"
    brand_mark_placement: Literal["top-left", "top-center", "bottom-left", "none"] = "top-left"

    @field_validator("formats")
    @classmethod
    def _validate_formats(cls, value):
        unique = list(dict.fromkeys(value))
        if not unique:
            raise ValueError("Select at least one ad format.")
        return unique

    @field_validator("cta_style", mode="before")
    @classmethod
    def _strip_cta(cls, value):
        return value.strip() if isinstance(value, str) else value


class CampaignConceptRequest(BaseModel):
    concept_direction: Literal["event_led", "product_led", "audience_led", "offer_led"] = "event_led"
    creative_intent: str = Field(..., min_length=12, max_length=1200)
    must_include: str | None = Field(default=None, max_length=600)
    avoid: str | None = Field(default=None, max_length=600)
    variant_count: int = Field(default=5, ge=3, le=5)

    @field_validator("creative_intent", "must_include", "avoid", mode="before")
    @classmethod
    def _strip_concept_text(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class GenerateAdAssetsRequest(BaseModel):
    variant_letters: list[str] | None = Field(default=None, max_length=5)
    force: bool = False
    mode: Literal["auto", "new_visual", "edit_reference"] = "auto"

    @field_validator("variant_letters")
    @classmethod
    def _validate_variant_letters(cls, value):
        if value is None:
            return value
        cleaned: list[str] = []
        for item in value:
            letter = str(item or "").strip().upper()
            if not letter or len(letter) > 2:
                raise ValueError("Variant letters must be short values such as A, B, or C.")
            if letter not in cleaned:
                cleaned.append(letter)
        return cleaned or None


class BrainAnalysisRunRequest(BaseModel):
    variant_letters: list[str] | None = Field(default=None, max_length=5)
    force: bool = False

    @field_validator("variant_letters")
    @classmethod
    def _validate_variant_letters(cls, value):
        if value is None:
            return value
        cleaned: list[str] = []
        for item in value:
            letter = str(item or "").strip().upper()
            if letter and letter not in cleaned:
                cleaned.append(letter)
        return cleaned or None


def _resolve_upload_path(url: str) -> Path | None:
    if not url:
        return None
    public_base = (settings.PUBLIC_BASE_URL or "").rstrip("/")
    if public_base and url.startswith(public_base):
        url = url[len(public_base):]
    if not url.startswith("/uploads/"):
        return None
    rel = url.removeprefix("/uploads/").lstrip("/")
    root = Path(settings.UPLOADS_DIR).expanduser().resolve()
    path = (root / rel).resolve()
    if str(path).startswith(str(root)) and path.exists():
        return path
    return None


async def _read_ad_image(ad_url: str) -> tuple[bytes, str]:
    import mimetypes
    import httpx

    local_path = _resolve_upload_path(ad_url)
    if local_path:
        content_type = mimetypes.guess_type(str(local_path))[0] or "image/png"
        return local_path.read_bytes(), content_type
    if ad_url.startswith("http"):
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(ad_url)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "").split(";")[0] or mimetypes.guess_type(ad_url)[0] or "image/png"
        return response.content, content_type
    raise HTTPException(status_code=400, detail=f"Generated ad image is not readable from local storage: {ad_url}")


async def _run_brain_analysis_for_generated_ads(
    campaign_id: str,
    *,
    variant_letters: list[str] | None = None,
    force: bool = False,
) -> dict:
    from routers.brain import analyze_image_bytes

    campaign = _campaign_full(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    selected = set(variant_letters or [])
    variants = [
        variant for variant in campaign.get("variants", [])
        if variant.get("ad_image_url") and (not selected or variant.get("letter") in selected)
    ]
    if not variants:
        raise HTTPException(status_code=400, detail="No generated ad images are available for scoring.")

    existing_rows = fetch_all(
        """
        SELECT source_filename FROM brain_analyses
        WHERE campaign_id = %s
        """,
        [campaign_id],
    )
    existing_sources = {row.get("source_filename") for row in existing_rows}

    async def analyze_variant(variant: dict) -> dict:
        letter = variant.get("letter") or variant.get("id") or "variant"
        filename = f"variant_{letter}_ad.png"
        if not force and filename in existing_sources:
            return {"letter": letter, "status": "skipped", "reason": "analysis_exists"}
        try:
            image_bytes, content_type = await _read_ad_image(variant.get("ad_image_url"))
            result = await analyze_image_bytes(
                image_bytes,
                filename=filename,
                content_type=content_type,
                campaign_id=campaign_id,
                campaign_name=campaign.get("campaign_name") or campaign.get("title"),
                normalize_scores=True,
                cleanup_all=True,
            )
            return {"letter": letter, "status": "saved", "analysis": result.get("analysis")}
        except HTTPException as exc:
            return {"letter": letter, "status": "failed", "error": exc.detail}
        except Exception as exc:
            return {"letter": letter, "status": "failed", "error": str(exc)[:600]}

    results = await asyncio.gather(*(analyze_variant(variant) for variant in variants))
    saved = len([item for item in results if item.get("status") == "saved"])
    skipped = len([item for item in results if item.get("status") == "skipped"])
    failed = len([item for item in results if item.get("status") == "failed"])
    analyses = fetch_all(
        """
        SELECT * FROM brain_analyses
        WHERE campaign_id = %s
        ORDER BY created_at DESC
        """,
        [campaign_id],
    )
    return {
        "campaign_id": campaign_id,
        "saved_count": saved,
        "skipped_count": skipped,
        "failed_count": failed,
        "results": jsonable_encoder(results),
        "analyses": jsonable_encoder(analyses),
    }


async def _safe_run_brain_analysis_for_generated_ads(campaign_id: str, variant_letters: list[str] | None = None) -> None:
    try:
        await _run_brain_analysis_for_generated_ads(
            campaign_id,
            variant_letters=variant_letters,
            force=False,
        )
    except Exception as exc:
        print(f"Warning: automatic brain analysis failed for campaign {campaign_id}: {exc}")


def _variant_to_frontend(row: dict) -> dict:
    raw = row.get("raw_data") or {}
    return {
        **raw,
        "id": row.get("letter") or row.get("id"),
        "letter": row.get("letter"),
        "angle": row.get("angle"),
        "emotion": row.get("emotion"),
        "headline": row.get("headline"),
        "primary": row.get("primary_text"),
        "cta": row.get("cta"),
        "visual": row.get("visual"),
        "platform": row.get("platform"),
        "audienceSeg": row.get("audience_segment"),
        "placement": row.get("placement"),
        "ip": row.get("ip_status"),
        "risk": row.get("risk"),
        "ipNote": row.get("ip_note"),
        "grad": row.get("gradient"),
    }


def _campaign_full(campaign_id: str) -> dict | None:
    campaign = fetch_one("SELECT * FROM campaigns WHERE id = %s", [campaign_id])
    if not campaign:
        return None
    event = None
    if campaign.get("event_id"):
        event = fetch_one("SELECT * FROM event_opportunities WHERE id = %s", [campaign["event_id"]])
    variants = fetch_all(
        "SELECT * FROM ad_variants WHERE campaign_id = %s ORDER BY letter ASC",
        [campaign_id],
    )
    agent_run = fetch_one(
        """
        SELECT * FROM campaign_agent_runs
        WHERE campaign_id = %s
        ORDER BY created_at DESC
        LIMIT 1
        """,
        [campaign_id],
    )
    return {
        **campaign,
        "event": event,
        "variants": [_variant_to_frontend(v) for v in variants],
        "agent_run": jsonable_encoder(agent_run) if agent_run else None,
        "title": campaign.get("campaign_name"),
    }


def _campaign_generation_profile(campaign: dict) -> dict:
    brand_data = get_brand(campaign.get("brand_id")) if campaign.get("brand_id") else None
    if brand_data:
        return brand_data

    context = campaign.get("context") or {}
    concept = campaign.get("concept") or {}
    return {
        "brand_name": campaign.get("campaign_name") or "Campaign brand",
        "name": campaign.get("campaign_name") or "Campaign brand",
        "tagline": context.get("product_offer") or concept.get("must_include") or context.get("brief"),
        "target_audience": context.get("audience_segment") or "campaign audience",
        "voice": context.get("tone_override") or "clear, useful, brand-safe",
        "do_not_use": [context.get("safety_notes"), concept.get("avoid")],
        "source": "campaign_context",
    }


def _first_asset_format(layout: dict) -> dict:
    formats = layout.get("formats") or ["1:1"]
    selected = formats[0] if formats else "1:1"
    specs = {
        "1:1": {"name": "Square Feed Ad", "width": 1080, "height": 1080, "aspect_ratio": "1:1"},
        "9:16": {"name": "Vertical Story Ad", "width": 1080, "height": 1920, "aspect_ratio": "9:16"},
        "16:9": {"name": "Landscape Feed Ad", "width": 1200, "height": 675, "aspect_ratio": "16:9"},
    }
    return specs.get(selected, specs["1:1"])


def _brand_colors(brand_data: dict) -> dict:
    colors = brand_data.get("colors") if isinstance(brand_data, dict) else {}
    if not isinstance(colors, dict):
        colors = {}
    return {
        "primary": colors.get("primary") or "#E5342A",
        "accent": colors.get("accent") or colors.get("secondary") or "#FFD15C",
        "dark": colors.get("dark") or "#17150F",
        "light": colors.get("light") or "#FFFFFF",
    }


def _clean_prompt_text(value: object, limit: int = 320) -> str:
    text = " ".join(str(value or "").replace("\n", " ").split())
    return text[:limit]


def _visual_prompt_for_variant(campaign: dict, variant: dict, brand_data: dict) -> str:
    context = campaign.get("context") or {}
    layout = campaign.get("layout") or {}
    concept = campaign.get("concept") or {}
    event = campaign.get("event") or {}
    image_refs = context.get("image_context_images") or []
    reference_names = ", ".join(_clean_prompt_text(img.get("filename"), 80) for img in image_refs[:3])
    image_note = _clean_prompt_text(context.get("image_context_notes"), 260)
    event_title = event.get("title") or campaign.get("campaign_name") or "campaign moment"
    brand_name = brand_data.get("brand_name") or brand_data.get("name") or campaign.get("campaign_name") or "the brand"
    audience = context.get("audience_segment") or brand_data.get("target_audience") or "the target audience"
    layout_direction = layout.get("layout_direction") or "cultural moment"
    creative_density = layout.get("creative_density") or "balanced"

    parts = [
        f"Premium paid-social visual background for {brand_name}.",
        f"Campaign moment: {event_title}.",
        f"Concept direction: {concept.get('concept_direction') or 'event-led'}.",
        f"Variant angle: {_clean_prompt_text(variant.get('angle'))}.",
        f"Emotion to evoke: {_clean_prompt_text(variant.get('emotion'))}.",
        f"Visual direction: {_clean_prompt_text(variant.get('visual'), 420)}.",
        f"Audience: {_clean_prompt_text(audience)}.",
        f"Layout: {layout_direction}, {creative_density}; leave clean negative space for human-rendered headline, body copy, CTA, and risk badge.",
        "Use generic cultural and seasonal cues only; do not include official event logos, team marks, celebrity likenesses, or protected characters.",
        "Cinematic commercial photography, polished lighting, realistic materials, strong focal area, modern advertising art direction.",
    ]
    if image_note:
        parts.append(f"Reference image notes for mood/composition only: {image_note}.")
    if reference_names:
        parts.append(f"Uploaded reference filenames exist for context only, not identity copying: {reference_names}.")
    return " ".join(parts)


def _ad_blueprint_for_variant(campaign: dict, variant: dict, brand_data: dict, prompt: str) -> dict:
    layout = campaign.get("layout") or {}
    fmt = _first_asset_format(layout)
    colors = _brand_colors(brand_data)
    direction = layout.get("layout_direction") or "cultural moment"
    brand_name = brand_data.get("brand_name") or brand_data.get("name") or campaign.get("campaign_name") or "MomentBrand"
    risk = variant.get("risk") or "low"
    risk_copy = "Launch review" if risk == "high" else "Brand-safe check" if risk == "medium" else "Ready to test"

    if direction in {"text-first announcement", "offer card"}:
        headline_pos = "center"
        primary_pos = "bottom-center"
        cta_pos = "bottom-center"
        headline_margin = {"left": 96, "right": 96}
        primary_margin = {"bottom": 210, "left": 120, "right": 120}
        cta_margin = {"bottom": 96}
        text_align = "center"
    else:
        headline_pos = "bottom-left"
        primary_pos = "bottom-left"
        cta_pos = "bottom-left"
        headline_margin = {"bottom": 240, "left": 78, "right": 78}
        primary_margin = {"bottom": 158, "left": 82, "right": 96}
        cta_margin = {"bottom": 72, "left": 82}
        text_align = "left"

    width = fmt["width"]
    max_text = min(820, max(560, width - 180))
    headline_size = 76 if fmt["aspect_ratio"] != "16:9" else 58
    body_size = 30 if fmt["aspect_ratio"] != "16:9" else 24

    safe_headline = html.escape(_clean_prompt_text(variant.get("headline"), 120))
    safe_primary = html.escape(_clean_prompt_text(variant.get("primary_text") or variant.get("primary"), 260))
    safe_cta = html.escape(_clean_prompt_text(variant.get("cta") or layout.get("cta_style") or "Learn more", 60))
    safe_brand = html.escape(_clean_prompt_text(brand_name, 80))
    safe_risk = html.escape(risk_copy)

    return {
        "campaign_name": campaign.get("campaign_name") or safe_brand,
        "format": fmt,
        "background": {
            "source": "generated",
            "prompt": prompt,
            "fallback_color": colors["dark"],
        },
        "layers": [
            {
                "source": "rendered",
                "type": "overlay",
                "z_index": 1,
                "style": {
                    "background": (
                        "linear-gradient(180deg, rgba(0,0,0,.18) 0%, rgba(0,0,0,.12) 44%, "
                        "rgba(0,0,0,.78) 100%)"
                    )
                },
            },
            {
                "source": "rendered",
                "type": "text",
                "content": safe_brand,
                "font_family": "Inter",
                "font_size": 24,
                "font_weight": 700,
                "color": colors["light"],
                "position": layout.get("brand_mark_placement") or "top-left",
                "margin": {"top": 52, "left": 64, "right": 64},
                "background_color": "rgba(23,21,15,.68)",
                "padding": {"top": 12, "right": 18, "bottom": 12, "left": 18},
                "border_radius": 10,
                "z_index": 9,
                "optional": layout.get("brand_mark_placement") == "none",
            },
            {
                "source": "rendered",
                "type": "text",
                "content": safe_risk,
                "font_family": "Inter",
                "font_size": 20,
                "font_weight": 700,
                "color": colors["dark"],
                "position": "top-right",
                "margin": {"top": 52, "right": 64},
                "background_color": colors["accent"],
                "padding": {"top": 11, "right": 16, "bottom": 11, "left": 16},
                "border_radius": 10,
                "z_index": 10,
            },
            {
                "source": "rendered",
                "type": "text",
                "content": safe_headline,
                "font_family": "Anton",
                "font_size": headline_size,
                "font_weight": 400,
                "color": colors["light"],
                "position": headline_pos,
                "margin": headline_margin,
                "max_width": max_text,
                "line_height": 1.02,
                "text_align": text_align,
                "z_index": 12,
            },
            {
                "source": "rendered",
                "type": "text",
                "content": safe_primary,
                "font_family": "Inter",
                "font_size": body_size,
                "font_weight": 600,
                "color": colors["light"],
                "position": primary_pos,
                "margin": primary_margin,
                "max_width": max_text,
                "line_height": 1.28,
                "text_align": text_align,
                "z_index": 13,
            },
            {
                "source": "rendered",
                "type": "text",
                "content": safe_cta,
                "font_family": "Inter",
                "font_size": 25,
                "font_weight": 800,
                "color": colors["dark"],
                "position": cta_pos,
                "margin": cta_margin,
                "background_color": colors["accent"],
                "padding": {"top": 17, "right": 28, "bottom": 17, "left": 28},
                "border_radius": 12,
                "z_index": 14,
            },
        ],
    }


async def _generate_ad_asset_for_variant(
    campaign: dict,
    variant_row: dict,
    brand_data: dict,
    temp_dir: Path,
) -> dict:
    letter = variant_row.get("letter")
    raw = dict(variant_row.get("raw_data") or {})
    variant_for_prompt = {**raw, **variant_row}
    fmt = _first_asset_format(campaign.get("layout") or {})
    prompt = _visual_prompt_for_variant(campaign, variant_for_prompt, brand_data)
    model_id = settings.CLOUDFLARE_MODEL_ID.strip() or "@cf/black-forest-labs/flux-2-pro-preview"
    negative_prompt = ", ".join(
        filter(None, [
            "text, letters, words, typography, logos, watermarks",
            *(brand_data.get("do_not_use") or [] if isinstance(brand_data.get("do_not_use"), list) else []),
            (campaign.get("concept") or {}).get("avoid"),
            (campaign.get("context") or {}).get("safety_notes"),
        ])
    )
    loop = asyncio.get_running_loop()
    agent_trace = [
        {"agent": "Concept Reader", "status": "complete"},
        {"agent": "Visual Prompt Agent", "status": "complete"},
    ]

    try:
        bg_bytes = await loop.run_in_executor(
            None,
            lambda: generate_background(
                prompt=prompt,
                width=fmt["width"],
                height=fmt["height"],
                negative_prompt=negative_prompt,
            ),
        )
        agent_trace.append({"agent": "Cloudflare Image Agent", "status": "complete"})
        bg_path = temp_dir / f"{letter}_background.png"
        bg_path.write_bytes(bg_bytes)
        background_url = await loop.run_in_executor(
            None,
            lambda: upload_file_to_storage(
                "campaigns",
                f"{campaign['id']}/ads/{letter}_background.png",
                bg_bytes,
                "image/png",
            ),
        )

        blueprint = _ad_blueprint_for_variant(campaign, variant_for_prompt, brand_data, prompt)
        html_doc = build_html(
            blueprint,
            brand_data,
            {
                "logo_url": brand_data.get("logo_url"),
                "product_image_url": brand_data.get("product_image_url"),
                "background_url": str(bg_path),
            },
        )
        final_path = temp_dir / f"{letter}_ad.png"
        rendered_path = await render_poster_async(
            html_doc,
            fmt["width"],
            fmt["height"],
            str(final_path),
        )
        agent_trace.append({"agent": "Composition Agent", "status": "complete"})
        final_bytes = Path(rendered_path).read_bytes()
        ad_image_url = await loop.run_in_executor(
            None,
            lambda: upload_file_to_storage(
                "campaigns",
                f"{campaign['id']}/ads/{letter}_ad.png",
                final_bytes,
                "image/png",
            ),
        )
        if not ad_image_url:
            raise RuntimeError("Final ad image was not stored.")
        agent_trace.append({"agent": "QA Agent", "status": "complete"})
        raw.update({
            "visual_prompt": prompt,
            "background_image_url": background_url,
            "ad_image_url": ad_image_url,
            "asset_status": "generated",
            "asset_error": None,
            "asset_format": fmt,
            "cloudflare_model": model_id,
            "asset_generated_at": datetime.now(timezone.utc).isoformat(),
            "agent_trace": agent_trace,
        })
    except Exception as exc:
        agent_trace.append({"agent": "QA Agent", "status": "failed", "error": str(exc)[:320]})
        raw.update({
            "visual_prompt": prompt,
            "asset_status": "failed",
            "asset_error": str(exc)[:600],
            "asset_format": fmt,
            "cloudflare_model": model_id,
            "asset_generated_at": datetime.now(timezone.utc).isoformat(),
            "agent_trace": agent_trace,
        })

    rows = execute_returning(
        """
        UPDATE ad_variants
        SET raw_data = %s::jsonb
        WHERE campaign_id = %s AND letter = %s
        RETURNING *
        """,
        [json.dumps(raw), campaign["id"], letter],
    )
    return _variant_to_frontend(rows[0])


@router.patch("/campaigns/{campaign_id}/context")
async def save_campaign_context(campaign_id: str, body: CampaignContextRequest):
    row = fetch_one("SELECT id FROM campaigns WHERE id = %s", [campaign_id])
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")
    payload = body.model_dump()
    rows = execute_returning(
        """
        UPDATE campaigns
        SET context = %s::jsonb,
            concept = '{}'::jsonb,
            status = 'context'
        WHERE id = %s
        RETURNING *
        """,
        [json.dumps(payload), campaign_id],
    )
    execute_returning("DELETE FROM ad_variants WHERE campaign_id = %s RETURNING id", [campaign_id])
    return _campaign_full(rows[0]["id"])


@router.post("/campaigns/{campaign_id}/context-images")
async def upload_campaign_context_image(
    campaign_id: str,
    image: UploadFile = File(...),
    current_count: int = Form(0),
):
    campaign = fetch_one("SELECT id, context FROM campaigns WHERE id = %s", [campaign_id])
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    saved_images = (campaign.get("context") or {}).get("image_context_images") or []
    if len(saved_images) >= 3 or current_count >= 3:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "A campaign can use at most 3 image context references.",
                "code": "image_context_limit",
            },
        )

    allowed_types = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/webp": ".webp",
    }
    content_type = image.content_type or ""
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Upload a PNG, JPG, or WebP image.",
                "code": "unsupported_image_type",
            },
        )

    image_bytes = await image.read()
    max_size = 5 * 1024 * 1024
    if not image_bytes or len(image_bytes) > max_size:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Image context files must be between 1 byte and 5 MB.",
                "code": "image_too_large",
            },
        )

    original_name = Path(image.filename or "reference").name
    storage_name = f"{uuid.uuid4().hex}{allowed_types[content_type]}"
    url = upload_file_to_storage(
        "campaigns",
        f"{campaign_id}/context/{storage_name}",
        image_bytes,
        content_type,
    )
    return {
        "url": url,
        "filename": original_name,
        "content_type": content_type,
        "size_bytes": len(image_bytes),
        "role": "reference",
    }


@router.patch("/campaigns/{campaign_id}/layout")
async def save_campaign_layout(campaign_id: str, body: CampaignLayoutRequest):
    campaign = fetch_one("SELECT id, context FROM campaigns WHERE id = %s", [campaign_id])
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if not campaign.get("context"):
        raise HTTPException(status_code=400, detail="Campaign context must be saved first")
    payload = body.model_dump()
    rows = execute_returning(
        """
        UPDATE campaigns
        SET layout = %s::jsonb,
            concept = '{}'::jsonb,
            status = 'layout'
        WHERE id = %s
        RETURNING *
        """,
        [json.dumps(payload), campaign_id],
    )
    execute_returning("DELETE FROM ad_variants WHERE campaign_id = %s RETURNING id", [campaign_id])
    return _campaign_full(rows[0]["id"])


@router.patch("/campaigns/{campaign_id}/concept")
async def save_campaign_concept(campaign_id: str, body: CampaignConceptRequest):
    campaign = fetch_one("SELECT id, context, layout FROM campaigns WHERE id = %s", [campaign_id])
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if not campaign.get("context"):
        raise HTTPException(status_code=400, detail="Campaign context must be saved first")
    if not campaign.get("layout"):
        raise HTTPException(status_code=400, detail="Campaign layout must be saved first")
    payload = body.model_dump()
    rows = execute_returning(
        """
        UPDATE campaigns
        SET concept = %s::jsonb,
            status = 'concept'
        WHERE id = %s
        RETURNING *
        """,
        [json.dumps(payload), campaign_id],
    )
    execute_returning("DELETE FROM ad_variants WHERE campaign_id = %s RETURNING id", [campaign_id])
    return _campaign_full(rows[0]["id"])


@router.get("/campaigns/{campaign_id}/variants")
async def list_campaign_variants(campaign_id: str):
    campaign = fetch_one("SELECT id FROM campaigns WHERE id = %s", [campaign_id])
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    rows = fetch_all(
        "SELECT * FROM ad_variants WHERE campaign_id = %s ORDER BY letter ASC",
        [campaign_id],
    )
    return [_variant_to_frontend(r) for r in rows]


@router.get("/campaigns/{campaign_id}/brain-analyses")
async def list_campaign_brain_analyses(campaign_id: str):
    campaign = fetch_one("SELECT id FROM campaigns WHERE id = %s", [campaign_id])
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    rows = fetch_all(
        """
        SELECT * FROM brain_analyses
        WHERE campaign_id = %s
        ORDER BY created_at DESC
        """,
        [campaign_id],
    )
    return jsonable_encoder(rows)


@router.post("/campaigns/{campaign_id}/brain-analyses/run")
async def run_campaign_brain_analyses(campaign_id: str, body: BrainAnalysisRunRequest | None = None):
    payload = body or BrainAnalysisRunRequest()
    return await _run_brain_analysis_for_generated_ads(
        campaign_id,
        variant_letters=payload.variant_letters,
        force=payload.force,
    )


@router.post("/campaigns/{campaign_id}/variants")
async def generate_campaign_variants(campaign_id: str):
    try:
        return generate_campaign_variants_only(campaign_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "message": str(exc),
                "code": "variant_generation_failed",
            },
        )


@router.post("/campaigns/{campaign_id}/ads/generate")
async def generate_campaign_ad_assets(
    campaign_id: str,
    background_tasks: BackgroundTasks,
    body: GenerateAdAssetsRequest | None = None,
):
    payload = body or GenerateAdAssetsRequest()
    result = await run_agentic_ad_generation(
        campaign_id,
        GenerateAdsRequest(
            variant_letters=payload.variant_letters,
            force=payload.force,
            mode=payload.mode,
        ),
    )
    generated_letters = [
        ad.get("letter") for ad in result.get("ads", [])
        if ad.get("asset_status") in {"generated", "partial"} and ad.get("ad_image_url") and ad.get("letter")
    ]
    if generated_letters:
        background_tasks.add_task(
            _safe_run_brain_analysis_for_generated_ads,
            campaign_id,
            generated_letters,
        )
    return result


@router.post("/campaigns/generate-all")
async def generate_all_endpoint(request: GenerateAllRequest):
    """
    Plan and render all three canonical formats (1:1, 9:16, 16:9) for a brand
    and persist them as a single campaign row.
    """
    # Demo shortcut: serve cached posters instantly, skip Flux + Playwright entirely
    if settings.DEMO_FALLBACK_MODE:
        cached = _load_cached_posters()
        if cached:
            return cached

    brand_data = get_brand(request.brand_id)
    if not brand_data:
        raise HTTPException(status_code=404, detail=f"Brand {request.brand_id} not found")

    campaign_id = str(uuid.uuid4())
    temp_dir = Path(f"/tmp/momentbrand_all_{campaign_id}")
    temp_dir.mkdir(parents=True, exist_ok=True)

    try:
        # All 3 formats planned + rendered in parallel — wall-clock time = longest single format
        results = await asyncio.gather(*[
            _plan_and_render_format(
                brand_id=request.brand_id,
                brand_data=brand_data,
                prompt=request.prompt,
                fmt=fmt,
                adherence_level=request.adherence_level,
                product_image_available=request.product_image_available,
                campaign_id=campaign_id,
                temp_dir=temp_dir,
            )
            for fmt in _ALL_FORMATS
        ])

        formats_out = []
        poster_urls: dict[str, str] = {}
        first_blueprint: Optional[Blueprint] = None
        first_bg_url: Optional[str] = None
        total_elapsed = max(r["elapsed"] for r in results)  # wall-clock, not sum

        for r in results:
            ar = r["fmt"]["aspect_ratio"]
            poster_urls[ar] = r["poster_url"]
            formats_out.append({
                "name": r["fmt"]["name"],
                "aspect_ratio": ar,
                "poster_url": r["poster_url"],
            })
            if first_blueprint is None:
                first_blueprint = r["blueprint"]
                first_bg_url = r["bg_url"]

        db_payload = {
            "id": campaign_id,
            "brand_id": request.brand_id,
            "campaign_name": first_blueprint.campaign_name,
            "campaign_strategy": first_blueprint.campaign_strategy,
            "adherence_level": first_blueprint.metadata.adherence_level,
            "language": first_blueprint.metadata.language,
            "blueprint": first_blueprint.model_dump(mode="json"),
            "poster_1x1_url": poster_urls.get("1:1"),
            "poster_9x16_url": poster_urls.get("9:16"),
            "poster_16x9_url": poster_urls.get("16:9"),
            "background_url": first_bg_url,
            "generation_time_seconds": round(total_elapsed, 2),
            "model_used": first_blueprint.metadata.model_used,
            "retry_count": first_blueprint.metadata.retry_count,
        }
        if not settings.DEMO_FALLBACK_MODE:
            get_supabase().table("campaigns").insert(db_payload).execute()

        captions = generate_captions(brand_data, first_blueprint.model_dump())

        return {
            "campaign_id": campaign_id,
            "formats": formats_out,
            "captions": captions,
            "total_generation_time_seconds": round(total_elapsed, 2),
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_dir.exists():
            shutil.rmtree(temp_dir)


@router.get("/campaigns/{campaign_id}")
async def get_campaign_endpoint(campaign_id: str):
    """Retrieve a campaign row (including blueprint JSON) by ID."""
    try:
        full = _campaign_full(campaign_id)
    except HTTPException:
        full = None
    if not full:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return full


# ── Video endpoints ───────────────────────────────────────────────────────────

class PlanVideoRequest(BaseModel):
    adherence_level: Literal["strict", "moderate", "creative"] = "moderate"
    aspect_ratio: Literal["1:1", "9:16", "16:9"] = "1:1"


class GenerateVideoRequest(BaseModel):
    video_plan: dict
    aspect_ratio: Literal["1:1", "9:16", "16:9"] = "1:1"


@router.post("/campaigns/{campaign_id}/plan-video")
async def plan_video_endpoint(campaign_id: str, body: PlanVideoRequest):
    """
    Reads the stored campaign blueprint and asks Gemini to choreograph
    GSAP entrance animations for every layer. Returns video_plan.json.
    """
    db = get_supabase()
    row = db.table("campaigns").select("*").eq("id", campaign_id).execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Campaign not found")

    campaign = row.data[0]
    blueprint = campaign.get("blueprint")
    if not blueprint:
        raise HTTPException(status_code=400, detail="Campaign has no stored blueprint")

    brand_id = campaign.get("brand_id")
    brand_data = get_brand(brand_id)
    if not brand_data:
        raise HTTPException(status_code=404, detail=f"Brand {brand_id} not found")

    try:
        loop = asyncio.get_running_loop()
        video_plan: VideoPlan = await loop.run_in_executor(
            None,
            lambda: plan_video(
                brand=_brand_profile(brand_data),
                blueprint=blueprint,
                aspect_ratio=body.aspect_ratio,
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Video planning failed: {e}")

    return {"video_plan": video_plan.model_dump()}


@router.post("/campaigns/{campaign_id}/generate-video", response_model=VideoGenerateResponse)
async def generate_video_endpoint(campaign_id: str, body: GenerateVideoRequest):
    """
    Renders a HyperFrames MP4 video from the given video_plan, uploads it to
    local storage, and saves a row to the videos table.
    """
    db = get_supabase()
    row = db.table("campaigns").select("*").eq("id", campaign_id).execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Campaign not found")

    campaign = row.data[0]
    blueprint = campaign.get("blueprint")
    if not blueprint:
        raise HTTPException(status_code=400, detail="Campaign has no stored blueprint")

    # Pick the blueprint matching the requested aspect ratio, or fall back to stored one
    ar = body.aspect_ratio
    blueprint["format"] = blueprint.get("format", {})

    brand_id = campaign.get("brand_id")
    brand_data = get_brand(brand_id)
    if not brand_data:
        raise HTTPException(status_code=404, detail=f"Brand {brand_id} not found")

    # Reuse the already-generated Flux background — no regeneration needed
    assets = {
        "logo_url": brand_data.get("logo_url"),
        "product_image_url": brand_data.get("product_image_url"),
        "background_url": campaign.get("background_url"),
    }

    try:
        video_url, elapsed = await render_and_upload_video(
            campaign_id=campaign_id,
            blueprint=blueprint,
            brand=brand_data,
            assets=assets,
            video_plan=body.video_plan,
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Video render failed: {e}")

    # Persist to videos table (best-effort — don't fail the response if table missing)
    video_id = str(uuid.uuid4())
    try:
        db.table("videos").insert({
            "id": video_id,
            "campaign_id": campaign_id,
            "video_plan": body.video_plan,
            "video_url": video_url,
            "duration_sec": body.video_plan.get("duration_sec", 6.0),
            "aspect_ratio": ar,
        }).execute()
    except Exception as e:
        print(f"Warning: failed to save video row: {e}")

    return VideoGenerateResponse(
        video_id=video_id,
        video_url=video_url,
        generation_time_seconds=round(elapsed, 2),
    )
