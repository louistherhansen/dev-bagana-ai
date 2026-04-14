import { NextRequest, NextResponse } from "next/server";
import { getUserBySessionToken } from "@/lib/auth";
import { DbUnavailableError, query } from "@/lib/db";

export const runtime = 'nodejs';

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
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
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

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    await ensureAuthTables();

    const token = getSessionTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sessionUser = await getUserBySessionToken(token);
    if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const emailRaw = body.email !== undefined ? String(body.email ?? "").trim() : undefined;
    const usernameRaw = body.username !== undefined ? String(body.username ?? "").trim() : undefined;
    const fullNameRaw =
      body.fullName !== undefined || body.full_name !== undefined
        ? String((body.fullName ?? body.full_name ?? "")).trim()
        : undefined;

    const updates: string[] = [];
    const params: any[] = [];

    if (emailRaw !== undefined) {
      const email = emailRaw.toLowerCase();
      if (!email) {
        return NextResponse.json({ error: "Email is required" }, { status: 400 });
      }
      const exists = await query<{ id: string }>(
        "SELECT id FROM users WHERE lower(email) = lower($1) AND id <> $2 LIMIT 1",
        [email, sessionUser.id]
      );
      if (exists.rows.length > 0) {
        return NextResponse.json({ error: "Email already exists" }, { status: 400 });
      }
      const idx = params.length + 1;
      updates.push(`email = $${idx}`);
      params.push(email);
    }

    if (usernameRaw !== undefined) {
      const username = usernameRaw;
      if (!username) {
        return NextResponse.json({ error: "Username is required" }, { status: 400 });
      }
      const exists = await query<{ id: string }>(
        `SELECT id FROM users WHERE username = $1 AND id <> $2 LIMIT 1`,
        [username, sessionUser.id]
      );
      if (exists.rows.length > 0) {
        return NextResponse.json({ error: "Username already exists" }, { status: 400 });
      }
      const idx = params.length + 1;
      updates.push(`username = $${idx}`);
      params.push(username);
    }

    if (fullNameRaw !== undefined) {
      const idx = params.length + 1;
      updates.push(`full_name = $${idx}`);
      params.push(fullNameRaw || null);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "At least one field must be provided" },
        { status: 400 }
      );
    }

    // Always touch updated_at
    updates.push("updated_at = CURRENT_TIMESTAMP");

    const whereIdx = params.length + 1;
    await query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${whereIdx}`,
      [...params, sessionUser.id]
    );

    const refreshed = await query<{
      id: string;
      email: string;
      username: string;
      full_name: string | null;
      role: string;
    }>("SELECT id, email, username, full_name, role FROM users WHERE id = $1", [sessionUser.id]);

    const row = refreshed.rows[0];
    return NextResponse.json({
      id: row.id,
      email: row.email,
      username: row.username,
      fullName: row.full_name,
      role: row.role,
    });
  } catch (err) {
    console.error("User profile PUT error:", err);
    if (err instanceof DbUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update profile" },
      { status: 500 }
    );
  }
}
