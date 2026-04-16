import { NextRequest, NextResponse } from "next/server";
import { getUserBySessionToken } from "@/lib/auth";
import { query } from "@/lib/db";
import { getFastAPIBaseUrl, fastAPIProxyHeaders } from "@/lib/fastapi-proxy";

// Use Node.js runtime to support pg module
export const runtime = 'nodejs';

const TRENDS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS market_trends (
    id VARCHAR(255) PRIMARY KEY,
    brand_name VARCHAR(255) NOT NULL,
    full_output TEXT,
    conversation_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_market_trends_brand_name ON market_trends(brand_name);
`;

async function ensureTrendsTable(): Promise<void> {
  const statements = TRENDS_TABLE_SQL.split(";").map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    try {
      await query(stmt);
    } catch {
      // ignore (fallback best-effort)
    }
  }
}

function getSessionTokenFromRequest(request: NextRequest): string | null {
  const h = request.headers.get("Authorization");
  if (h?.startsWith("Bearer ")) return h.slice(7).trim();
  return request.cookies.get("auth_token")?.value ?? null;
}

async function requireSessionUser(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);
  if (!token) return null;
  return await getUserBySessionToken(token);
}

/** GET /api/trends/brands — distinct brand names for Filter by Brand dropdown. */
export async function GET(request: NextRequest) {
  try {
    const sessionUser = await requireSessionUser(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const response = await fetch(`${getFastAPIBaseUrl()}/api/trends/brands`, {
        headers: fastAPIProxyHeaders(request, undefined, { includeInternal: true }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Backend FastAPI GET error:", response.status, errorText);
        return NextResponse.json(
          { error: response.status === 401 ? "Unauthorized" : `Backend error: ${errorText}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    } catch (err) {
      // FastAPI backend unavailable → fallback to local Postgres
      await ensureTrendsTable();
      const res = await query(
        "SELECT DISTINCT brand_name FROM market_trends WHERE brand_name IS NOT NULL ORDER BY brand_name"
      );
      return NextResponse.json(
        { brands: res.rows.map((r: any) => r.brand_name).filter(Boolean) },
        { status: 200 }
      );
    }
  } catch (err) {
    console.error("Trends brands GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "FastAPI backend is not available" },
      { status: 500 }
    );
  }
}
