"""
MomentBrand AI — Flux Background Generation Service
Calls Cloudflare Workers AI to generate campaign backgrounds.
"""
import base64
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests
from config import settings

_ACCOUNT_ID_CACHE: str | None = None


@dataclass
class CloudflareAIError(Exception):
    message: str
    code: str = "cloudflare_error"
    model: str = ""
    provider: str = "cloudflare"
    retryable: bool = False

    def __str__(self) -> str:
        return self.message

    def to_dict(self) -> dict:
        return {
            "message": self.message,
            "code": self.code,
            "provider": self.provider,
            "model": self.model,
            "retryable": self.retryable,
        }


def _cloudflare_headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.CLOUDFLARE_API_TOKEN}",
        "Content-Type": "application/json",
    }


def _auth_headers() -> dict:
    return {"Authorization": f"Bearer {settings.CLOUDFLARE_API_TOKEN}"}


def _model_id(value: str, fallback: str) -> str:
    model_id = (value or "").strip() or fallback
    return model_id if model_id.startswith("@cf/") else f"@cf/{model_id}"


def image_model_id() -> str:
    return _model_id(
        settings.CLOUDFLARE_IMAGE_MODEL_ID or settings.CLOUDFLARE_MODEL_ID,
        "@cf/black-forest-labs/flux-2-klein-9b",
    )


def image_edit_model_id() -> str:
    return _model_id(settings.CLOUDFLARE_IMAGE_EDIT_MODEL_ID, "@cf/black-forest-labs/flux-2-klein-9b")


def text_model_id() -> str:
    return _model_id(settings.CLOUDFLARE_TEXT_MODEL_ID, "@cf/moonshotai/kimi-k2.6")


def _endpoint(model_id: str) -> str:
    account_id = get_cloudflare_account_id()
    return f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model_id}"


def get_cloudflare_account_id() -> str:
    """
    Resolve the Cloudflare account id from env or from the configured API token.
    This keeps production setup simple while still using Cloudflare's account-scoped
    Workers AI endpoint.
    """
    global _ACCOUNT_ID_CACHE
    configured = (settings.CLOUDFLARE_ACCOUNT_ID or "").strip()
    if configured:
        return configured
    if _ACCOUNT_ID_CACHE:
        return _ACCOUNT_ID_CACHE
    if not settings.CLOUDFLARE_API_TOKEN:
        raise CloudflareAIError(
            "Cloudflare API token missing. Configure CLOUDFLARE_API_TOKEN in .env",
            code="cloudflare_token_missing",
        )

    response = requests.get(
        "https://api.cloudflare.com/client/v4/accounts",
        headers=_cloudflare_headers(),
        timeout=20,
    )
    if response.status_code != 200:
        raise CloudflareAIError(
            "Cloudflare account auto-discovery failed. The token must be able to list "
            f"its account for Workers AI. Cloudflare returned {response.status_code}: {response.text[:300]}",
            code="cloudflare_account_discovery_failed",
            retryable=response.status_code >= 500,
        )

    result = response.json().get("result") or []
    accounts = [item for item in result if item.get("id")]
    if not accounts:
        raise CloudflareAIError(
            "Cloudflare account auto-discovery failed. No account was visible to this API token.",
            code="cloudflare_account_not_visible",
        )
    if len(accounts) > 1:
        print("Cloudflare: multiple accounts visible to the token; using the first account returned by the API.")
    _ACCOUNT_ID_CACHE = accounts[0]["id"]
    return _ACCOUNT_ID_CACHE


def _decode_image_result(response: requests.Response, model: str) -> bytes:
    content_type = response.headers.get("content-type", "")
    if content_type.startswith("image/"):
        return response.content

    try:
        result = response.json()
    except Exception as exc:
        raise CloudflareAIError(
            f"Cloudflare returned a non-image response that could not be parsed: {response.text[:300]}",
            code="cloudflare_bad_image_response",
            model=model,
        ) from exc

    image_value = None
    if isinstance(result.get("result"), dict):
        image_value = (
            result["result"].get("image")
            or result["result"].get("b64_json")
            or result["result"].get("base64")
        )
    elif isinstance(result.get("result"), str):
        image_value = result["result"]
    elif result.get("image"):
        image_value = result.get("image")

    if image_value:
        if isinstance(image_value, str) and image_value.startswith("data:image"):
            image_value = image_value.split(",", 1)[1]
        return base64.b64decode(image_value)

    raise CloudflareAIError(
        f"Unexpected response format from Cloudflare AI: {str(result)[:300]}",
        code="cloudflare_bad_image_response",
        model=model,
    )


def _raise_for_cloudflare(response: requests.Response, model: str) -> None:
    if response.status_code == 200:
        return
    retryable = response.status_code in {408, 409, 425, 429} or response.status_code >= 500
    code = "cloudflare_rate_limited" if response.status_code == 429 else "cloudflare_request_failed"
    raise CloudflareAIError(
        f"Cloudflare AI Error ({response.status_code}): {response.text[:500]}",
        code=code,
        model=model,
        retryable=retryable,
    )


