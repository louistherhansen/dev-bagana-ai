import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserBySessionToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
};

function getSessionTokenFromRequest(request: NextRequest): string | null {
  const h = request.headers.get("Authorization");
  if (h?.startsWith("Bearer ")) return h.slice(7).trim();
  return request.cookies.get("auth_token")?.value ?? null;
}

async function requireUser(request: NextRequest): Promise<{ id: string }> {
  const token = getSessionTokenFromRequest(request);
  if (!token) {
    throw new Error("UNAUTHORIZED");
  }
  const user = await getUserBySessionToken(token);
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return { id: user.id };
}

async function ensureProjectsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS projects (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);`).catch(() => {});
  await query(`CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);`).catch(() => {});
}

function generateProjectId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    await ensureProjectsTable();

    const res = await query<ProjectRow>(
      `SELECT id, user_id, name, created_at, updated_at
       FROM projects
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 200`,
      [user.id]
    );

    return NextResponse.json(
      res.rows.map((r) => ({
        id: r.id,
        name: r.name,
        createdAt: r.created_at.getTime(),
        updatedAt: r.updated_at.getTime(),
      }))
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    await ensureProjectsTable();

    const body = (await request.json().catch(() => ({}))) as { name?: string; id?: string };
    const name = (body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const id = (body.id || generateProjectId()).trim();
    await query(
      `INSERT INTO projects (id, user_id, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = CURRENT_TIMESTAMP`,
      [id, user.id, name]
    );

    return NextResponse.json({ id, name }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

