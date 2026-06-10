"""
Ad concept generation for the frontend Studio.

This uses deterministic local generation from the saved campaign inputs when
the external AI provider is unavailable. The output shape mirrors Studio cards.
"""
from __future__ import annotations

import hashlib


_ANGLES = [
    ("A", "Moment Hook", "Anticipation", "low", "var(--good)", "linear-gradient(135deg,#E5342A,#B81f1f)"),
    ("B", "Offer Push", "Urgency", "low", "var(--warn)", "linear-gradient(135deg,#B7791F,#E5342A)"),
    ("C", "Community", "Belonging", "low", "var(--good)", "linear-gradient(135deg,#1F7A4D,#0E4D2E)"),
    ("D", "Reactive", "Humour", "medium", "var(--neural)", "linear-gradient(135deg,#6D4AFF,#3B22B8)"),
    ("E", "Bold Claim", "Pride", "high", "var(--risk)", "linear-gradient(135deg,#17150F,#827C6E)"),
]


def _pick_brand_name(brand: dict) -> str:
    return brand.get("brand_name") or brand.get("name") or "Your brand"


def _article_for(text: str) -> str:
    return "an" if text[:1].lower() in {"a", "e", "i", "o", "u"} else "a"


def generate_ad_variants(brand: dict, event: dict, context: dict, layout: dict, concept: dict | None = None) -> list[dict]:
    brand_name = _pick_brand_name(brand)
    event_name = event.get("title") or event.get("name") or "the moment"
    concept = concept or {}
    objective = context.get("objective") or "awareness"
    audience = context.get("audience_segment") or brand.get("target_audience") or "core audience"
    offer = context.get("product_offer") or context.get("offer") or brand.get("tagline") or "a timely reason to act"
    cta = layout.get("cta_style") or "Join the moment"
    layout_direction = layout.get("layout_direction") or "cultural moment"
    platform = context.get("platform_intent") or "Meta feed"
    language = context.get("language") or "English"
    brief = context.get("brief") or f"Create a campaign for {event_name}."
    concept_direction = (concept.get("concept_direction") or "event_led").replace("_", "-")
    creative_intent = concept.get("creative_intent") or "Make the campaign feel timely, useful, and brand-safe."
    must_include = concept.get("must_include") or offer
    avoid = concept.get("avoid") or context.get("safety_notes") or "official marks, unsupported claims, and copied creative"
    variant_count = max(1, min(int(concept.get("variant_count") or 5), len(_ANGLES)))

    seed = hashlib.sha1(f"{brand_name}|{event_name}|{brief}|{layout_direction}|{creative_intent}".encode()).hexdigest()[:8]
    variants = []
    for idx, (letter, angle, emotion, risk, _, grad) in enumerate(_ANGLES[:variant_count]):
        ip_note = None
        if risk == "high":
            ip_note = f"Review use of official names, marks, and endorsement-like language around {event_name}."
        elif risk == "medium":
            ip_note = "Verify any trend references before launch and avoid copying protected creative."

        headline_templates = [
            f"{event_name} starts with {brand_name}.",
            f"Make {event_name} a {brand_name} moment.",
            f"Bring everyone together for {event_name}.",
            f"When the moment hits, {brand_name} is ready.",
            f"{brand_name} for the biggest {event_name} energy.",
        ]
        primary_templates = [
            f"Turn {event_name} attention into {objective}. Follow the approved strategy: {creative_intent} Include {must_include} and keep the tone {context.get('tone_override') or 'on-brand'}.",
            f"A {layout_direction} execution for {audience}. Use {_article_for(concept_direction)} {concept_direction} concept, put the product in the center of the moment, and close with a clear {cta} action.",
            f"Build around shared anticipation: the calendar date, the people watching, and the small ritual where {brand_name} naturally belongs.",
            f"A fast, social-first concept that treats {event_name} as the hook and {brand_name} as the reason to act now.",
            f"High-salience creative for {platform}, avoiding {avoid}, with careful IP-safe wording and a direct offer-led close.",
        ]

        variants.append({
            "id": letter,
            "letter": letter,
            "angle": angle,
            "emotion": emotion,
            "emotionTone": emotion.lower(),
            "headline": headline_templates[idx],
            "primary": primary_templates[idx],
            "cta": cta,
            "visual": f"{layout_direction.title()} layout in {language}; brand palette, event cues, no protected logos, seed {seed}.",
            "platform": platform,
            "audienceSeg": audience,
            "placement": platform,
            "ip": "flag" if risk == "high" else "review" if risk == "medium" else "clear",
            "risk": risk,
            "ipNote": ip_note,
            "grad": grad,
        })
    return variants
