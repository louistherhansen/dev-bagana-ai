import { NextRequest, NextResponse } from "next/server";
import { getUserBySessionToken, createUser, getUserByEmail, getUserByUsername } from "@/lib/auth";
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

async function requireSessionUser(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);
  if (!token) return null;
  return await getUserBySessionToken(token);
}

function userRowToDto(row: any) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    fullName: row.full_name ?? undefined,
    role: row.role,
    isActive: !!row.is_active,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ""),
    lastLogin: row.last_login ? (row.last_login instanceof Date ? row.last_login.toISOString() : String(row.last_login)) : undefined,
  };
}

/**
 * GET /api/users - List all users
 * Uses local DB (FastAPI optional)
 */
export async function GET(request: NextRequest) {
  try {
    await ensureAuthTables();
    const sessionUser = await requireSessionUser(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (sessionUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 });
    }

    // Prefer local DB for reliability (FastAPI can be down in dev).
    const res = await query(
      "SELECT id, email, username, full_name, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC"
    );
    return NextResponse.json({ users: res.rows.map(userRowToDto) }, { status: 200 });
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
 * Uses local DB (FastAPI optional)
 */
export async function POST(request: NextRequest) {
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

    const email = String(body.email || "").trim().toLowerCase();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const fullName = String(body.fullName || body.full_name || "").trim();
    const role = String(body.role || "user").trim() || "user";

    // Validasi required fields
    if (!email || !username || !password) {
      return NextResponse.json(
        { error: "Email, username, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    // Uniqueness checks for clearer errors
    const existingEmail = await getUserByEmail(email);
    if (existingEmail) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    const existingUsername = await getUserByUsername(username);
    if (existingUsername) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }

    // Create user in local DB
    let user: Awaited<ReturnType<typeof createUser>> = null;
    try {
      user = await createUser({
        email,
        username,
        password,
        fullName: fullName || undefined,
        role,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e ?? "");
      if (/duplicate key value/i.test(msg) && /users_email_key|users_username_key|email|username/i.test(msg)) {
        return NextResponse.json({ error: "Email or username already exists" }, { status: 409 });
      }
      throw e;
    }

    if (!user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          isActive: user.isActive,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Users POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create user" },
      { status: 500 }
    );
  }
}
