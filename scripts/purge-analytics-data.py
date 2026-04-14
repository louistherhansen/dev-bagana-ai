#!/usr/bin/env python3
"""
Dangerous operation: delete ALL data from core app tables (keep schema).

Tables purged:
- content_plans
- plan_versions
- plan_talents
- sentiment_analyses
- market_trends

Usage:
  python scripts/purge-analytics-data.py --yes

Environment:
  - DATABASE_URL (preferred)
  - or DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
"""

from __future__ import annotations

import os
import sys
from datetime import datetime

import psycopg2
from psycopg2.extras import RealDictCursor


def _load_dotenv_best_effort() -> None:
    try:
        from pathlib import Path
        from dotenv import load_dotenv

        root = Path(__file__).resolve().parent.parent
        load_dotenv(root / ".env", override=False)
        load_dotenv(root / ".env.local", override=True)
    except Exception:
        pass


def _resolve_dsn() -> str:
    explicit = (os.getenv("DATABASE_URL") or "").strip()
    if explicit:
        return explicit
    host = os.getenv("DB_HOST", "127.0.0.1")
    port = os.getenv("DB_PORT", "5432")
    dbname = os.getenv("DB_NAME", "bagana_ai_cp")
    user = os.getenv("DB_USER", "postgres")
    password = os.getenv("DB_PASSWORD", "")
    if not password:
        raise RuntimeError("DB_PASSWORD kosong. Set DATABASE_URL atau DB_* di environment.")
    return f"postgresql://{user}:{password}@{host}:{port}/{dbname}"


def _count_rows(cur, table: str) -> int | None:
    try:
        cur.execute(f"SELECT COUNT(*) AS n FROM {table}")
        row = cur.fetchone()
        return int(row["n"]) if row and "n" in row else None
    except Exception:
        return None


def main(argv: list[str]) -> int:
    if "--yes" not in argv:
        print("Refusing to run without --yes (this deletes ALL rows).", file=sys.stderr)
        print("Run: python scripts/purge-analytics-data.py --yes", file=sys.stderr)
        return 2

    _load_dotenv_best_effort()
    dsn = _resolve_dsn()

    print("=" * 72)
    print("BAGANA AI - PURGE APP DATA (DESTRUCTIVE)")
    print("=" * 72)
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    print("Tables: content_plans, plan_versions, plan_talents, sentiment_analyses, market_trends")
    print()

    conn = None
    try:
        conn = psycopg2.connect(dsn, cursor_factory=RealDictCursor)
        conn.autocommit = False
        with conn.cursor() as cur:
            before_plans = _count_rows(cur, "content_plans")
            before_versions = _count_rows(cur, "plan_versions")
            before_talents = _count_rows(cur, "plan_talents")
            before_sent = _count_rows(cur, "sentiment_analyses")
            before_trends = _count_rows(cur, "market_trends")

            print("Row counts BEFORE:")
            print(f"  content_plans:      {before_plans if before_plans is not None else 'N/A (missing?)'}")
            print(f"  plan_versions:      {before_versions if before_versions is not None else 'N/A (missing?)'}")
            print(f"  plan_talents:       {before_talents if before_talents is not None else 'N/A (missing?)'}")
            print(f"  sentiment_analyses: {before_sent if before_sent is not None else 'N/A (missing?)'}")
            print(f"  market_trends:      {before_trends if before_trends is not None else 'N/A (missing?)'}")
            print()

            purged = []
            # Order matters when CASCADE is not available / constraints differ across installs.
            # TRUNCATE ... CASCADE should handle deps, but keep explicit order for clarity.
            for table in ("plan_versions", "plan_talents", "content_plans", "sentiment_analyses", "market_trends"):
                try:
                    cur.execute(f"TRUNCATE TABLE {table} CASCADE;")
                    purged.append(table)
                except psycopg2.Error as e:
                    conn.rollback()
                    print(f"[WARN] Failed to truncate {table}: {e.pgerror or str(e)}")
                    conn.autocommit = False

            conn.commit()

            after_plans = _count_rows(cur, "content_plans")
            after_versions = _count_rows(cur, "plan_versions")
            after_talents = _count_rows(cur, "plan_talents")
            after_sent = _count_rows(cur, "sentiment_analyses")
            after_trends = _count_rows(cur, "market_trends")

            print()
            print("Purged tables:", ", ".join(purged) if purged else "(none)")
            print("Row counts AFTER:")
            print(f"  content_plans:      {after_plans if after_plans is not None else 'N/A (missing?)'}")
            print(f"  plan_versions:      {after_versions if after_versions is not None else 'N/A (missing?)'}")
            print(f"  plan_talents:       {after_talents if after_talents is not None else 'N/A (missing?)'}")
            print(f"  sentiment_analyses: {after_sent if after_sent is not None else 'N/A (missing?)'}")
            print(f"  market_trends:      {after_trends if after_trends is not None else 'N/A (missing?)'}")
            print()
            print("[OK] Done.")
            return 0
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

