from __future__ import annotations

import asyncio
import html
import json
import shutil
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import HTTPException

from config import settings
from compositor.renderer import render_poster_async
from compositor.template import build_html
from services.db import execute_returning, fetch_all, fetch_one
from services.flux import (
    CloudflareAIError,
    generate_klein_image,
    image_edit_model_id,
    image_model_id,
)
from services.gemini import FALLBACK_MODEL as GEMINI_FALLBACK_MODEL
from services.gemini import PRIMARY_MODEL as GEMINI_PRIMARY_MODEL
from services.gemini import generate_ad_concepts
from services.storage import upload_file_to_storage
from services.supabase_client import get_brand


@dataclass
class GenerateAdsRequest:
    variant_letters: list[str] | None = None
    force: bool = False
    mode: Literal["auto", "new_visual", "edit_reference"] = "auto"


def variant_to_frontend(row: dict) -> dict:
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


def campaign_full(campaign_id: str) -> dict | None:
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
    return {
        **campaign,
        "event": event,
        "variants": [variant_to_frontend(v) for v in variants],
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


def _asset_formats(layout: dict) -> list[dict]:
    specs = {
        "1:1": {"name": "Square Feed Ad", "width": 1080, "height": 1080, "aspect_ratio": "1:1"},
        "9:16": {"name": "Vertical Story Ad", "width": 1080, "height": 1920, "aspect_ratio": "9:16"},
        "16:9": {"name": "Landscape Feed Ad", "width": 1200, "height": 675, "aspect_ratio": "16:9"},
    }
    selected = list(dict.fromkeys(layout.get("formats") or ["1:1"]))
    return [specs[item] for item in selected if item in specs] or [specs["1:1"]]


def _format_label(fmt: dict) -> str:
    return str(fmt.get("aspect_ratio") or "1:1").replace(":", "x")


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


def _clean(value: object, limit: int = 320) -> str:
    text = " ".join(str(value or "").replace("\n", " ").split())
    return text[:limit]


def _error_dict(exc: Exception, model: str = "") -> dict:
    if isinstance(exc, CloudflareAIError):
        return exc.to_dict()
    provider = "gemini" if "gemini" in str(model).lower() else "momentbrand"
    return {
        "message": str(exc)[:600],
        "code": "generation_error",
        "provider": provider,
        "model": model,
        "retryable": False,
    }


def _text_model_label() -> str:
    return f"{GEMINI_PRIMARY_MODEL} (fallback: {GEMINI_FALLBACK_MODEL})"


def _validate_campaign(campaign: dict | None) -> dict:
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if not campaign.get("context"):
        raise HTTPException(status_code=400, detail="Campaign context must be saved first")
    if not campaign.get("layout"):
        raise HTTPException(status_code=400, detail="Campaign layout must be saved first")
    if not (campaign.get("concept") or {}).get("creative_intent"):
        raise HTTPException(status_code=400, detail="Campaign ad concept must be saved first")
    return campaign


def _variants_are_stale(rows: list[dict]) -> bool:
    for row in rows:
        raw = row.get("raw_data") or {}
        model_used = str(raw.get("modelUsed") or "")
        gemini_model = str(raw.get("gemini_text_model") or raw.get("text_model") or "")
        if gemini_model.startswith("gemini-") or model_used.startswith("gemini-"):
            continue
        if raw.get("cloudflare_text_model"):
            return True
        if "contextual-local-generator" in model_used or "gemini" in model_used.lower():
            return True
        if not gemini_model:
            return True
    return False


class AgentRun:
    def __init__(self, campaign: dict):
        self.id = str(uuid.uuid4())
        self.campaign_id = campaign["id"]
        self.steps: list[dict] = []
        self.models = {
            "text": _text_model_label(),
            "image": image_model_id(),
            "image_edit": image_edit_model_id(),
        }
        self.error: dict | None = None
        self.status = "running"
        self.input_snapshot = {
            "campaign_id": campaign["id"],
            "context": campaign.get("context") or {},
            "layout": campaign.get("layout") or {},
            "concept": campaign.get("concept") or {},
            "event": campaign.get("event") or {},
        }
        execute_returning(
            """
            INSERT INTO campaign_agent_runs
                (id, campaign_id, status, steps, models, input_snapshot)
            VALUES (%s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb)
            RETURNING id
            """,
            [
                self.id,
                self.campaign_id,
                self.status,
                json.dumps(self.steps),
                json.dumps(self.models),
                json.dumps(self.input_snapshot, default=str),
            ],
        )

    def step(self, agent: str, status: str, **extra) -> None:
        payload = {
            "agent": agent,
            "status": status,
            "at": datetime.now(timezone.utc).isoformat(),
            **extra,
        }
        self.steps.append(payload)
        execute_returning(
            """
            UPDATE campaign_agent_runs
            SET steps = %s::jsonb
            WHERE id = %s
            RETURNING id
            """,
            [json.dumps(self.steps), self.id],
        )

    def finish(self, status: str, error: dict | None = None) -> dict:
        self.status = status
        self.error = error
        execute_returning(
            """
            UPDATE campaign_agent_runs
            SET status = %s, steps = %s::jsonb, models = %s::jsonb, error = %s::jsonb
            WHERE id = %s
            RETURNING id
            """,
            [
                status,
                json.dumps(self.steps),
                json.dumps(self.models),
                json.dumps(error) if error else None,
                self.id,
            ],
        )
        return {
            "id": self.id,
            "status": status,
            "models": self.models,
            "steps": self.steps,
            "error": error,
        }


class ContextReader:
    def read(self, campaign_id: str) -> dict:
        return _validate_campaign(campaign_full(campaign_id))


class VariantAgent:
    def generate(self, campaign: dict, brand_data: dict) -> tuple[list[dict], str]:
        variant_count = max(3, min(int((campaign.get("concept") or {}).get("variant_count") or 5), 5))
        variants, model_used = generate_ad_concepts(
            brand=brand_data,
            event=campaign.get("event") or {},
            context=campaign.get("context") or {},
            layout=campaign.get("layout") or {},
            concept={**(campaign.get("concept") or {}), "variant_count": variant_count},
        )
        if not isinstance(variants, list) or not variants:
            raise RuntimeError("Gemini did not return ad variants.")
        cleaned = []
        for idx, item in enumerate(variants[:variant_count]):
            letter = str(item.get("letter") or chr(ord("A") + idx)).strip().upper()[:2]
            missing = [key for key in ("angle", "headline", "primary", "visual") if not item.get(key)]
            if missing:
                raise RuntimeError(f"Gemini returned an incomplete variant: {', '.join(missing)}")
            cleaned.append({
                "letter": letter,
                "angle": _clean(item.get("angle"), 120),
                "emotion": _clean(item.get("emotion"), 80) or "Timely confidence",
                "headline": _clean(item.get("headline"), 120),
                "primary": _clean(item.get("primary"), 320),
                "cta": _clean(item.get("cta"), 80) or (campaign.get("layout") or {}).get("cta_style") or "Learn more",
                "visual": _clean(item.get("visual"), 500),
                "platform": _clean(item.get("platform"), 120) or (campaign.get("context") or {}).get("platform_intent") or "Meta feed",
                "audienceSeg": _clean(item.get("audienceSeg"), 180) or (campaign.get("context") or {}).get("audience_segment"),
                "placement": _clean(item.get("placement"), 120) or item.get("platform") or "Meta feed",
                "ip": _clean(item.get("ip"), 40) or "clear",
                "risk": _clean(item.get("risk"), 40) or "low",
                "ipNote": _clean(item.get("ipNote"), 260),
                "grad": _clean(item.get("grad"), 180) or "linear-gradient(135deg,#E5342A,#17150F)",
            })
        return cleaned, model_used

    def persist(self, campaign_id: str, variants: list[dict], model_used: str) -> list[dict]:
        execute_returning("DELETE FROM ad_variants WHERE campaign_id = %s RETURNING id", [campaign_id])
        inserted = []
        for variant in variants:
            rows = execute_returning(
                """
                INSERT INTO ad_variants
                    (id, campaign_id, letter, angle, emotion, headline, primary_text, cta,
                     visual, platform, audience_segment, placement, ip_status, risk, ip_note,
                     gradient, raw_data)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                RETURNING *
                """,
                [
                    f"{campaign_id}_{variant['letter']}",
                    campaign_id,
                    variant["letter"],
                    variant["angle"],
                    variant.get("emotion"),
                    variant["headline"],
                    variant["primary"],
                    variant.get("cta"),
                    variant.get("visual"),
                    variant.get("platform"),
                    variant.get("audienceSeg"),
                    variant.get("placement"),
                    variant.get("ip"),
                    variant.get("risk"),
                    variant.get("ipNote"),
                    variant.get("grad"),
                    json.dumps({
                        **variant,
                        "modelUsed": model_used,
                        "text_model": model_used,
                        "gemini_text_model": model_used,
                        "cloudflare_text_model": None,
                    }),
                ],
            )
            inserted.append(variant_to_frontend(rows[0]))
        execute_returning("UPDATE campaigns SET status = 'variants' WHERE id = %s RETURNING id", [campaign_id])
        return inserted


class VisualPromptAgent:
    def prompt(self, campaign: dict, variant: dict, brand_data: dict) -> str:
        context = campaign.get("context") or {}
        layout = campaign.get("layout") or {}
        concept = campaign.get("concept") or {}
        event = campaign.get("event") or {}
        image_refs = context.get("image_context_images") or []
        reference_names = ", ".join(_clean(img.get("filename"), 80) for img in image_refs[:3])
        image_note = _clean(context.get("image_context_notes"), 260)
        event_title = event.get("title") or campaign.get("campaign_name") or "campaign moment"
        brand_name = brand_data.get("brand_name") or brand_data.get("name") or campaign.get("campaign_name") or "the brand"
        audience = context.get("audience_segment") or brand_data.get("target_audience") or "the target audience"
        layout_direction = layout.get("layout_direction") or "cultural moment"
        creative_density = layout.get("creative_density") or "balanced"

        parts = [
            f"Premium paid-social visual background for {brand_name}.",
            f"Campaign moment: {event_title}.",
            f"Concept direction: {concept.get('concept_direction') or 'event-led'}.",
            f"Variant angle: {_clean(variant.get('angle'))}.",
            f"Emotion to evoke: {_clean(variant.get('emotion'))}.",
            f"Visual direction: {_clean(variant.get('visual'), 420)}.",
            f"Audience: {_clean(audience)}.",
            f"Layout: {layout_direction}, {creative_density}; leave clean negative space for rendered headline, body copy, CTA, and risk badge.",
            "Use generic cultural and seasonal cues only; do not include official event logos, team marks, celebrity likenesses, or protected characters.",
            "Cinematic commercial photography, polished lighting, realistic materials, strong focal area, modern advertising art direction.",
        ]
        if image_note:
            parts.append(f"Reference image notes for mood/composition only: {image_note}.")
        if reference_names:
            parts.append(f"Uploaded reference filenames exist for context only, not identity copying: {reference_names}.")
        return " ".join(parts)


def _resolve_upload_path(url: str) -> str | None:
    if not url:
        return None
    public_base = (settings.PUBLIC_BASE_URL or "").rstrip("/")
    if public_base and url.startswith(public_base):
        url = url[len(public_base):]
    if not url.startswith("/uploads/"):
        return None
    rel = url.removeprefix("/uploads/").lstrip("/")
    path = (Path(settings.UPLOADS_DIR).expanduser().resolve() / rel).resolve()
    root = Path(settings.UPLOADS_DIR).expanduser().resolve()
    if str(path).startswith(str(root)) and path.exists():
        return str(path)
    return None


class CloudflareImageAgent:
    def reference_image_path(self, campaign: dict, mode: str) -> str | None:
        context = campaign.get("context") or {}
        images = context.get("image_context_images") or []
        if mode == "new_visual":
            return None
        edit_sources = [img for img in images if img.get("role") == "edit_source"]
        if mode == "edit_reference" and not edit_sources:
            raise CloudflareAIError(
                "No image context item is marked as an edit source.",
                code="edit_source_missing",
                model=image_edit_model_id(),
            )
        selected = (edit_sources or [None])[0]
        return _resolve_upload_path((selected or {}).get("url") or "")

    async def generate(self, prompt: str, fmt: dict, reference_path: str | None) -> tuple[bytes, str]:
        loop = asyncio.get_running_loop()
        model = image_edit_model_id() if reference_path else image_model_id()
        image_bytes = await loop.run_in_executor(
            None,
            lambda: generate_klein_image(
                prompt,
                width=fmt["width"],
                height=fmt["height"],
                image_path=reference_path,
                edit=bool(reference_path),
            ),
        )
        return image_bytes, model


class CompositionAgent:
    def blueprint(self, campaign: dict, variant: dict, brand_data: dict, prompt: str, fmt: dict) -> dict:
        layout = campaign.get("layout") or {}
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

        return {
            "campaign_name": campaign.get("campaign_name") or brand_name,
            "format": fmt,
            "background": {"source": "generated", "prompt": prompt, "fallback_color": colors["dark"]},
            "layers": [
                {
                    "source": "rendered",
                    "type": "overlay",
                    "z_index": 1,
                    "style": {"background": "linear-gradient(180deg, rgba(0,0,0,.18) 0%, rgba(0,0,0,.12) 44%, rgba(0,0,0,.78) 100%)"},
                },
                {
                    "source": "rendered",
                    "type": "text",
                    "content": html.escape(_clean(brand_name, 80)),
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
                    "content": html.escape(risk_copy),
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
                    "content": html.escape(_clean(variant.get("headline"), 120)),
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
                    "content": html.escape(_clean(variant.get("primary_text") or variant.get("primary"), 260)),
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
                    "content": html.escape(_clean(variant.get("cta") or layout.get("cta_style") or "Learn more", 60)),
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

    async def compose(self, campaign: dict, variant: dict, brand_data: dict, prompt: str, fmt: dict, bg_path: Path, temp_dir: Path) -> tuple[bytes, dict]:
        blueprint = self.blueprint(campaign, variant, brand_data, prompt, fmt)
        fmt = blueprint["format"]
        html_doc = build_html(
            blueprint,
            brand_data,
            {
                "logo_url": brand_data.get("logo_url"),
                "product_image_url": brand_data.get("product_image_url"),
                "background_url": str(bg_path),
            },
        )
        final_path = temp_dir / f"{variant.get('letter')}_{_format_label(fmt)}_ad.png"
        rendered_path = await render_poster_async(html_doc, fmt["width"], fmt["height"], str(final_path))
        return Path(rendered_path).read_bytes(), fmt


class QAAgent:
    def assert_final(self, ad_image_url: str) -> None:
        if not ad_image_url:
            raise RuntimeError("Final ad image was not stored.")


async def _generate_asset_for_variant(
    campaign: dict,
    row: dict,
    brand_data: dict,
    temp_dir: Path,
    run: AgentRun,
    mode: str,
) -> dict:
    letter = row.get("letter")
    raw = dict(row.get("raw_data") or {})
    raw.pop("cloudflare_model", None)
    variant = {**raw, **row}
    visual_agent = VisualPromptAgent()
    image_agent = CloudflareImageAgent()
    composition_agent = CompositionAgent()
    qa_agent = QAAgent()
    formats = _asset_formats(campaign.get("layout") or {})
    primary_format = formats[0]
    agent_trace = [
        {"agent": "Context Reader", "status": "complete"},
        {"agent": "Visual Prompt Agent", "status": "complete"},
    ]
    prompt = visual_agent.prompt(campaign, variant, brand_data)
    image_model = image_model_id()

    async def generate_format(fmt: dict, reference_path: str | None) -> tuple[str, dict]:
        label = _format_label(fmt)
        fmt_prompt = f"{prompt} Compose for {fmt['aspect_ratio']} paid social format. no text no letters no words no writing"
        fmt_trace = {
            "format": fmt["aspect_ratio"],
            "status": "running",
            "model": image_model,
            "mode": "edit_reference" if reference_path else "new_visual",
        }
        try:
            bg_bytes, fmt_model = await image_agent.generate(fmt_prompt, fmt, reference_path)
            bg_path = temp_dir / f"{letter}_{label}_background.png"
            bg_path.write_bytes(bg_bytes)
            background_url = upload_file_to_storage(
                "campaigns",
                f"{campaign['id']}/ads/{letter}_{label}_background.png",
                bg_bytes,
                "image/png",
            )
            final_bytes, asset_format = await composition_agent.compose(
                campaign,
                variant,
                brand_data,
                fmt_prompt,
                fmt,
                bg_path,
                temp_dir,
            )
            ad_image_url = upload_file_to_storage(
                "campaigns",
                f"{campaign['id']}/ads/{letter}_{label}_ad.png",
                final_bytes,
                "image/png",
            )
            qa_agent.assert_final(ad_image_url)
            return fmt["aspect_ratio"], {
                **fmt_trace,
                "status": "generated",
                "model": fmt_model,
                "background_image_url": background_url,
                "ad_image_url": ad_image_url,
                "asset_format": asset_format,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as exc:
            error = _error_dict(exc, fmt_trace["model"])
            run.step("Variant Asset", "failed", variant=letter, format=fmt["aspect_ratio"], error=error)
            return fmt["aspect_ratio"], {
                **fmt_trace,
                "status": "failed",
                "error": error,
                "asset_format": fmt,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }

    try:
        reference_path = image_agent.reference_image_path(campaign, mode)
        results = await asyncio.gather(*(generate_format(fmt, reference_path) for fmt in formats))
        format_assets = {aspect_ratio: payload for aspect_ratio, payload in results}
        generated_assets = [payload for _, payload in results if payload.get("status") == "generated"]
        failed_assets = [payload for _, payload in results if payload.get("status") == "failed"]
        if not generated_assets:
            first_error = failed_assets[0].get("error") if failed_assets else {"message": "No format assets were generated."}
            raise RuntimeError(first_error.get("message") if isinstance(first_error, dict) else str(first_error))
        primary_asset = format_assets.get(primary_format["aspect_ratio"])
        if not primary_asset or primary_asset.get("status") != "generated":
            primary_asset = generated_assets[0]
        agent_trace.append({
            "agent": "Cloudflare Image Agent",
            "status": "complete" if not failed_assets else "partial",
            "model": primary_asset.get("model", image_model),
            "formats": list(format_assets.keys()),
        })
        agent_trace.append({"agent": "Composition Agent", "status": "complete" if not failed_assets else "partial"})
        agent_trace.append({"agent": "QA Agent", "status": "complete" if not failed_assets else "partial"})
        raw.update({
            "visual_prompt": prompt,
            "background_image_url": primary_asset.get("background_image_url"),
            "ad_image_url": primary_asset.get("ad_image_url"),
            "asset_status": "generated" if not failed_assets else "partial",
            "asset_error": None if not failed_assets else {"message": f"{len(failed_assets)} selected format(s) failed.", "formats": failed_assets},
            "asset_format": primary_asset.get("asset_format"),
            "format_assets": format_assets,
            "text_model": raw.get("text_model") or raw.get("gemini_text_model"),
            "gemini_text_model": raw.get("gemini_text_model"),
            "cloudflare_text_model": raw.get("cloudflare_text_model"),
            "cloudflare_image_model": primary_asset.get("model", image_model),
            "asset_generated_at": datetime.now(timezone.utc).isoformat(),
            "agent_trace": agent_trace,
        })
    except Exception as exc:
        error = _error_dict(exc, image_model)
        agent_trace.append({"agent": "QA Agent", "status": "failed", "error": error})
        raw.update({
            "visual_prompt": prompt,
            "asset_status": "failed",
            "asset_error": error,
            "asset_format": primary_format,
            "text_model": raw.get("text_model") or raw.get("gemini_text_model"),
            "gemini_text_model": raw.get("gemini_text_model"),
            "cloudflare_text_model": raw.get("cloudflare_text_model"),
            "cloudflare_image_model": image_model,
            "asset_generated_at": datetime.now(timezone.utc).isoformat(),
            "agent_trace": agent_trace,
        })
        run.step("Variant Asset", "failed", variant=letter, error=error)

    rows = execute_returning(
        """
        UPDATE ad_variants
        SET raw_data = %s::jsonb
        WHERE campaign_id = %s AND letter = %s
        RETURNING *
        """,
        [json.dumps(raw), campaign["id"], letter],
    )
    return variant_to_frontend(rows[0])


def generate_campaign_variants_only(campaign_id: str) -> dict:
    campaign = _validate_campaign(campaign_full(campaign_id))
    brand_data = _campaign_generation_profile(campaign)
    variants, model_used = VariantAgent().generate(campaign, brand_data)
    return {
        "campaign_id": campaign_id,
        "variants": VariantAgent().persist(campaign_id, variants, model_used),
    }


async def generate_campaign_ads(campaign_id: str, request: GenerateAdsRequest) -> dict:
    campaign = _validate_campaign(campaign_full(campaign_id))
    run = AgentRun(campaign)
    run.step("Context Reader", "complete")
    brand_data = _campaign_generation_profile(campaign)
    variant_agent = VariantAgent()

    selected_letters = set(request.variant_letters or [])
    rows = fetch_all("SELECT * FROM ad_variants WHERE campaign_id = %s ORDER BY letter ASC", [campaign_id])
    rows_stale = _variants_are_stale(rows)
    try:
        if request.force or not rows or rows_stale:
            run.step("Variant Agent", "running", model=_text_model_label())
            variants, model_used = variant_agent.generate(campaign, brand_data)
            persisted = variant_agent.persist(campaign_id, variants, model_used)
            rows = fetch_all("SELECT * FROM ad_variants WHERE campaign_id = %s ORDER BY letter ASC", [campaign_id])
            run.step("Variant Agent", "complete", generated_count=len(persisted), model=model_used)
        else:
            run.step("Variant Agent", "skipped", reason="existing_variants")
    except Exception as exc:
        error = _error_dict(exc, _text_model_label())
        run.step("Variant Agent", "failed", error=error)
        agent_run = run.finish("failed", error)
        return {
            "campaign_id": campaign_id,
            "ads": [],
            "agent_run": {
                **agent_run,
                "generated_count": 0,
                "failed_count": 0,
                "next_action": error["message"],
            },
        }

    if selected_letters:
        rows = [row for row in rows if row.get("letter") in selected_letters]
    if not rows:
        error = {"message": "No matching variants were available for generation.", "code": "variants_missing", "provider": "momentbrand", "model": "", "retryable": False}
        agent_run = run.finish("failed", error)
        return {"campaign_id": campaign_id, "ads": [], "agent_run": {**agent_run, "generated_count": 0, "failed_count": 0, "next_action": error["message"]}}

    temp_dir = Path(f"/tmp/momentbrand_ads_{campaign_id}_{uuid.uuid4().hex[:8]}")
    temp_dir.mkdir(parents=True, exist_ok=True)
    updated: list[dict] = []
    try:
        run.step("Visual Prompt Agent", "running")
        run.step("Cloudflare Image Agent", "running", model=image_model_id(), edit_model=image_edit_model_id())
        for row in rows:
            updated.append(await _generate_asset_for_variant(campaign, row, brand_data, temp_dir, run, request.mode))
    finally:
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)

    generated_count = len([ad for ad in updated if ad.get("asset_status") in {"generated", "partial"}])
    failed_count = len([ad for ad in updated if ad.get("asset_status") == "failed"])
    partial_count = len([ad for ad in updated if ad.get("asset_status") == "partial"])
    status = "completed" if generated_count and not failed_count and not partial_count else "partial" if generated_count else "failed"
    run.step("QA Agent", "complete" if generated_count else "failed", generated_count=generated_count, failed_count=failed_count, partial_count=partial_count)
    execute_returning(
        "UPDATE campaigns SET status = %s WHERE id = %s RETURNING id",
        ["assets" if generated_count else "asset_failed", campaign_id],
    )
    error = None if generated_count else (updated[0].get("asset_error") if updated else None)
    agent_run = run.finish(status, error)
    return {
        "campaign_id": campaign_id,
        "ads": updated,
        "agent_run": {
            **agent_run,
            "generated_count": generated_count,
            "failed_count": failed_count,
            "next_action": "Open Compare for generated ads." if generated_count else "Fix the provider/setup error and retry generation.",
        },
    }
