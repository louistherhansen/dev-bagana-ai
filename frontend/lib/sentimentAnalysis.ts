/**
 * Sentiment Analysis API client
 * Results from sentiment_analyst CrewAI agent, stored by brand_name.
 * 
 * Template reference: project-context/2.build/artifacts/sentiment_risk.md
 * The sentiment composition format follows the template structure:
 *   - First line: "Sentiment Composition (Pie Chart): Positive X%, Neutral Y%, Negative Z%"
 *   - Followed by: "# Sentiment and Risk Analysis Report for [Brand Name]"
 *   - Then structured sections: Sentiment Summary, Identified Risks, Risk Mitigation Strategies, etc.
 */

const API_BASE = "/api/sentiment-analysis";

export interface SentimentAnalysisRecord {
  id: string;
  brandName: string;
  positivePct: number;
  negativePct: number;
  neutralPct: number;
  fullOutput: string;
  conversationId?: string;
  createdAt: number;
}

/**
 * Parse "Sentiment Composition (Pie Chart): Positive X%, Neutral Y%, Negative Z%" from text.
 * 
 * Template format (from sentiment_risk.md):
 *   "Sentiment Composition (Pie Chart): Positive 25%, Neutral 60%, Negative 15%"
 * 
 * This line MUST be the first line of the sentiment analysis output, before any headings.
 * 
 * Accepts:
 * - English: Positive, Neutral, Negative
 * - Indonesian: Positif, Netral, Negatif
 * 
 * Returns { positivePct, neutralPct, negativePct } or null if not found.
 * Percentages are clamped to 0-100 range.
 * 
 * @param text - Full sentiment analysis output text (should start with Pie Chart line)
 * @returns Object with positivePct, neutralPct, negativePct (0-100) or null if not found
 * 
 * @example
 * ```typescript
 * const output = `Sentiment Composition (Pie Chart): Positive 25%, Neutral 60%, Negative 15%
 * 
 * # Sentiment and Risk Analysis Report for UCloud
 * ...`;
 * 
 * const result = parseSentimentComposition(output);
 * // Returns: { positivePct: 25, neutralPct: 60, negativePct: 15 }
 * ```
 */
export function parseSentimentComposition(text: string): {
  positivePct: number;
  neutralPct: number;
  negativePct: number;
} | null {
  if (!text || typeof text !== "string") return null;
  
  // Match: Sentiment Composition (Pie Chart): Positive 60%, Neutral 30%, Negative 10%
  // Also accepts: Positif, Netral, Negatif (Indonesian)
  // Format: "Sentiment Composition (Pie Chart): Positive X%, Neutral Y%, Negative Z%"
  // This should be the first line per sentiment_risk.md template
  const re = /Sentiment Composition\s*\([^)]*\)\s*:\s*(?:Positive|Positif)\s*(\d+(?:\.\d+)?)\s*%?\s*,?\s*(?:Neutral|Netral)\s*(\d+(?:\.\d+)?)\s*%?\s*,?\s*(?:Negative|Negatif)\s*(\d+(?:\.\d+)?)\s*%?/i;
  
  const m = text.match(re);
  if (!m) return null;
  
  // Parse and clamp percentages to 0-100 range
  const positivePct = Math.min(100, Math.max(0, parseFloat(m[1]) || 0));
  const neutralPct = Math.min(100, Math.max(0, parseFloat(m[2]) || 0));
  const negativePct = Math.min(100, Math.max(0, parseFloat(m[3]) || 0));
  
  return { positivePct, neutralPct, negativePct };
}

/**
 * Remove markdown heading symbols (###) from Full Report text.
 * This cleans up the sentiment analysis output by removing level 3 heading markers.
 * 
 * @param text - Full sentiment analysis output text
 * @returns Text with ### symbols removed (replaced with plain text)
 * 
 * @example
 * ```typescript
 * const output = `### Key Positive Sentiment Drivers:
 * - Item 1`;
 * 
 * const cleaned = removeHeadingSymbols(output);
 * // Returns: "Key Positive Sentiment Drivers:\n- Item 1"
 * ```
 */
export function removeHeadingSymbols(text: string): string {
  if (!text || typeof text !== "string") return text;
  
  // Remove ### (level 3 headings) - replace with plain text
  // Handles: ### Heading, ###Heading, ###  Heading (with multiple spaces)
  return text.replace(/^###\s*(.+)$/gm, "$1");
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function readErrorText(res: Response): Promise<string> {
  try {
    const txt = await res.text();
    const raw = txt?.trim() ? txt.trim() : `HTTP ${res.status}`;
    // Try to unwrap JSON error payloads: {error:"..."}
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && typeof (parsed as any).error === "string") {
        return (parsed as any).error;
      }
    } catch {
      /* ignore */
    }
    return raw;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function listSentimentAnalyses(brandName?: string): Promise<SentimentAnalysisRecord[]> {
  const url = brandName
    ? `${API_BASE}?brand_name=${encodeURIComponent(brandName)}`
    : API_BASE;
  
  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers, credentials: "include" });
  if (!res.ok) throw new Error(await readErrorText(res));
  return res.json();
}

/** GET /api/sentiment-analysis/brands — distinct brand names for Filter by Brand dropdown. */
export async function listSentimentBrands(): Promise<string[]> {
  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/brands`, { headers, credentials: "include" });
  if (!res.ok) throw new Error(await readErrorText(res));
  const data = await res.json();
  if (Array.isArray(data?.brands)) return data.brands;
  if (Array.isArray(data)) return data;
  return [];
}

export async function getSentimentAnalysis(id: string): Promise<SentimentAnalysisRecord> {
  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}?id=${encodeURIComponent(id)}`, { headers, credentials: "include" });
  if (!res.ok) throw new Error(await readErrorText(res));
  return res.json();
}

export async function createSentimentAnalysis(params: {
  brandName: string;
  positivePct: number;
  negativePct: number;
  neutralPct: number;
  fullOutput: string;
  conversationId?: string;
}): Promise<SentimentAnalysisRecord> {
  const token = getAuthToken();
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(API_BASE, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({
      brandName: params.brandName,
      positivePct: params.positivePct,
      negativePct: params.negativePct,
      neutralPct: params.neutralPct,
      fullOutput: params.fullOutput,
      conversationId: params.conversationId,
    }),
  });
  if (!res.ok) {
    const errText = await readErrorText(res);
    console.error("createSentimentAnalysis failed:", res.status, errText.slice(0, 200));
    throw new Error(errText);
  }
  return res.json();
}
