import { NextRequest, NextResponse } from "next/server";
import { getFastAPIBaseUrl, fastAPIProxyHeaders } from "@/lib/fastapi-proxy";

// Use Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Convert camelCase dari frontend ke snake_case untuk FastAPI backend
    const backendPayload = {
      current_password: body.currentPassword || body.current_password || "",
      new_password: body.newPassword || body.new_password || "",
    };

    // Validasi required fields
    if (!backendPayload.current_password || !backendPayload.new_password) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (backendPayload.new_password.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    const response = await fetch(`${getFastAPIBaseUrl()}/api/user/change-password`, {
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
    console.error("Change password POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to change password" },
      { status: 500 }
    );
  }
}
