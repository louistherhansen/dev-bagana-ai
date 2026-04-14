import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getFastAPIBaseUrl, fastAPIProxyHeaders } from "@/lib/fastapi-proxy";

// Use Node.js runtime to support pg module
export const runtime = 'nodejs';

/**
 * Market Trends API (results from trend_researcher CrewAI agent)
 *
 * GET /api/trends - List all (optional ?brand_name= for filter)
 * GET /api/trends?id=<id> - Get one by id
 * POST /api/trends - Create (brandName, fullOutput, conversationId?)
 */

export interface TrendRecord {
  id: string;
  brandName: string;
  fullOutput: string;
  conversationId?: string;
  createdAt: number;
}

function generateId(): string {
  return `trend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const TRENDS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS market_trends (
    id VARCHAR(255) PRIMARY KEY,
    brand_name VARCHAR(255) NOT NULL,
    conversation_id VARCHAR(255),
    key_market_trends JSONB,
    summary_bar_chart_data JSONB,
    trend_line_chart_data JSONB,
    creator_economy_insights TEXT,
    competitive_landscape TEXT,
    content_format_trends TEXT,
    timing_seasonality TEXT,
    implications_strategy TEXT,
    recommendations TEXT,
    sources TEXT,
    audit TEXT,
    full_output TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_market_trends_brand_name ON market_trends(brand_name);
  CREATE INDEX IF NOT EXISTS idx_market_trends_created_at ON market_trends(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_market_trends_conversation_id ON market_trends(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_market_trends_summary_bar ON market_trends USING GIN (summary_bar_chart_data);
  CREATE INDEX IF NOT EXISTS idx_market_trends_trend_lines ON market_trends USING GIN (trend_line_chart_data);
`;

/** Ensure market_trends table exists (idempotent). */
async function ensureTrendsTable(): Promise<void> {
  const statements = TRENDS_TABLE_SQL.split(";").map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await query(stmt).catch(() => {});
  }
}

/**
 * Parse CrewAI output into structured data
 */
function parseTrendOutput(fullOutput: string): {
  keyMarketTrends: any[] | null;
  summaryBarChartData: any[] | null;
  trendLineChartData: any[] | null;
  creatorEconomyInsights: string | null;
  competitiveLandscape: string | null;
  contentFormatTrends: string | null;
  timingSeasonality: string | null;
  implicationsStrategy: string | null;
  recommendations: string | null;
  sources: string | null;
  audit: string | null;
} {
  const text = fullOutput || "";
  
  // Parse Key Market Trends
  const keyTrendsMatch = text.match(/##?\s*Key\s+Market\s+Trends[\s\S]*?(?=##|$)/i);
  const keyMarketTrends: any[] = [];
  if (keyTrendsMatch) {
    const section = keyTrendsMatch[0];
    const lines = section.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      // Match format: "1. **Trend Name**: Description"
      const match = trimmed.match(/^\d+\.\s+\*\*(.+?)\*\*:\s*(.+)$/);
      if (match) {
        keyMarketTrends.push({ name: match[1].trim(), description: match[2].trim() });
      }
    }
  }
  
  // Parse Summary Bar Chart Data
  const summaryBars: any[] = [];
  const summaryMatch = text.match(/##?\s*Summary\s+Bar\s+Chart\s+Data[\s\S]*?(?=##|$)/i);
  if (summaryMatch) {
    const section = summaryMatch[0];
    const lines = section.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^(.+?)\s*\|\s*(\d+(?:\.\d+)?)$/);
      if (match) {
        summaryBars.push({ 
          name: match[1].trim(), 
          value: Math.min(100, Math.max(0, parseFloat(match[2]) || 0)) 
        });
      }
    }
  }
  
  // Parse Trend Line Chart Data
  const trendLines: any[] = [];
  const trendLineMatch = text.match(/##?\s*Trend\s+Line\s+Chart\s+Data[\s\S]*?(?=##|$)/i);
  if (trendLineMatch) {
    const section = trendLineMatch[0];
    const lines = section.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^(.+?)\s*\|\s*(.+)$/);
      if (match) {
        const trendName = match[1].trim();
        const dataStr = match[2].trim();
        const dataPoints: any[] = [];
        const pairs = dataStr.split(",");
        for (const pair of pairs) {
          const pairMatch = pair.trim().match(/^(.+?):\s*(\d+(?:\.\d+)?)$/);
          if (pairMatch) {
            dataPoints.push({
              period: pairMatch[1].trim(),
              value: Math.min(100, Math.max(0, parseFloat(pairMatch[2]) || 0))
            });
          }
        }
        if (dataPoints.length > 0) {
          trendLines.push({ name: trendName, data: dataPoints });
        }
      }
    }
  }
  
  // Parse text sections
  const extractSection = (sectionName: string): string | null => {
    // Try multiple patterns to match section headers
    const patterns = [
      new RegExp(`##?\\s*${sectionName.replace(/\s+/g, "\\s+")}[\\s\\S]*?(?=##|$)`, "i"),
      new RegExp(`##?\\s*${sectionName.replace(/\s+/g, "[\\s-]+")}[\\s\\S]*?(?=##|$)`, "i"),
      new RegExp(`#\\s+${sectionName.replace(/\s+/g, "\\s+")}[\\s\\S]*?(?=#|$)`, "i"),
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const section = match[0];
        // Remove header line(s) and return content
        const content = section.replace(/^##?\s*[^\n]+\n?/i, "").trim();
        return content || null;
      }
    }
    return null;
  };
  
  return {
    keyMarketTrends: keyMarketTrends.length > 0 ? keyMarketTrends : null,
    summaryBarChartData: summaryBars.length > 0 ? summaryBars : null,
    trendLineChartData: trendLines.length > 0 ? trendLines : null,
    creatorEconomyInsights: extractSection("Creator Economy Insights"),
    competitiveLandscape: extractSection("Competitive Landscape"),
    contentFormatTrends: extractSection("Content Format Trends"),
    timingSeasonality: extractSection("Timing and Seasonality"),
    implicationsStrategy: extractSection("Implications for Strategy"),
    recommendations: extractSection("Recommendations"),
    sources: extractSection("Sources"),
    audit: extractSection("Audit"),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const brandName = searchParams.get("brand_name");
    const backendUrl = new URL(`${getFastAPIBaseUrl()}/api/trends/list`);
    if (id) {
      backendUrl.searchParams.append("id", id);
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
    console.error("Trends GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "FastAPI backend is not available" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Convert camelCase dari frontend ke snake_case untuk FastAPI backend
    const backendPayload = {
      brand_name: body.brandName || body.brand_name || "",
      full_output: body.fullOutput || body.full_output || "",
      conversation_id: body.conversationId || body.conversation_id || null,
    };

    // Validasi required fields
    if (!backendPayload.brand_name || !backendPayload.brand_name.trim()) {
      return NextResponse.json(
        { error: "brandName is required" },
        { status: 400 }
      );
    }

    const response = await fetch(`${getFastAPIBaseUrl()}/api/trends/save`, {
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
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    console.error("Trends POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save to backend" },
      { status: 500 }
    );
  }
}
