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

const CONTENT_PLANS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS content_plans (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    campaign VARCHAR(500),
    brand_name VARCHAR(255),
    conversation_id VARCHAR(255),
    schema_valid BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_content_plans_brand_name ON content_plans(brand_name);
`;

async function ensureContentPlansTables(): Promise<void> {
  const statements = CONTENT_PLANS_TABLE_SQL.split(";").map((s) => s.trim()).filter(Boolean);
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
      const response = await fetch(`${getFastAPIBaseUrl()}/api/content-plans/brands`, {
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
      await ensureContentPlansTables();
      const res = await query(
        "SELECT DISTINCT brand_name FROM content_plans WHERE brand_name IS NOT NULL ORDER BY brand_name"
      );
      return NextResponse.json(
        { brands: res.rows.map((r: any) => r.brand_name).filter(Boolean) },
        { status: 200 }
      );
    }
  } catch (err) {
    console.error("Content plans brands GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "FastAPI backend is not available" },
      { status: 500 }
    );
  }
}
