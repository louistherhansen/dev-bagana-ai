import { NextRequest, NextResponse } from "next/server";
import { getUserBySessionToken, hashPassword } from "@/lib/auth";
import { query } from "@/lib/db";
import { getFastAPIBaseUrl, fastAPIProxyHeaders } from "@/lib/fastapi-proxy";

// Use Node.js runtime to support crypto and pg modules
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PUT /api/users/[id] - Update user
 * Forwards to FastAPI backend
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const userId = params.id;

    // Convert camelCase dari frontend ke snake_case untuk FastAPI backend
    const backendPayload: any = {};
    if (body.email !== undefined) backendPayload.email = body.email;
    if (body.username !== undefined) backendPayload.username = body.username;
    if (body.fullName !== undefined || body.full_name !== undefined) {
      backendPayload.full_name = body.fullName || body.full_name || null;
    }
    if (body.role !== undefined) backendPayload.role = body.role;
    if (body.password !== undefined && body.password.trim()) {
      backendPayload.password = body.password;
    }

    const response = await fetch(`${getFastAPIBaseUrl()}/api/users/${userId}`, {
      method: "PUT",
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
    console.error("Users PUT error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update user" },
      { status: 500 }
    );
  }
}
