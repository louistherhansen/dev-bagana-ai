import { NextRequest, NextResponse } from "next/server";
import { getUserBySessionToken } from "@/lib/auth";
import { query } from "@/lib/db";

// Use Node.js runtime to support crypto and pg modules
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AUTH_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
`;

async function ensureAuthTables(): Promise<void> {
  const statements = AUTH_TABLE_SQL.split(";").map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await query(stmt);
  }
}

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

/**
 * PATCH /api/users/[id]/toggle-active - Toggle user active status
 * Forwards to FastAPI backend
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureAuthTables();
    const sessionUser = await requireSessionUser(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (sessionUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const userId = params.id;

    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : null;

    if (isActive === null) {
      return NextResponse.json(
        { error: "isActive is required" },
        { status: 400 }
      );
    }

    // Prevent deactivating yourself
    if (String(sessionUser.id) === String(userId) && !isActive) {
      return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
    }

    const res = await query("UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, is_active", [
      isActive,
      userId,
    ]);

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, isActive: !!(res.rows[0] as any).is_active }, { status: 200 });
  } catch (err) {
    console.error("Toggle user active error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update user status" },
      { status: 500 }
    );
  }
}
