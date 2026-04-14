import { NextRequest, NextResponse } from "next/server";
import { getFastAPIBaseUrl, fastAPIProxyHeaders } from "@/lib/fastapi-proxy";

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const backendUrl = new URL(`${getFastAPIBaseUrl()}/api/sentiment/list`);
    
    // Convert query params: brand_name tetap sama, id tetap sama
    searchParams.forEach((value, key) => {
      backendUrl.searchParams.append(key, value);
    });

    const response = await fetch(backendUrl.toString(), {
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
    
    // Backend returns an array directly; no extra mapping needed
    // because the format already matches SentimentAnalysisRecord
    return NextResponse.json(data, { status: response.status });
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

    const response = await fetch(`${getFastAPIBaseUrl()}/api/sentiment/save`, {
      method: "POST",
      headers: fastAPIProxyHeaders(request, { "Content-Type": "application/json" }),
      body: JSON.stringify(backendPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend FastAPI error:", response.status, errorText);
      return NextResponse.json(
        { error: `Backend error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    console.error("Sentiment analysis POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save to backend" },
      { status: 500 }
    );
  }
}