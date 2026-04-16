import { NextRequest, NextResponse } from "next/server";
import { getUserBySessionToken } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
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

/**
 * POST /api/admin/bootstrap
 * Promote current session user to admin ONLY if no admin exists yet.
 */
export async function POST(request: NextRequest) {
  try {
    await ensureAuthTables();
    const token = getSessionTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sessionUser = await getUserBySessionToken(token);
    if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminExists = await query("SELECT 1 FROM users WHERE role = 'admin' AND is_active = TRUE LIMIT 1");
    if (adminExists.rows.length > 0) {
      return NextResponse.json(
        { error: "Admin already exists. Bootstrap mode is disabled." },
        { status: 409 }
      );
    }

    await query("UPDATE users SET role = 'admin', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [
      sessionUser.id,
    ]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Admin bootstrap error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to bootstrap admin" },
      { status: 500 }
    );
  }
}
