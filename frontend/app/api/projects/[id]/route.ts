import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserBySessionToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSessionTokenFromRequest(request: NextRequest): string | null {
  const h = request.headers.get("Authorization");
  if (h?.startsWith("Bearer ")) return h.slice(7).trim();
  return request.cookies.get("auth_token")?.value ?? null;
}

async function requireUser(request: NextRequest): Promise<{ id: string }> {
  const token = getSessionTokenFromRequest(request);
  if (!token) throw new Error("UNAUTHORIZED");
  const user = await getUserBySessionToken(token);
  if (!user) throw new Error("UNAUTHORIZED");
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
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(request);
    await ensureProjectsTable();

    const body = (await request.json().catch(() => ({}))) as { name?: string };
    const name = (body.name || "").trim();
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const projectId = params.id;
    const res = await query(
      `UPDATE projects
       SET name = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3`,
      [name, projectId, user.id]
    );
    if (res.rowCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ id: projectId, name });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(request);
    await ensureProjectsTable();
    const projectId = params.id;
    const res = await query(`DELETE FROM projects WHERE id = $1 AND user_id = $2`, [projectId, user.id]);
    if (res.rowCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

