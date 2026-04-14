import { NextRequest, NextResponse } from "next/server";
import { getUserBySessionToken, createUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getFastAPIBaseUrl, fastAPIProxyHeaders } from "@/lib/fastapi-proxy";

// Use Node.js runtime to support crypto and pg modules
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/users - List all users
 * Forwards to FastAPI backend
 */
export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${getFastAPIBaseUrl()}/api/users/list`, {
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
    console.error("Users GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "FastAPI backend is not available" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users - Create new user
 * Forwards to FastAPI backend
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Convert camelCase dari frontend ke snake_case untuk FastAPI backend
    const backendPayload = {
      email: body.email || "",
      username: body.username || "",
      password: body.password || "",
      full_name: body.fullName || body.full_name || null,
      role: body.role || "user",
    };

    // Validasi required fields
    if (!backendPayload.email || !backendPayload.username || !backendPayload.password) {
      return NextResponse.json(
        { error: "Email, username, and password are required" },
        { status: 400 }
      );
    }

    if (backendPayload.password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    const response = await fetch(`${getFastAPIBaseUrl()}/api/users/create`, {
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
    return NextResponse.json(data, { status: response.status || 201 });
  } catch (err) {
    console.error("Users POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create user" },
      { status: 500 }
    );
  }
}