def run_text_json(messages: list[dict], *, schema_hint: str = "") -> dict:
    if not settings.CLOUDFLARE_API_TOKEN:
        raise CloudflareAIError(
            "Cloudflare API token missing. Configure CLOUDFLARE_API_TOKEN in .env",
            code="cloudflare_token_missing",
        )

    model = text_model_id()
    payload = {
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 2500,
    }
    if schema_hint:
        payload["response_format"] = {"type": "json_object"}

    response = requests.post(_endpoint(model), headers=_cloudflare_headers(), json=payload, timeout=90)
    _raise_for_cloudflare(response, model)
    data = response.json()
    content = None
    if isinstance(data.get("result"), dict):
        content = (
            data["result"].get("response")
            or data["result"].get("text")
            or data["result"].get("content")
        )
        choices = data["result"].get("choices")
        if not content and choices:
            content = choices[0].get("message", {}).get("content") or choices[0].get("text")
    elif isinstance(data.get("result"), str):
        content = data["result"]
    if data.get("choices"):
        content = data["choices"][0].get("message", {}).get("content") or data["choices"][0].get("text")

    if isinstance(content, dict):
        return content
    if not content:
        raise CloudflareAIError(
            f"Cloudflare text model returned no parseable content: {str(data)[:300]}",
            code="cloudflare_bad_text_response",
            model=model,
        )
    try:
        return json.loads(str(content).strip().removeprefix("```json").removesuffix("```").strip())
    except Exception as exc:
        raise CloudflareAIError(
            f"Cloudflare text model returned invalid JSON: {str(content)[:300]}",
            code="cloudflare_bad_json",
            model=model,
        ) from exc


def generate_klein_image(
    prompt: str,
    width: int = 1024,
    height: int = 1024,
    *,
    image_path: str | None = None,
    edit: bool = False,
    steps: int = 25,
) -> bytes:
    if not settings.CLOUDFLARE_API_TOKEN:
        raise CloudflareAIError(
            "Cloudflare API token missing. Configure CLOUDFLARE_API_TOKEN in .env",
            code="cloudflare_token_missing",
        )

    model = image_edit_model_id() if edit or image_path else image_model_id()
    flux_w, flux_h = _flux_dimensions(width, height)
    files: dict[str, Any] = {
        "prompt": (None, prompt),
        "width": (None, str(flux_w)),
        "height": (None, str(flux_h)),
        "steps": (None, str(steps)),
    }
    try:
        if image_path:
            path = Path(image_path)
            files = {"image": (path.name, path.read_bytes())}
            files.update({
                "prompt": (None, prompt),
                "width": (None, str(flux_w)),
                "height": (None, str(flux_h)),
                "steps": (None, str(steps)),
            })
        response = requests.post(
            _endpoint(model),
            headers=_auth_headers(),
            files=files,
            timeout=120,
        )
        _raise_for_cloudflare(response, model)
        return _decode_image_result(response, model)
    finally:
        if files:
            files.clear()


# Flux image models on Cloudflare support resolutions up to 1024 on each axis.
# We pick the closest valid resolution that matches the poster's aspect ratio
# so the generated background fills the frame without heavy cropping.
def _flux_dimensions(poster_width: int, poster_height: int) -> tuple[int, int]:
    """
    Map poster dimensions to the nearest Flux-compatible resolution that
    preserves the aspect ratio (max 1024 on each side).
    """
    ratio = poster_width / poster_height
    if ratio > 1.5:
        return (1024, 576)   # 16:9 landscape
    if ratio < 0.7:
        return (576, 1024)   # 9:16 portrait
    return (1024, 1024)      # square / near-square


def generate_background(
    prompt: str,
    width: int = 1024,
    height: int = 1024,
    negative_prompt: str | None = None,
) -> bytes:
    """
    Generates a background image using the configured Cloudflare Workers AI model.
    Automatically selects an aspect-ratio-correct resolution from poster dimensions.
    Returns the image as bytes.
    """
    if not settings.CLOUDFLARE_API_TOKEN:
        raise ValueError(
            "Cloudflare API token missing. Please configure CLOUDFLARE_API_TOKEN in .env"
        )

    # Cloudflare's Flux endpoint accepts a prompt payload. Keep the negative
    # constraints inside the prompt so all configured image models receive them.
    negative = (
        negative_prompt
        or "text, letters, words, typography, logos, watermarks, official marks, distorted hands"
    )
    enhanced_prompt = (
        f"{prompt}. "
        "Create a polished text-free advertising background only. "
        "Do not include readable text, letters, words, brand logos, watermarks, or official event marks. "
        f"Avoid: {negative}."
    )

    print(f"Calling Cloudflare Workers AI: {image_model_id()} for background generation...")
    return generate_klein_image(enhanced_prompt, width=width, height=height)
