import { NextRequest, NextResponse } from "next/server";
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

/**
 * GET /api/content-plans
 * Get all content plans or a specific plan by ID
 */
export async function GET(request: NextRequest) {
  try {
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

    const response = await fetch(backendUrl.toString(), {
      headers: fastAPIProxyHeaders(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend FastAPI GET error:", response.status, errorText);
      return NextResponse.json(
        { error: `Backend error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
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

    const response = await fetch(`${getFastAPIBaseUrl()}/api/content-plans/save`, {
      method: "POST",
      headers: fastAPIProxyHeaders(request, { "Content-Type": "application/json" }),
      body: JSON.stringify(backendPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend FastAPI error:", response.status, errorText);
      return NextResponse.json(
        { error: `Backend error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status || 201 });
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
