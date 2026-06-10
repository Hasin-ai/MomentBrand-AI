"""
PostgreSQL compatibility facade.

Legacy routers imported this module as a Supabase client. The public function
names remain stable, but records now go to PostgreSQL and files go to local
backend-served storage.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from services.db import execute_returning, fetch_all, fetch_one
from services.storage import upload_file_to_storage

try:
    from psycopg.types.json import Jsonb
except Exception:  # pragma: no cover
    Jsonb = None

_MOCK_DATA_DIR = Path(__file__).parent.parent.parent / "mock-data"
_DEMO_BRAND_ID = "volt-bd-demo-001"

supabase = None


def _jsonify(value: Any) -> Any:
    if isinstance(value, (dict, list)):
        return Jsonb(value) if Jsonb else json.dumps(value)
    return value


def _load_demo_brand() -> dict:
    brand_path = _MOCK_DATA_DIR / "brand_volt_bd.json"
    with open(brand_path, "r", encoding="utf-8") as f:
        brand = json.load(f)
    assets_dir = _MOCK_DATA_DIR / "assets"
    brand["logo_url"] = str(assets_dir / "volt_bd_logo.png")
    brand["product_image_url"] = str(assets_dir / "volt_bd_can.png")
    brand["id"] = _DEMO_BRAND_ID
    return brand


class _Result:
    def __init__(self, data: list[dict]):
        self.data = data


class _TableQuery:
    def __init__(self, table: str):
        self.table = table
        self._op = "select"
        self._payload: dict | list[dict] | None = None
        self._select = "*"
        self._filters: list[tuple[str, Any]] = []
        self._order: tuple[str, bool] | None = None

    def select(self, columns: str = "*"):
        self._op = "select"
        self._select = columns
        return self

    def insert(self, payload: dict | list[dict]):
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload: dict):
        self._op = "update"
        self._payload = payload
        return self

    def delete(self):
        self._op = "delete"
        return self

    def eq(self, column: str, value: Any):
        self._filters.append((column, value))
        return self

    def order(self, column: str, desc: bool = False):
        self._order = (column, desc)
        return self

    def execute(self) -> _Result:
        if self._op == "insert":
            rows = self._payload if isinstance(self._payload, list) else [self._payload]
            inserted: list[dict] = []
            for row in rows:
                if not row:
                    continue
                cols = list(row.keys())
                placeholders = ", ".join(["%s"] * len(cols))
                sql = (
                    f"INSERT INTO {self.table} ({', '.join(cols)}) "
                    f"VALUES ({placeholders}) RETURNING *"
                )
                vals = [_jsonify(row[c]) for c in cols]
                inserted.extend(execute_returning(sql, vals))
            return _Result(inserted)

        where = ""
        params: list[Any] = []
        if self._filters:
            where = " WHERE " + " AND ".join([f"{c} = %s" for c, _ in self._filters])
            params = [v for _, v in self._filters]

        if self._op == "select":
            columns = "*" if self._select.strip() == "*" else self._select
            sql = f"SELECT {columns} FROM {self.table}{where}"
            if self._order:
                col, desc = self._order
                sql += f" ORDER BY {col} {'DESC' if desc else 'ASC'}"
            return _Result(fetch_all(sql, params))

        if self._op == "update":
            payload = self._payload or {}
            cols = list(payload.keys())
            set_clause = ", ".join([f"{c} = %s" for c in cols])
            vals = [_jsonify(payload[c]) for c in cols] + params
            sql = f"UPDATE {self.table} SET {set_clause}{where} RETURNING *"
            return _Result(execute_returning(sql, vals))

        if self._op == "delete":
            sql = f"DELETE FROM {self.table}{where} RETURNING *"
            return _Result(execute_returning(sql, params))

        return _Result([])


class _PostgresClient:
    def table(self, table: str) -> _TableQuery:
        return _TableQuery(table)


def get_supabase() -> _PostgresClient:
    return _PostgresClient()


def save_brand(brand_data: dict) -> dict:
    payload = dict(brand_data)
    payload.setdefault("raw_data", payload.copy())
    cols = list(payload.keys())
    sql = (
        f"INSERT INTO brands ({', '.join(cols)}) VALUES ({', '.join(['%s'] * len(cols))}) "
        "RETURNING *"
    )
    rows = execute_returning(sql, [_jsonify(payload[c]) for c in cols])
    return rows[0] if rows else None


def get_brand(brand_id: str) -> dict | None:
    if brand_id == _DEMO_BRAND_ID:
        return _load_demo_brand()
    return fetch_one("SELECT * FROM brands WHERE id = %s", [brand_id])


def list_brands() -> list[dict]:
    return fetch_all(
        "SELECT id, brand_name, logo_url, colors, created_at FROM brands ORDER BY created_at DESC"
    )


def delete_brand(brand_id: str) -> bool:
    rows = execute_returning("DELETE FROM brands WHERE id = %s RETURNING id", [brand_id])
    return bool(rows)


def rename_brand(brand_id: str, brand_name: str) -> dict | None:
    rows = execute_returning(
        "UPDATE brands SET brand_name = %s WHERE id = %s RETURNING *",
        [brand_name, brand_id],
    )
    return rows[0] if rows else None
