"""
Calendarific-backed event radar and opportunity acceptance.
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import date, datetime
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from config import settings
from services.db import apply_schema, execute_returning, fetch_all, fetch_one

router = APIRouter(tags=["Events"])


def _event_id(country: str, iso_date: str, name: str) -> str:
    slug = hashlib.sha1(f"{country}|{iso_date}|{name}".encode()).hexdigest()[:12]
    return f"cal_{country.lower()}_{iso_date}_{slug}"


def _emoji_for(types: list[str], name: str) -> str:
    text = " ".join(types + [name]).lower()
    if "muslim" in text or "eid" in text:
        return "🌙"
    if "christmas" in text:
        return "🎄"
    if "new year" in text:
        return "✨"
    if "independence" in text or "victory" in text:
        return "🇧🇩"
    if "religious" in text:
        return "🕌"
    return "📅"


def _risk_for(types: list[str], name: str) -> tuple[str, str]:
    text = " ".join(types + [name]).lower()
    if any(x in text for x in ("world cup", "olympic", "fifa", "official")):
        return "high", "Official names and marks may be protected; use safe alternative wording."
    if "religious" in text or "eid" in text or "christmas" in text:
        return "medium", "Use culturally sensitive copy and avoid trivializing the observance."
    return "low", "Generic calendar moment; standard brand-safety review is enough."


def _opportunity_from_event(row: dict) -> dict:
    event_date = row["event_date"]
    if isinstance(event_date, str):
        event_date_obj = date.fromisoformat(event_date)
    else:
        event_date_obj = event_date
    days = (event_date_obj - date.today()).days
    types = row.get("event_type") or []
    if isinstance(types, str):
        types = [types]
    risk, risk_note = _risk_for(types, row["name"])
    relevance = max(62, min(96, 88 - abs(days) if days >= 0 else 64))
    kind = ", ".join(types[:2]) if types else "Calendar event"
    return {
        "id": row["id"],
        "calendarific_event_id": row["id"],
        "title": row["name"],
        "kind": kind,
        "event_date": event_date_obj.isoformat(),
        "window": "Today" if days == 0 else f"Peak in {days} days" if days > 0 else f"{abs(days)} days ago",
        "days": max(days, 0),
        "relevance": relevance,
        "risk": risk,
        "risk_note": risk_note,
        "audience": "Use Brand Brain audience fit once a brand is selected",
        "hist": "Calendar moments often perform best with timely offer and cultural context",
        "trend": "Calendarific verified",
        "emoji": _emoji_for(types, row["name"]),
        "recommended": 0 <= days <= 45,
    }


def _upsert_calendarific_event(country: str, year: int, holiday: dict) -> dict:
    iso_date = holiday.get("date", {}).get("iso", "")[:10]
    if not iso_date:
        raise ValueError("Calendarific holiday missing date.iso")
    name = holiday.get("name") or "Untitled holiday"
    event_id = _event_id(country, iso_date, name)
    event_type = holiday.get("type") or []
    rows = execute_returning(
        """
        INSERT INTO calendarific_events
            (id, country, year, name, description, event_date, event_type, raw_data, synced_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            event_type = EXCLUDED.event_type,
            raw_data = EXCLUDED.raw_data,
            synced_at = NOW()
        RETURNING *
        """,
        [
            event_id,
            country,
            year,
            name,
            holiday.get("description"),
            iso_date,
            __import__("json").dumps(event_type),
            __import__("json").dumps(holiday),
        ],
    )
    return rows[0]


def _upsert_opportunity(opportunity: dict) -> dict:
    rows = execute_returning(
        """
        INSERT INTO event_opportunities
            (id, calendarific_event_id, title, kind, event_date, "window", days, relevance,
             risk, risk_note, audience, hist, trend, emoji, recommended, raw_data)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
        ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            kind = EXCLUDED.kind,
            event_date = EXCLUDED.event_date,
            "window" = EXCLUDED."window",
            days = EXCLUDED.days,
            relevance = EXCLUDED.relevance,
            risk = EXCLUDED.risk,
            risk_note = EXCLUDED.risk_note,
            audience = EXCLUDED.audience,
            hist = EXCLUDED.hist,
            trend = EXCLUDED.trend,
            emoji = EXCLUDED.emoji,
            recommended = EXCLUDED.recommended,
            raw_data = EXCLUDED.raw_data
        RETURNING *
        """,
        [
            opportunity["id"],
            opportunity["calendarific_event_id"],
            opportunity["title"],
            opportunity["kind"],
            opportunity["event_date"],
            opportunity["window"],
            opportunity["days"],
            opportunity["relevance"],
            opportunity["risk"],
            opportunity["risk_note"],
            opportunity["audience"],
            opportunity["hist"],
            opportunity["trend"],
            opportunity["emoji"],
            opportunity["recommended"],
            __import__("json").dumps(opportunity),
        ],
    )
    return rows[0]


@router.get("/events/calendarific")
async def sync_calendarific_events(
    country: str = Query("BD", min_length=2, max_length=2),
    year: int | None = Query(None),
    type: Optional[str] = Query(None),
):
    apply_schema()
    year = year or date.today().year
    if not settings.CALENDARIFIC_API_KEY:
        raise HTTPException(status_code=503, detail="CALENDARIFIC_API_KEY is not configured")

    params = {
        "api_key": settings.CALENDARIFIC_API_KEY,
        "country": country.upper(),
        "year": year,
    }
    if type:
        params["type"] = type

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get("https://calendarific.com/api/v2/holidays", params=params)
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text[:500])
    payload = response.json()
    holidays = payload.get("response", {}).get("holidays", [])

    events = []
    opportunities = []
    for holiday in holidays:
        row = _upsert_calendarific_event(country.upper(), year, holiday)
        events.append(row)
        opportunities.append(_upsert_opportunity(_opportunity_from_event(row)))

    return {"country": country.upper(), "year": year, "events": events, "opportunities": opportunities}


@router.get("/events/opportunities")
async def list_event_opportunities():
    try:
        apply_schema()
        rows = fetch_all(
            """
            SELECT * FROM event_opportunities
            WHERE event_date >= CURRENT_DATE
            ORDER BY recommended DESC, event_date ASC, relevance DESC
            LIMIT 24
            """
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "message": "Event opportunity storage is unavailable.",
                "code": "event_storage_unavailable",
                "error": str(exc),
            },
        ) from exc
    if rows:
        return rows

    if not settings.CALENDARIFIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail={
                "message": "No event opportunities are stored and CALENDARIFIC_API_KEY is not configured.",
                "code": "calendarific_not_configured",
            },
        )

    synced = await sync_calendarific_events(country="BD", year=date.today().year, type=None)
    return synced.get("opportunities") or []


class AcceptEventRequest(BaseModel):
    brand_id: str | None = None


@router.post("/events/{event_id}/accept")
async def accept_event(event_id: str, body: AcceptEventRequest | None = None):
    try:
        apply_schema()
        event = fetch_one("SELECT * FROM event_opportunities WHERE id = %s", [event_id])
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "message": "Event opportunity storage is unavailable.",
                "code": "event_storage_unavailable",
                "error": str(exc),
            },
        ) from exc
    if not event:
        raise HTTPException(
            status_code=404,
            detail={
                "message": "Event opportunity not found. Sync production events before creating a campaign.",
                "code": "event_opportunity_not_found",
            },
        )

    campaign_id = str(uuid.uuid4())
    brand_id = (body.brand_id if body else None) or None
    if brand_id == "volt-bd-demo-001":
        brand_id = None
    campaign_name = f"{event['title']} campaign"
    rows = execute_returning(
        """
        INSERT INTO campaigns (id, brand_id, event_id, campaign_name, campaign_strategy, status)
        VALUES (%s, %s, %s, %s, %s, 'context')
        RETURNING *
        """,
        [
            campaign_id,
            brand_id,
            event["id"],
            campaign_name,
            f"Create timely ads around {event['title']} using saved brand rules and event context.",
        ],
    )
    return {"campaign_id": campaign_id, "campaign": rows[0], "event": event}
