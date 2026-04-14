import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, getUserByUsername, verifyPassword, createSession } from "@/lib/auth";
import { DbUnavailableError, query } from "@/lib/db";

// Use Node.js runtime to support crypto and pg modules
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

export async function POST(request: NextRequest) {
  try {
    await ensureAuthTables();
    const body = await request.json().catch(() => ({}));
    const emailOrUsername = (body.email || body.username || "").toString().trim();
    const password = (body.password || "").toString();

    if (!emailOrUsername || !password) {
      return NextResponse.json(
        { error: "Email/username and password are required" },
        { status: 400 }
      );
    }

    // Try to get user by email or username
    let user = await getUserByEmail(emailOrUsername);
    if (!user) {
      user = await getUserByUsername(emailOrUsername);
    }

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email/username or password" },
        { status: 401 }
      );
    }

    // Get password hash from database
    const result = await query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid email/username or password" },
        { status: 401 }
      );
    }

    const passwordHash = result.rows[0].password_hash;
    const isValid = await verifyPassword(password, passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email/username or password" },
        { status: 401 }
      );
    }

    // Auto-migrate SHA-256 passwords to bcrypt on successful login
    // This ensures passwords are gradually migrated to bcrypt
    // Skip migration in production if bcrypt is not properly configured
    const isSha256Hash = /^[a-f0-9]{64}$/i.test(passwordHash);
    if (isSha256Hash && process.env.NODE_ENV !== 'production') {
      try {
        const { hashPassword } = await import("@/lib/auth");
        const newBcryptHash = await hashPassword(password);
        await query(
          "UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
          [newBcryptHash, user.id]
        );
        console.log(`Password migrated to bcrypt for user: ${user.email}`);
      } catch (migrationError) {
        // Log error but don't fail login - migration will happen on next login
        console.error("Password migration error:", migrationError);
      }
    }

    // Create session
    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined;
    const userAgent = request.headers.get("user-agent") || undefined;
    const session = await createSession(user.id, ipAddress, userAgent);

    if (!session) {
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }

    // Create response with session token in cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
      token: session.token,
    });

    // Set HTTP-only cookie (path harus / agar logout bisa clear cookie yang sama)
    const isSecure =
      process.env.NODE_ENV === "production" &&
      (request.url.startsWith("https://") || process.env.FORCE_SECURE_COOKIES === "true");
    response.cookies.set("auth_token", session.token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    if (err instanceof DbUnavailableError) {
      return NextResponse.json(
        { error: err.message },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to login" },
      { status: 500 }
    );
  }
}
