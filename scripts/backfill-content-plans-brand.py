#!/usr/bin/env python3
"""
Backfill content_plans.brand_name from plan_versions.content (JSONB).

Why:
Existing rows may have brand_name NULL because the chat conversationId wasn't available
when the plan was saved. We can recover brand from the plan output stored in plan_versions.

Sources (in order):
1) New schema: content.plan.brandName
2) New schema fallback: content.plan.rawMarkdown -> regex "Brand Name:"
3) Legacy: content.raw -> regex "Brand Name:"

Usage:
  python scripts/backfill-content-plans-brand.py --yes
"""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime

import psycopg2
from psycopg2.extras import RealDictCursor


BRAND_RE = re.compile(r"Brand\s+Name\s*:\s*([^\n\r]+)", re.IGNORECASE)


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


def _extract_brand_from_text(text: str | None) -> str | None:
    if not text or not isinstance(text, str):
        return None
    m = BRAND_RE.search(text)
    if not m:
        return None
    raw = (m.group(1) or "").strip()
    if not raw:
        return None
    # Trim after comma/dash variants
    return raw.split(",")[0].split("—")[0].split("–")[0].split("-")[0].strip() or None


def _extract_brand_from_content(content: dict) -> str | None:
    # New schema
    plan = content.get("plan") if isinstance(content, dict) else None
    if isinstance(plan, dict):
        b = plan.get("brandName")
        if isinstance(b, str) and b.strip():
            return b.strip()
        b2 = _extract_brand_from_text(plan.get("rawMarkdown"))
        if b2:
            return b2
    # Legacy schema
    b3 = _extract_brand_from_text(content.get("raw") if isinstance(content, dict) else None)
    if b3:
        return b3
    return None


def main(argv: list[str]) -> int:
    if "--yes" not in argv:
        print("Refusing to run without --yes (this updates DB rows).", file=sys.stderr)
        print("Run: python scripts/backfill-content-plans-brand.py --yes", file=sys.stderr)
        return 2

    _load_dotenv_best_effort()
    dsn = _resolve_dsn()

    print("=" * 72)
    print("BAGANA AI - BACKFILL content_plans.brand_name")
    print("=" * 72)
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    conn = None
    updated = 0
    skipped = 0
    try:
        conn = psycopg2.connect(dsn, cursor_factory=RealDictCursor)
        conn.autocommit = False
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT ON (pv.plan_id)
                  pv.plan_id,
                  pv.content::text AS content_json
                FROM plan_versions pv
                JOIN content_plans cp ON cp.id = pv.plan_id
                WHERE (cp.brand_name IS NULL OR cp.brand_name = '')
                ORDER BY pv.plan_id, pv.created_at DESC
                """
            )
            rows = cur.fetchall() or []
            print(f"Candidates (brand_name empty): {len(rows)}")

            for r in rows:
                plan_id = r["plan_id"]
                try:
                    content = json.loads(r["content_json"] or "{}")
                except Exception:
                    content = {}
                brand = _extract_brand_from_content(content) if isinstance(content, dict) else None
                if not brand:
                    skipped += 1
                    continue
                cur.execute(
                    "UPDATE content_plans SET brand_name = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (brand, plan_id),
                )
                if cur.rowcount:
                    updated += 1
            conn.commit()

        print()
        print(f"[OK] Updated: {updated}")
        print(f"[OK] Skipped (brand not found): {skipped}")
        return 0
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[FAIL] {e}", file=sys.stderr)
        return 1
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

