import { NextRequest, NextResponse } from "next/server";
import { getUserBySessionToken, hashPassword } from "@/lib/auth";
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
 * PUT /api/users/[id] - Update user
 * Forwards to FastAPI backend
 */
export async function PUT(
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

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (body.email !== undefined) {
      updates.push(`email = $${idx++}`);
      values.push(String(body.email || "").trim().toLowerCase());
    }
    if (body.username !== undefined) {
      updates.push(`username = $${idx++}`);
      values.push(String(body.username || "").trim());
    }
    if (body.fullName !== undefined || body.full_name !== undefined) {
      updates.push(`full_name = $${idx++}`);
      const v = (body.fullName ?? body.full_name ?? "").toString().trim();
      values.push(v || null);
    }
    if (body.role !== undefined) {
      updates.push(`role = $${idx++}`);
      values.push(String(body.role || "user").trim() || "user");
    }
    if (body.password !== undefined && String(body.password).trim()) {
      if (String(body.password).length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 });
      }
      const hashed = await hashPassword(String(body.password));
      updates.push(`password_hash = $${idx++}`);
      values.push(hashed);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(userId);
    try {
      await query(
        `UPDATE users SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx}`,
        values
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e ?? "");
      if (/duplicate key value/i.test(msg) && /users_email_key|users_username_key|email|username/i.test(msg)) {
        return NextResponse.json({ error: "Email or username already exists" }, { status: 409 });
      }
      throw e;
    }

    const res = await query(
      "SELECT id, email, username, full_name, role, is_active, created_at, last_login FROM users WHERE id = $1",
      [userId]
    );
    if (res.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const u: any = res.rows[0];
    return NextResponse.json(
      {
        user: {
          id: u.id,
          email: u.email,
          username: u.username,
          fullName: u.full_name ?? undefined,
          role: u.role,
          isActive: !!u.is_active,
          createdAt: u.created_at instanceof Date ? u.created_at.toISOString() : undefined,
          lastLogin: u.last_login ? (u.last_login instanceof Date ? u.last_login.toISOString() : undefined) : undefined,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Users PUT error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update user" },
      { status: 500 }
    );
  }
}
