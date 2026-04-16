import { NextRequest, NextResponse } from "next/server";
import { getUserBySessionToken } from "@/lib/auth";
import { query } from "@/lib/db";
import { getFastAPIBaseUrl, fastAPIProxyHeaders } from "@/lib/fastapi-proxy";

// Use Node.js runtime to support pg module
export const runtime = 'nodejs';

/**
 * Content Plans API Endpoints
 * 
 * GET /api/content-plans - Get all content plans
 * GET /api/content-plans?id=<plan_id> - Get specific plan with versions
 * POST /api/content-plans - Create new content plan
 * PUT /api/content-plans - Update content plan
 * DELETE /api/content-plans?id=<plan_id> - Delete content plan
 */

export interface PlanTalent {
  name: string;
}

export interface PlanVersion {
  id: string;
  version: string;
  content: any;
  metadata?: any;
  createdAt: number;
}

export interface ContentPlan {
  id: string;
  title: string;
  campaign?: string;
  brandName?: string;
  conversationId?: string;
  schemaValid: boolean;
  talents: string[];
  versions: PlanVersion[];
  createdAt: number;
  updatedAt: number;
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

const CONTENT_PLANS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS content_plans (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    campaign VARCHAR(500),
    brand_name VARCHAR(255),
    conversation_id VARCHAR(255),
    schema_valid BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS plan_versions (
    id VARCHAR(255) PRIMARY KEY,
    plan_id VARCHAR(255) NOT NULL REFERENCES content_plans(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_plan_version UNIQUE(plan_id, version)
  );
  CREATE TABLE IF NOT EXISTS plan_talents (
    plan_id VARCHAR(255) NOT NULL REFERENCES content_plans(id) ON DELETE CASCADE,
    talent_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (plan_id, talent_name)
  );
  CREATE INDEX IF NOT EXISTS idx_content_plans_brand_name ON content_plans(brand_name);
  CREATE INDEX IF NOT EXISTS idx_content_plans_updated_at ON content_plans(updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_plan_versions_plan_id ON plan_versions(plan_id);
  CREATE INDEX IF NOT EXISTS idx_plan_talents_plan_id ON plan_talents(plan_id);
`;

async function ensureContentPlansTables(): Promise<void> {
  const statements = CONTENT_PLANS_TABLE_SQL.split(";").map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    try {
      await query(stmt);
    } catch {
      // ignore (fallback best-effort)
    }
  }
}

/**
 * GET /api/content-plans
 * Get all content plans or a specific plan by ID
 */
export async function GET(request: NextRequest) {
  try {
    const sessionUser = await requireSessionUser(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("id");
    const brandName = searchParams.get("brand_name");
    const backendUrl = new URL(`${getFastAPIBaseUrl()}/api/content-plans/list`);
    if (planId) {
      backendUrl.searchParams.append("id", planId);
    }
    if (brandName) {
      backendUrl.searchParams.append("brand_name", brandName);
    }

    try {
      const response = await fetch(backendUrl.toString(), {
        headers: fastAPIProxyHeaders(request, undefined, { includeInternal: true }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Backend FastAPI GET error:", response.status, errorText);
        return NextResponse.json(
          { error: response.status === 401 ? "Unauthorized" : `Backend error: ${errorText}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    } catch (err) {
      // FastAPI backend unavailable → fallback to local Postgres
      await ensureContentPlansTables();

      if (planId) {
        const planRes = await query<{
          id: string;
          title: string;
          campaign: string | null;
          brand_name: string | null;
          conversation_id: string | null;
          schema_valid: boolean;
          created_at: Date;
          updated_at: Date;
        }>(
          "SELECT id, title, campaign, brand_name, conversation_id, schema_valid, created_at, updated_at FROM content_plans WHERE id = $1",
          [planId]
        );
        if (planRes.rows.length === 0) {
          return NextResponse.json({ error: "Content plan not found" }, { status: 404 });
        }

        const versionsRes = await query<{
          id: string;
          version: string;
          content: any;
          metadata: any;
          created_at: Date;
        }>(
          "SELECT id, version, content, metadata, created_at FROM plan_versions WHERE plan_id = $1 ORDER BY created_at DESC",
          [planId]
        );

        const talentsRes = await query<{ talent_name: string }>(
          "SELECT talent_name FROM plan_talents WHERE plan_id = $1 ORDER BY talent_name",
          [planId]
        );

        const p = planRes.rows[0];
        return NextResponse.json(
          {
            id: p.id,
            title: p.title,
            campaign: p.campaign ?? undefined,
            brandName: p.brand_name ?? undefined,
            conversationId: p.conversation_id ?? undefined,
            schemaValid: !!p.schema_valid,
            talents: talentsRes.rows.map((r) => r.talent_name),
            versions: versionsRes.rows.map((r) => ({
              id: r.id,
              version: r.version,
              content: r.content,
              metadata: r.metadata ?? undefined,
              createdAt: r.created_at instanceof Date ? r.created_at.getTime() : Date.now(),
            })),
            createdAt: p.created_at instanceof Date ? p.created_at.getTime() : Date.now(),
            updatedAt: p.updated_at instanceof Date ? p.updated_at.getTime() : Date.now(),
          },
          { status: 200 }
        );
      }

      const params: any[] = [];
      let sql =
        "SELECT id, title, campaign, brand_name, schema_valid, updated_at FROM content_plans";
      if (brandName) {
        sql += " WHERE brand_name = $1";
        params.push(brandName);
      }
      sql += " ORDER BY updated_at DESC LIMIT 100";
      const listRes = await query<{
        id: string;
        title: string;
        campaign: string | null;
        brand_name: string | null;
        schema_valid: boolean;
        updated_at: Date;
      }>(sql, params);

      const planIds = listRes.rows.map((r) => r.id).filter(Boolean);
      if (planIds.length === 0) {
        return NextResponse.json([], { status: 200 });
      }

      // talents per plan
      const talentsAgg = await query<{ plan_id: string; talents: string[] }>(
        `SELECT plan_id, ARRAY_AGG(talent_name ORDER BY talent_name) AS talents
         FROM plan_talents
         WHERE plan_id = ANY($1::varchar[])
         GROUP BY plan_id`,
        [planIds]
      );
      const talentsMap = new Map<string, string[]>();
      for (const r of talentsAgg.rows) talentsMap.set(r.plan_id, (r as any).talents || []);

      // latest version per plan
      const latestVer = await query<{ plan_id: string; version: string }>(
        `SELECT DISTINCT ON (plan_id) plan_id, version
         FROM plan_versions
         WHERE plan_id = ANY($1::varchar[])
         ORDER BY plan_id, created_at DESC`,
        [planIds]
      );
      const versionMap = new Map<string, string>();
      for (const r of latestVer.rows) versionMap.set(r.plan_id, r.version);

      return NextResponse.json(
        listRes.rows.map((p) => ({
          id: p.id,
          title: p.title,
          campaign: p.campaign ?? undefined,
          brandName: p.brand_name ?? undefined,
          schemaValid: !!p.schema_valid,
          talents: talentsMap.get(p.id) || [],
          version: versionMap.get(p.id) || "v1.0",
          updatedAt: p.updated_at instanceof Date ? p.updated_at.getTime() : Date.now(),
        })),
        { status: 200 }
      );
    }
  } catch (err) {
    console.error("Content plans GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "FastAPI backend is not available" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/content-plans
 * Create a new content plan
 */
export async function POST(request: NextRequest) {
  try {
    const sessionUser = await requireSessionUser(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Convert camelCase dari frontend ke snake_case untuk FastAPI backend
    const backendPayload = {
      id: body.id || "",
      title: body.title || "",
      campaign: body.campaign || body.campaign || null,
      brand_name: body.brandName || body.brand_name || null,
      conversation_id: body.conversationId || body.conversation_id || null,
      schema_valid: body.schemaValid ?? body.schema_valid ?? true,
      talents: body.talents || body.talents || [],
      version: body.version || body.version || "v1.0",
      content: body.content || {},
      metadata: body.metadata || body.metadata || null,
    };

    // Validasi required fields
    if (!backendPayload.id || !backendPayload.title || !backendPayload.content) {
      return NextResponse.json(
        { error: "Plan ID, title, and content are required" },
        { status: 400 }
      );
    }

    try {
      const response = await fetch(`${getFastAPIBaseUrl()}/api/content-plans/save`, {
        method: "POST",
        headers: fastAPIProxyHeaders(request, { "Content-Type": "application/json" }, { includeInternal: true }),
        body: JSON.stringify(backendPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Backend FastAPI error:", response.status, errorText);
        return NextResponse.json(
          { error: response.status === 401 ? "Unauthorized" : `Backend error: ${errorText}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data, { status: 201 });
    } catch (err) {
      // FastAPI backend unavailable → fallback to local Postgres
      await ensureContentPlansTables();
      const now = new Date();

      await query(
        `INSERT INTO content_plans (id, title, campaign, brand_name, conversation_id, schema_valid, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,COALESCE((SELECT created_at FROM content_plans WHERE id=$1), $7), $7)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           campaign = EXCLUDED.campaign,
           brand_name = EXCLUDED.brand_name,
           conversation_id = EXCLUDED.conversation_id,
           schema_valid = EXCLUDED.schema_valid,
           updated_at = $7`,
        [
          backendPayload.id,
          backendPayload.title,
          backendPayload.campaign,
          backendPayload.brand_name,
          backendPayload.conversation_id,
          backendPayload.schema_valid,
          now,
        ]
      );

      // talents: replace
      await query("DELETE FROM plan_talents WHERE plan_id = $1", [backendPayload.id]).catch(() => {});
      if (Array.isArray(backendPayload.talents)) {
        for (const t of backendPayload.talents) {
          const name = String(t || "").trim();
          if (!name) continue;
          await query(
            "INSERT INTO plan_talents (plan_id, talent_name) VALUES ($1,$2) ON CONFLICT (plan_id, talent_name) DO NOTHING",
            [backendPayload.id, name]
          ).catch(() => {});
        }
      }

      const versionId = `${backendPayload.id}_${backendPayload.version}`;
      await query(
        `INSERT INTO plan_versions (id, plan_id, version, content, metadata, created_at)
         VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6)
         ON CONFLICT (id) DO UPDATE SET
           content = EXCLUDED.content,
           metadata = EXCLUDED.metadata`,
        [
          versionId,
          backendPayload.id,
          backendPayload.version,
          JSON.stringify(backendPayload.content ?? {}),
          backendPayload.metadata ? JSON.stringify(backendPayload.metadata) : null,
          now,
        ]
      );

      return NextResponse.json(
        {
          status: "success",
          id: backendPayload.id,
          title: backendPayload.title,
          campaign: backendPayload.campaign,
          brandName: backendPayload.brand_name,
          conversationId: backendPayload.conversation_id,
          schemaValid: backendPayload.schema_valid,
          talents: backendPayload.talents,
          version: backendPayload.version,
          createdAt: now.getTime(),
        },
        { status: 201 }
      );
    }
  } catch (err) {
    console.error("Content plans POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save to backend" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/content-plans
 * Update content plan (title, campaign, brandName, schemaValid, talents)
 * To add a new version, use POST with same plan ID
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      title,
      campaign,
      brandName,
      schemaValid,
      talents,
    } = body as {
      id: string;
      title?: string;
      campaign?: string;
      brandName?: string;
      schemaValid?: boolean;
      talents?: string[];
    };

    if (!id) {
      return NextResponse.json(
        { error: "Plan ID is required" },
        { status: 400 }
      );
    }

    // Update plan fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (campaign !== undefined) {
      updates.push(`campaign = $${paramIndex++}`);
      values.push(campaign || null);
    }
    if (brandName !== undefined) {
      updates.push(`brand_name = $${paramIndex++}`);
      values.push(brandName || null);
    }
    if (schemaValid !== undefined) {
      updates.push(`schema_valid = $${paramIndex++}`);
      values.push(schemaValid);
    }

    if (updates.length > 0) {
      values.push(id);
      await query(
        `UPDATE content_plans SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex}`,
        values
      );
    }

    // Update talents if provided
    if (talents !== undefined) {
      // Delete existing talents
      await query("DELETE FROM plan_talents WHERE plan_id = $1", [id]);
      
      // Insert new talents
      for (const talent of talents) {
        await query(
          "INSERT INTO plan_talents (plan_id, talent_name) VALUES ($1, $2) ON CONFLICT (plan_id, talent_name) DO NOTHING",
          [id, talent]
        );
      }
    }

    // Fetch updated plan
    const planResult = await query<{
      id: string;
      title: string;
      campaign: string | null;
      brand_name: string | null;
      conversation_id: string | null;
      schema_valid: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      "SELECT id, title, campaign, brand_name, conversation_id, schema_valid, created_at, updated_at FROM content_plans WHERE id = $1",
      [id]
    );

    if (planResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Content plan not found" },
        { status: 404 }
      );
    }

    const plan = planResult.rows[0];

    // Get talents
    const talentsResult = await query<{
      talent_name: string;
    }>(
      "SELECT talent_name FROM plan_talents WHERE plan_id = $1 ORDER BY talent_name",
      [id]
    );

    // Get versions
    const versionsResult = await query<{
      id: string;
      version: string;
      content: any;
      metadata: any;
      created_at: Date;
    }>(
      "SELECT id, version, content, metadata, created_at FROM plan_versions WHERE plan_id = $1 ORDER BY created_at DESC",
      [id]
    );

    const contentPlan: ContentPlan = {
      id: plan.id,
      title: plan.title,
      campaign: plan.campaign || undefined,
      brandName: plan.brand_name || undefined,
      conversationId: plan.conversation_id || undefined,
      schemaValid: plan.schema_valid,
      talents: talentsResult.rows.map((row) => row.talent_name),
      versions: versionsResult.rows.map((row) => ({
        id: row.id,
        version: row.version,
        content: row.content,
        metadata: row.metadata || undefined,
        createdAt: row.created_at.getTime(),
      })),
      createdAt: plan.created_at.getTime(),
      updatedAt: plan.updated_at.getTime(),
    };

    return NextResponse.json(contentPlan);
  } catch (error) {
    console.error("Error updating content plan:", error);
    return NextResponse.json(
      {
        error: "Failed to update content plan",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/content-plans?id=<plan_id>
 * Delete a content plan and all its versions and talents
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("id");

    if (!planId) {
      return NextResponse.json(
        { error: "Plan ID is required" },
        { status: 400 }
      );
    }

    // Delete plan (versions and talents will be deleted automatically due to CASCADE)
    const result = await query(
      "DELETE FROM content_plans WHERE id = $1 RETURNING id",
      [planId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Content plan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, id: planId });
  } catch (error) {
    console.error("Error deleting content plan:", error);
    return NextResponse.json(
      {
        error: "Failed to delete content plan",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
