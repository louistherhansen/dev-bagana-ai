import { NextRequest, NextResponse } from "next/server";
import { getUserBySessionToken } from "@/lib/auth";
import { DbUnavailableError, query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSessionTokenFromRequest(request: NextRequest): string | null {
  const h = request.headers.get("Authorization");
  if (h?.startsWith("Bearer ")) return h.slice(7).trim();
  return request.cookies.get("auth_token")?.value ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const token = getSessionTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sessionUser = await getUserBySessionToken(token);
    if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Only allow bootstrap if there is no admin at all.
    const hasAdmin = await query(
      "SELECT 1 FROM users WHERE role = 'admin' AND is_active = TRUE LIMIT 1"
    );
    if (hasAdmin.rows.length > 0) {
      return NextResponse.json(
        { error: "Admin already exists. Please ask an admin to grant access." },
        { status: 403 }
      );
    }

    await query("UPDATE users SET role = 'admin', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [
      sessionUser.id,
    ]);

    const refreshed = await query<{
      id: string;
      email: string;
      username: string;
      full_name: string | null;
      role: string;
    }>("SELECT id, email, username, full_name, role FROM users WHERE id = $1", [sessionUser.id]);

    const row = refreshed.rows[0];
    return NextResponse.json({
      ok: true,
      user: {
        id: row.id,
        email: row.email,
        username: row.username,
        fullName: row.full_name,
        role: row.role,
      },
    });
  } catch (err) {
    if (err instanceof DbUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to bootstrap admin" },
      { status: 500 }
    );
  }
}

