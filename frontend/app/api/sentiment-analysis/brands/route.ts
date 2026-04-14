import { NextRequest, NextResponse } from "next/server";
import { getFastAPIBaseUrl, fastAPIProxyHeaders } from "@/lib/fastapi-proxy";

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${getFastAPIBaseUrl()}/api/sentiment/brands`, {
      headers: fastAPIProxyHeaders(request),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    return NextResponse.json({ brands: [] }, { status: 500 });
  }
}