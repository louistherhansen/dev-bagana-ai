import { NextRequest, NextResponse } from "next/server";
import { getUserBySessionToken } from "@/lib/auth";
import { query } from "@/lib/db";
import { getFastAPIBaseUrl, fastAPIProxyHeaders } from "@/lib/fastapi-proxy";
import crypto from "crypto";

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
  CREATE INDEX IF NOT EXISTS idx_sentiment_analyses_created_at ON sentiment_analyses(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_sentiment_analyses_conversation_id ON sentiment_analyses(conversation_id);
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

function toNum(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function mapSentimentRow(row: any) {
  return {
    id: String(row.id),
    brandName: String(row.brand_name ?? ""),
    positivePct: toNum(row.positive_pct, 0),
    negativePct: toNum(row.negative_pct, 0),
    neutralPct: toNum(row.neutral_pct, 0),
    fullOutput: String(row.full_output ?? ""),
    conversationId: row.conversation_id ?? undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.getTime() : toNum(row.created_at, Date.now()),
  };
}

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await requireSessionUser(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim() || null;
    const brandName = searchParams.get("brand_name")?.trim() || null;

    const backendUrl = new URL(`${getFastAPIBaseUrl()}/api/sentiment/list`);
    
    if (brandName) {
      backendUrl.searchParams.append("brand_name", brandName);
    }

    try {
      const response = await fetch(backendUrl.toString(), {
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
      if (id) {
        const list = Array.isArray(data) ? data : [];
        const found = list.find((x: any) => String(x?.id || "") === id);
        if (!found) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        return NextResponse.json(found, { status: 200 });
      }
      return NextResponse.json(data, { status: response.status });
    } catch (err) {
      // FastAPI backend unavailable → fallback to local Postgres
      await ensureSentimentTable();
      if (id) {
        const res = await query(
          "SELECT id, brand_name, positive_pct, negative_pct, neutral_pct, full_output, conversation_id, created_at FROM sentiment_analyses WHERE id = $1",
          [id]
        );
        if (res.rows.length === 0) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        return NextResponse.json(mapSentimentRow(res.rows[0]), { status: 200 });
      }

      const params: any[] = [];
      let sql =
        "SELECT id, brand_name, positive_pct, negative_pct, neutral_pct, full_output, conversation_id, created_at FROM sentiment_analyses";
      if (brandName) {
        sql += " WHERE brand_name = $1";
        params.push(brandName);
      }
      sql += " ORDER BY created_at DESC LIMIT 100";
      const res = await query(sql, params);
      return NextResponse.json(res.rows.map(mapSentimentRow), { status: 200 });
    }
  } catch (err) {
    console.error("Sentiment analysis GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "FastAPI backend is not available" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await requireSessionUser(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Convert camelCase dari frontend ke snake_case untuk FastAPI backend
    const backendPayload = {
      brand_name: body.brandName || body.brand_name || "",
      positive_pct: body.positivePct ?? body.positive_pct ?? 0,
      negative_pct: body.negativePct ?? body.negative_pct ?? 0,
      neutral_pct: body.neutralPct ?? body.neutral_pct ?? 0,
      full_output: body.fullOutput || body.full_output || "",
      conversation_id: body.conversationId || body.conversation_id || null,
    };

    // Validasi required fields
    if (!backendPayload.brand_name || !backendPayload.brand_name.trim()) {
      return NextResponse.json(
        { error: "brandName is required" },
        { status: 400 }
      );
    }

    try {
      const response = await fetch(`${getFastAPIBaseUrl()}/api/sentiment/save`, {
        method: "POST",
        headers: fastAPIProxyHeaders(request, { "Content-Type": "application/json" }, { includeInternal: true }),
        body: JSON.stringify(backendPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Backend FastAPI error:", response.status, errorText);
        return NextResponse.json(
          { error: response.status === 401 ? "Unauthorized" : `Backend error: ${errorText}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      // Backend includes {status:"success", ...record}; normalize to record shape.
      const record = {
        id: data.id,
        brandName: data.brandName ?? backendPayload.brand_name,
        positivePct: data.positivePct ?? backendPayload.positive_pct,
        negativePct: data.negativePct ?? backendPayload.negative_pct,
        neutralPct: data.neutralPct ?? backendPayload.neutral_pct,
        fullOutput: data.fullOutput ?? backendPayload.full_output,
        conversationId: data.conversationId ?? backendPayload.conversation_id ?? undefined,
        createdAt: data.createdAt ?? Date.now(),
      };
      return NextResponse.json(record, { status: 201 });
    } catch (err) {
      // FastAPI backend unavailable → fallback to local Postgres
      await ensureSentimentTable();
      const id = `sent_${crypto.randomUUID().slice(0, 8)}`;
      const now = new Date();
      await query(
        `INSERT INTO sentiment_analyses (id, brand_name, positive_pct, negative_pct, neutral_pct, full_output, conversation_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          id,
          backendPayload.brand_name,
          backendPayload.positive_pct,
          backendPayload.negative_pct,
          backendPayload.neutral_pct,
          backendPayload.full_output,
          backendPayload.conversation_id,
          now,
        ]
      );
      return NextResponse.json(
        {
          id,
          brandName: backendPayload.brand_name,
          positivePct: backendPayload.positive_pct,
          negativePct: backendPayload.negative_pct,
          neutralPct: backendPayload.neutral_pct,
          fullOutput: backendPayload.full_output,
          conversationId: backendPayload.conversation_id ?? undefined,
          createdAt: now.getTime(),
        },
        { status: 201 }
      );
    }
  } catch (err) {
    console.error("Sentiment analysis POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save to backend" },
      { status: 500 }
    );
  }
}