import { NextRequest, NextResponse } from "next/server";
import { getUserBySessionToken } from "@/lib/auth";
import { query } from "@/lib/db";
import { getFastAPIBaseUrl, fastAPIProxyHeaders } from "@/lib/fastapi-proxy";

export const runtime = 'nodejs';

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

const SENTIMENT_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS sentiment_analyses (
    id VARCHAR(255) PRIMARY KEY,
    brand_name VARCHAR(255) NOT NULL,
    positive_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    negative_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    neutral_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    full_output TEXT,
    conversation_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_sentiment_analyses_brand_name ON sentiment_analyses(brand_name);
`;

async function ensureSentimentTable(): Promise<void> {
  const statements = SENTIMENT_TABLE_SQL.split(";").map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    try {
      await query(stmt);
    } catch {
      // ignore (fallback best-effort)
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await requireSessionUser(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const response = await fetch(`${getFastAPIBaseUrl()}/api/sentiment/brands`, {
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
      await ensureSentimentTable();
      const res = await query(
        "SELECT DISTINCT brand_name FROM sentiment_analyses WHERE brand_name IS NOT NULL ORDER BY brand_name"
      );
      return NextResponse.json(
        { brands: res.rows.map((r: any) => r.brand_name).filter(Boolean) },
        { status: 200 }
      );
    }
  } catch (err) {
    console.error("Sentiment brands GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "FastAPI backend is not available" },
      { status: 500 }
    );
  }
}