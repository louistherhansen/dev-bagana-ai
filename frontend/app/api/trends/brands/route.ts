import { NextRequest, NextResponse } from "next/server";
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
    await query(stmt).catch(() => {});
  }
}

/** GET /api/trends/brands — distinct brand names for Filter by Brand dropdown. */
export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${getFastAPIBaseUrl()}/api/trends/brands`, {
      headers: fastAPIProxyHeaders(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend FastAPI GET error:", response.status, errorText);
      return NextResponse.json(
        { error: `Backend error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    console.error("Trends brands GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "FastAPI backend is not available" },
      { status: 500 }
    );
  }
}
