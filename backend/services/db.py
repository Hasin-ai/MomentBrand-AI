"""
PostgreSQL helpers for MomentBrand AI.

The app keeps this module intentionally small: routers use repository helpers
or the lightweight table adapter in services.supabase_client for legacy call
sites that still chain table(...).select(...).eq(...).execute().
"""
from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterable

from fastapi import HTTPException

from config import settings

try:
    import psycopg
    from psycopg.rows import dict_row
    from psycopg_pool import ConnectionPool
except Exception:  # pragma: no cover - lets the app import before deps install
    psycopg = None
    dict_row = None
    ConnectionPool = None


_pool: ConnectionPool | None = None
_schema_applied = False


def _split_sql_statements(sql: str) -> list[str]:
    statements: list[str] = []
    current: list[str] = []
    i = 0
    in_single_quote = False
    dollar_tag: str | None = None

    while i < len(sql):
        if dollar_tag:
            if sql.startswith(dollar_tag, i):
                current.append(dollar_tag)
                i += len(dollar_tag)
                dollar_tag = None
                continue
            current.append(sql[i])
            i += 1
            continue

        if in_single_quote:
            current.append(sql[i])
            if sql[i] == "'" and (i + 1 >= len(sql) or sql[i + 1] != "'"):
                in_single_quote = False
            elif sql[i] == "'" and i + 1 < len(sql) and sql[i + 1] == "'":
                current.append(sql[i + 1])
                i += 1
            i += 1
            continue

        if sql[i] == "'":
            in_single_quote = True
            current.append(sql[i])
            i += 1
            continue

        if sql[i] == "$":
            end = sql.find("$", i + 1)
            if end != -1:
                tag = sql[i : end + 1]
                if tag == "$$" or tag[1:-1].replace("_", "").isalnum():
                    dollar_tag = tag
                    current.append(tag)
                    i = end + 1
                    continue

        if sql[i] == ";":
            statement = "".join(current).strip()
            if statement:
                statements.append(statement)
            current = []
            i += 1
            continue

        current.append(sql[i])
        i += 1

    statement = "".join(current).strip()
    if statement:
        statements.append(statement)
    return statements


def _require_database_url() -> str:
    if not settings.DATABASE_URL:
        raise HTTPException(
            status_code=503,
            detail="DATABASE_URL is not configured. PostgreSQL is required for this route.",
        )
    if ConnectionPool is None:
        raise HTTPException(
            status_code=503,
            detail="psycopg dependencies are not installed. Run pip install -r requirements.txt.",
        )
    return settings.DATABASE_URL


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            conninfo=_require_database_url(),
            min_size=1,
            max_size=5,
            kwargs={"row_factory": dict_row},
            open=False,
        )
        _pool.open()
    return _pool


def apply_schema() -> None:
    """Apply the idempotent PostgreSQL schema for reused local/prod volumes."""
    global _schema_applied
    if _schema_applied:
        return
    schema_path = Path(__file__).resolve().parents[2] / "scripts" / "migrate_postgres.sql"
    if not schema_path.exists():
        raise RuntimeError(f"PostgreSQL schema file not found: {schema_path}")
    sql = schema_path.read_text(encoding="utf-8")
    with get_conn() as conn:
        with conn.cursor() as cur:
            for statement in _split_sql_statements(sql):
                cur.execute(statement)
        conn.commit()
    _schema_applied = True


@contextmanager
def get_conn():
    pool = get_pool()
    with pool.connection() as conn:
        yield conn


def fetch_one(sql: str, params: Iterable[Any] | None = None) -> dict | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, list(params or []))
            return cur.fetchone()


def fetch_all(sql: str, params: Iterable[Any] | None = None) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, list(params or []))
            return list(cur.fetchall())


def execute(sql: str, params: Iterable[Any] | None = None) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, list(params or []))
        conn.commit()


def execute_returning(sql: str, params: Iterable[Any] | None = None) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, list(params or []))
            rows = list(cur.fetchall())
        conn.commit()
        return rows
