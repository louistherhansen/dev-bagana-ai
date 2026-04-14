/**
 * Market Trends API client
 * Results from trend_researcher CrewAI agent, stored by brand_name.
 */

const API_BASE = "/api/trends";

export interface TrendRecord {
  id: string;
  brandName: string;
  fullOutput: string;
  conversationId?: string;
  createdAt: number;
}

export type TrendDataPoint = {
  period: string;
  value: number; // 0-100
};

export type TrendLine = {
  name: string;
  color?: string;
  data: TrendDataPoint[];
};

/**
 * Parse Trend Line Chart Data from output text.
 * Format: "Trend Name | Period1:Value1, Period2:Value2, Period3:Value3, ..."
 * Example: "Short-form Video Content | Jan:45, Feb:52, Mar:58, Apr:65, May:72, Jun:78"
 * Returns array of TrendLine objects.
 */
export function parseTrendLineChartData(text: string): TrendLine[] {
  if (!text || typeof text !== "string") return [];

  const trends: TrendLine[] = [];
  
  // Look for "Trend Line Chart Data" section
  const sectionMatch = text.match(/##?\s*Trend\s+Line\s+Chart\s+Data[\s\S]*?(?=##|$)/i);
  if (!sectionMatch) return [];

  const sectionText = sectionMatch[0];
  const lines = sectionText.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Match format: "Trend Name | Period1:Value1, Period2:Value2, ..."
    const match = trimmed.match(/^(.+?)\s*\|\s*(.+)$/);
    if (!match) continue;

    const trendName = match[1].trim();
    const dataStr = match[2].trim();

    // Parse data points: "Period1:Value1, Period2:Value2, ..."
    const dataPoints: TrendDataPoint[] = [];
    const pairs = dataStr.split(",");

    for (const pair of pairs) {
      const pairMatch = pair.trim().match(/^(.+?):\s*(\d+(?:\.\d+)?)$/);
      if (pairMatch) {
        const period = pairMatch[1].trim();
        const value = Math.min(100, Math.max(0, parseFloat(pairMatch[2]) || 0));
        dataPoints.push({ period, value });
      }
    }

    if (dataPoints.length > 0) {
      trends.push({
        name: trendName,
        data: dataPoints,
      });
    }
  }

  return trends;
}

export type SummaryBarData = {
  name: string;
  value: number; // 0-100
};

/**
 * Parse Summary Bar Chart Data from output text.
 * Format: "Trend Name | Value" where Value is 0-100
 * Example: "Cloud Adoption Rates Growing | 85"
 * Returns array of SummaryBarData objects.
 */
export function parseSummaryBarChartData(text: string): SummaryBarData[] {
  if (!text || typeof text !== "string") return [];

  const bars: SummaryBarData[] = [];
  
  // Look for "Summary Bar Chart Data" section
  const sectionMatch = text.match(/##?\s*Summary\s+Bar\s+Chart\s+Data[\s\S]*?(?=##|$)/i);
  if (!sectionMatch) return [];

  const sectionText = sectionMatch[0];
  const lines = sectionText.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Match format: "Trend Name | Value"
    const match = trimmed.match(/^(.+?)\s*\|\s*(\d+(?:\.\d+)?)$/);
    if (match) {
      const trendName = match[1].trim();
      const value = Math.min(100, Math.max(0, parseFloat(match[2]) || 0));
      bars.push({ name: trendName, value });
    }
  }

  return bars;
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export async function listTrends(brandName?: string): Promise<TrendRecord[]> {
  const url = brandName
    ? `${API_BASE}?brand_name=${encodeURIComponent(brandName)}`
    : API_BASE;
  
  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** GET /api/trends/brands — distinct brand names for Filter by Brand dropdown. */
export async function listTrendBrands(): Promise<string[]> {
  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/brands`, { headers });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return Array.isArray(data.brands) ? data.brands : [];
}

export async function getTrend(id: string): Promise<TrendRecord> {
  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}?id=${encodeURIComponent(id)}`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createTrend(params: {
  brandName: string;
  fullOutput: string;
  conversationId?: string;
}): Promise<TrendRecord> {
  const token = getAuthToken();
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(API_BASE, {
    method: "POST",
    headers,
    body: JSON.stringify({
      brandName: params.brandName,
      fullOutput: params.fullOutput,
      conversationId: params.conversationId,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("createTrend failed:", res.status, errText.slice(0, 200));
    throw new Error(errText);
  }
  return res.json();
}
