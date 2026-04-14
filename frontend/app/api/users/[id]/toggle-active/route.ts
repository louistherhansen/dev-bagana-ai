import { NextRequest, NextResponse } from "next/server";
import { getUserBySessionToken } from "@/lib/auth";
import { query } from "@/lib/db";
import { getFastAPIBaseUrl, fastAPIProxyHeaders } from "@/lib/fastapi-proxy";

// Use Node.js runtime to support crypto and pg modules
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/users/[id]/toggle-active - Toggle user active status
 * Forwards to FastAPI backend
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const userId = params.id;

    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : null;

    if (isActive === null) {
      return NextResponse.json(
        { error: "isActive is required" },
        { status: 400 }
      );
    }

    const backendPayload = {
      is_active: isActive,
    };

    const response = await fetch(`${getFastAPIBaseUrl()}/api/users/${userId}/toggle-active`, {
      method: "PATCH",
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
    console.error("Toggle user active error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update user status" },
      { status: 500 }
    );
  }
}
