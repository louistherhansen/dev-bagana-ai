import { NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth";

// Use Node.js runtime to support crypto and pg modules
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value;

    if (token) {
      await deleteSession(token);
    }

    const response = NextResponse.json({ success: true });
    // Clear cookie using empty value + maxAge 0 (in some Docker setups, delete() doesn't always clear)
    response.cookies.set("auth_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && process.env.FORCE_SECURE_COOKIES === "true",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
    return response;
  } catch (err) {
    console.error("Logout error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to logout" },
      { status: 500 }
    );
  }
}
