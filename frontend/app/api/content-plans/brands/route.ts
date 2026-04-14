import { NextRequest, NextResponse } from "next/server";
import { getFastAPIBaseUrl, fastAPIProxyHeaders } from "@/lib/fastapi-proxy";

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${getFastAPIBaseUrl()}/api/content-plans/brands`, {
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
    console.error("Content plans brands GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "FastAPI backend is not available" },
      { status: 500 }
    );
  }
}
