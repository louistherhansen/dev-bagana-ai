"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { IconHeart, IconCheck, IconDocument } from "@/components/icons";
import { SentimentPieChart } from "@/components/SentimentPieChart";
import {
  listSentimentAnalyses,
  listSentimentBrands,
  removeHeadingSymbols,
  type SentimentAnalysisRecord,
} from "@/lib/sentimentAnalysis";

/** Parsed section: numbered header + rows (label: content). */
type FullReportSection = {
  number: number;
  header: string;
  rows: { label: string; content: string }[];
  rawLines: string[];
  bulletPoints: string[];
};

/**
 * Parse Full Report: #, ##, or "1. " as section headers, "- Key: value" as table rows.
 * Returns sections for table display.
 */
function parseFullReportToSections(text: string): FullReportSection[] {
  if (!text || typeof text !== "string") return [];
  
  // Remove ### heading symbols first (using lib function)
  let out = removeHeadingSymbols(text);
  out = out.replace(/\*\*/g, "");
  
  // Convert # (single) and ## (double) to "1. ", "2. ", ...
  let n = 1;
  // First handle ## (level 2 headings)
  out = out.replace(/^##\s+(.+)$/gm, (_, content) => {
    const line = `${n}. ${content.trim()}`;
    n += 1;
    return line;
  });
  // Then handle # (level 1 headings) - only if not already converted
  out = out.replace(/^#\s+(.+)$/gm, (match, content) => {
    // Check if this line was already processed (starts with number)
    if (/^\d+\.\s+/.test(match)) return match;
    const line = `${n}. ${content.trim()}`;
    n += 1;
    return line;
  });
  
  // Split by numbered lines (1. Header, 2. Next, ...)
  const numberedLineRe = /^(\d+)\.\s+(.+)$/gm;
  const sections: FullReportSection[] = [];
  let num = 0;
  let header = "";
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = numberedLineRe.exec(out)) !== null) {
    if (num > 0) {
      const body = out.slice(lastIndex, m.index).trim();
      const { rows, rawLines, bulletPoints } = parseSectionBody(body);
      sections.push({ number: num, header, rows, rawLines, bulletPoints });
    }
    num = parseInt(m[1], 10);
    header = m[2].trim();
    lastIndex = numberedLineRe.lastIndex;
  }
  if (num > 0) {
    const body = out.slice(lastIndex).trim();
    const { rows, rawLines, bulletPoints } = parseSectionBody(body);
    sections.push({ number: num, header, rows, rawLines, bulletPoints });
  }
  return sections;
}

/** Parse section body into rows (Label: content) and raw lines. Split only on first ": ". */
function parseSectionBody(body: string): {
  rows: { label: string; content: string }[];
  rawLines: string[];
  bulletPoints: string[];
} {
  const rows: { label: string; content: string }[] = [];
  const rawLines: string[] = [];
  const bulletPoints: string[] = [];
  const lines = body.split(/\r?\n/);
  
  for (const line of lines) {
    let trimmed = line.trim();
    if (!trimmed) continue;
    
    // Remove ### symbols from line
    trimmed = trimmed.replace(/^###\s*/g, "");
    
    // Numbered key-value (inside a section), e.g. "1. Label: Content" or "1. **Label**: Content"
    const numberedMatch = trimmed.match(/^\d+\.\s+(?:\*\*)?([^*]+?)(?:\*\*)?\s*:\s*(.+)$/);
    if (numberedMatch) {
      const label = numberedMatch[1].trim().replace(/\*\*/g, "");
      const content = numberedMatch[2].trim();
      if (label.length > 0 && label.length < 150 && content.length > 0) {
        rows.push({ label, content });
        continue;
      }
    }

    // Plain "Label: Content" (without bullet), e.g. "Key risk: Something..."
    const plainMatch = trimmed.match(/^(?:\*\*)?([^*:]+?)(?:\*\*)?\s*:\s*(.+)$/);
    if (plainMatch) {
      const label = plainMatch[1].trim().replace(/\*\*/g, "");
      const content = plainMatch[2].trim();
      if (label.length > 0 && label.length < 150 && content.length > 0) {
        rows.push({ label, content });
        continue;
      }
    }

    // Check if it's a bullet point
    if (/^[-*]\s+/.test(trimmed)) {
      const bullet = trimmed.replace(/^[-*]\s+/, "").replace(/\*\*/g, "");
      const colonIdx = bullet.indexOf(": ");
      
      // If it has ":", treat as key-value pair
      if (colonIdx > 0 && colonIdx < bullet.length - 2) {
        const label = bullet.slice(0, colonIdx).trim();
        const content = bullet.slice(colonIdx + 2).trim();
        // Only add as row if label is not too long (likely a proper key-value)
        if (label.length < 100) {
          rows.push({ label, content });
        } else {
          // If label too long, treat as bullet point
          bulletPoints.push(bullet);
        }
      } else {
        // No colon or colon at end, treat as bullet point
        bulletPoints.push(bullet);
      }
    } else {
      // Not a bullet point, add as raw line
      rawLines.push(trimmed);
    }
  }
  
  return { rows, rawLines, bulletPoints };
}

/** Platform + risk level for Brand Safety section (e.g. "YouTube (Medium)"). */
export type BrandSafetyItem = { platform: string; level: "Low" | "Medium" | "High" };

const BRAND_SAFETY_LEVELS: ("Low" | "Medium" | "High")[] = ["Low", "Medium", "High"];

/** Extract "Platform (Low|Medium|High)" from section text. */
function parseBrandSafetyData(sec: FullReportSection): BrandSafetyItem[] {
  const text = [
    ...sec.rows.map((r) => `${r.label}: ${r.content}`),
    ...sec.rawLines,
  ].join("\n");
  const re = /([A-Za-z0-9_]+)\s*\(\s*(Low|Medium|High)\s*\)/gi;
  const seen = new Set<string>();
  const items: BrandSafetyItem[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const platform = m[1].trim();
    const level = m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase() as "Low" | "Medium" | "High";
    if (level !== "Low" && level !== "Medium" && level !== "High") continue;
    const key = `${platform}-${level}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ platform, level });
  }
  return items;
}

/** Diverging Stacked Bar Chart: one row per platform, segments Low | Medium | High; filled segment by level. */
function DivergingStackedBarChart({ data }: { data: BrandSafetyItem[] }) {
  if (data.length === 0) return null;
  const barHeight = 28;
  const barWidth = 180;
  const segmentWidth = barWidth / 3;
  const colors = { Low: "rgb(34, 197, 94)", Medium: "rgb(234, 179, 8)", High: "rgb(239, 68, 68)" };
  const labelWidth = 88;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">Risk level by platform</span>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-4 rounded bg-emerald-500" /> Low
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-4 rounded bg-amber-500" /> Medium
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-4 rounded bg-red-500" /> High
          </span>
        </div>
      </div>
      <div className="space-y-2">
        {data.map(({ platform, level }, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-[88px] shrink-0 text-xs font-medium text-slate-700">{platform}</div>
            <div
              className="flex h-7 shrink-0 overflow-hidden rounded border border-slate-200 bg-white"
              style={{ width: barWidth }}
            >
              {BRAND_SAFETY_LEVELS.map((l) => (
                <div
                  key={l}
                  className="h-full border-r border-slate-200 last:border-r-0"
                  style={{
                    width: segmentWidth,
                    backgroundColor: l === level ? colors[l] : "rgb(241, 245, 249)",
                  }}
                  title={`${platform}: ${level}`}
                />
              ))}
            </div>
            <span className="text-xs text-slate-600">{level}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Full Report as attractive table(s): section headers + rows; section 2 Brand Safety gets Diverging Stacked Bar Chart. */
function FullReportTable({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sections = useMemo(() => parseFullReportToSections(text), [text]);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  const orderedSections = useMemo(() => {
    // Sort by section number ASC, keep stable order for duplicates.
    return sections
      .map((s, idx) => ({ ...s, _idx: idx }))
      .sort((a, b) => (a.number - b.number) || (a._idx - b._idx))
      .map(({ _idx, ...rest }) => rest);
  }, [sections]);

  const scrollToSection = useCallback((sectionNumber: number) => {
    const el = containerRef.current?.querySelector(
      `[data-sec="${sectionNumber}"]`
    ) as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const getSectionType = useCallback(
    (header: string): "sentiment" | "recommendations" | "risks" | "sources" | "default" => {
      const lower = header.toLowerCase();
      if (/sentiment|positive|negative|neutral/i.test(lower)) return "sentiment";
      if (/recommendation|suggestion|action|mitigation/i.test(lower)) return "recommendations";
      if (/risk|safety|concern|warning/i.test(lower)) return "risks";
      if (/source|reference/i.test(lower)) return "sources";
      return "default";
    },
    []
  );

  const takeaways = useMemo(() => {
    const picked: string[] = [];
    const prioritizedTypes: Array<ReturnType<typeof getSectionType>> = [
      "sentiment",
      "risks",
      "recommendations",
      "default",
      "sources",
    ];

    const itemsFromSection = (sec: FullReportSection): string[] => {
      const bullets = sec.bulletPoints.map((b) => b.replace(/^###\s*/g, "").trim()).filter(Boolean);
      const rows = sec.rows
        .map((r) => {
          const label = r.label.replace(/^###\s*/g, "").trim();
          const content = r.content.replace(/^###\s*/g, "").trim();
          if (!label && !content) return "";
          if (!label) return content;
          if (!content) return label;
          return `${label} — ${content}`;
        })
        .filter(Boolean);
      const merged = [...bullets, ...rows].map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
      const uniq: string[] = [];
      const seen = new Set<string>();
      for (const m of merged) {
        const key = m.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        uniq.push(m);
      }
      return uniq;
    };

    for (const t of prioritizedTypes) {
      for (const sec of orderedSections) {
        if (getSectionType(sec.header) !== t) continue;
        for (const item of itemsFromSection(sec)) {
          if (picked.length >= 8) return picked;
          if (item.length < 6) continue;
          picked.push(item.length > 180 ? `${item.slice(0, 177)}…` : item);
        }
      }
    }
    return picked.slice(0, 8);
  }, [orderedSections, getSectionType]);

  if (sections.length === 0) {
    // Remove ### symbols and ** bold markers from fallback display
    let fallback = removeHeadingSymbols(text);
    fallback = fallback.replace(/\*\*/g, "").trim();
    return (
      <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans bg-slate-50 p-4 rounded-lg border border-slate-200">
        {fallback || "—"}
      </pre>
    );
  }

  return (
    <div ref={containerRef} className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-800">Key takeaways</div>
              <div className="mt-0.5 text-xs text-slate-500">Quick summary for stakeholders</div>
            </div>
          </div>
          {takeaways.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {takeaways.map((t, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-bagana-primary" />
                  <span className="text-sm text-slate-700 leading-relaxed">{t}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 text-sm text-slate-500">No takeaways could be extracted from this report.</div>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-800">Table of contents</div>
          <div className="mt-0.5 text-xs text-slate-500">Click to jump to a section</div>
          <div className="mt-3 space-y-1.5">
            {orderedSections.map((sec) => (
              <button
                key={`${sec.number}-${sec.header}`}
                type="button"
                onClick={() => scrollToSection(sec.number)}
                className="w-full text-left rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className="font-semibold text-slate-900">{sec.number}.</span>{" "}
                <span className="line-clamp-1">{sec.header}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {orderedSections.map((sec) => {
        const sectionType = getSectionType(sec.header);
        const isBrandSafety =
          sec.number === 2 && /brand\s*safety/i.test(sec.header);
        const isMitigationActions = /recommended\s*mitigation\s*actions/i.test(sec.header);
        const parsed = parseBrandSafetyData(sec);
        const brandSafetyData = parsed;
        
        // Use bulletPoints from parsed section, or extract from rawLines as fallback
        const bulletPoints = sec.bulletPoints.length > 0 
          ? sec.bulletPoints 
          : isMitigationActions
            ? sec.rawLines
                .map((line) => {
                  const trimmed = line.trim();
                  if (/^[-*]\s+/.test(trimmed)) {
                    return trimmed.replace(/^[-*]\s+/, "").trim();
                  }
                  return null;
                })
                .filter((point): point is string => Boolean(point))
            : [];

        // Section header colors based on type
        const headerColors = {
          sentiment: "bg-blue-50 border-blue-200 text-blue-900",
          recommendations: "bg-emerald-50 border-emerald-200 text-emerald-900",
          risks: "bg-red-50 border-red-200 text-red-900",
          sources: "bg-slate-50 border-slate-200 text-slate-700",
          default: "bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200 text-slate-800",
        };

        return (
          <div
            key={`${sec.number}-${sec.header}`}
            data-sec={sec.number}
            className="overflow-hidden rounded-xl border-2 bg-white shadow-md hover:shadow-lg transition-shadow"
          >
            {/* Enhanced Section Header */}
            <div className={`border-b-2 px-5 py-3.5 ${headerColors[sectionType]}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white/80 text-xs font-bold text-slate-700 shadow-sm">
                    {sec.number}
                  </span>
                  <h5 className="text-base font-bold truncate">{sec.header}</h5>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((prev) => ({ ...prev, [sec.number]: !prev[sec.number] }))
                  }
                  className="shrink-0 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"
                >
                  {collapsed[sec.number] ? "Show" : "Hide"}
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="overflow-x-auto bg-white">
              {collapsed[sec.number] ? (
                <div className="p-5 text-sm text-slate-500">This section is hidden.</div>
              ) : isBrandSafety && brandSafetyData.length > 0 ? (
                <div className="p-4">
                  <DivergingStackedBarChart data={brandSafetyData} />
                </div>
              ) : isBrandSafety && brandSafetyData.length === 0 ? (
                <div className="p-5">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    No brand-safety items could be parsed from this report. If the agent output does not follow the format
                    <span className="font-semibold"> Platform (Low/Medium/High)</span>, the chart will not be shown.
                  </div>
                  <div className="mt-4">
                    <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans bg-slate-50 p-4 rounded-lg border border-slate-200">
                      {removeHeadingSymbols(text).replace(/\*\*/g, "").trim() || "—"}
                    </pre>
                  </div>
                </div>
              ) : (bulletPoints.length > 0 || sec.rows.length > 0 || sec.rawLines.length > 0) ? (
                <div className="p-0">
                  {(() => {
                    const accent =
                      sectionType === "recommendations"
                        ? "bg-emerald-500"
                        : sectionType === "risks"
                        ? "bg-red-500"
                        : sectionType === "sentiment"
                        ? "bg-blue-500"
                        : "bg-bagana-primary";

                    const parseBulletKV = (point: string): { label: string; content: string } | null => {
                      const cleaned = point.replace(/^###\s*/g, "").trim();
                      const colonIdx = cleaned.indexOf(": ");
                      if (!(colonIdx > 0 && colonIdx < cleaned.length - 2)) return null;
                      const label = cleaned.slice(0, colonIdx).trim();
                      const content = cleaned.slice(colonIdx + 2).trim();
                      if (!label || !content) return null;
                      if (label.length > 120) return null;
                      return { label, content };
                    };

                    const bulletKVs: Array<{ label: string; content: string; _i: number }> = [];
                    const bulletPlain: Array<{ text: string; _i: number }> = [];
                    bulletPoints.forEach((p, idx) => {
                      const kv = parseBulletKV(p);
                      if (kv) bulletKVs.push({ ...kv, _i: idx });
                      else {
                        const txt = p.replace(/^###\s*/g, "").trim();
                        if (txt) bulletPlain.push({ text: txt, _i: idx });
                      }
                    });

                    const rows = sec.rows
                      .map((r) => ({
                        label: r.label.replace(/^###\s*/g, "").trim(),
                        content: r.content.replace(/^###\s*/g, "").trim(),
                      }))
                      .filter((r) => r.label && r.content);

                    const raw = sec.rawLines
                      .map((r) => r.replace(/^###\s*/g, "").trim())
                      .filter(Boolean);

                    const hasAnyKeyValue = bulletKVs.length > 0 || rows.length > 0;

                    // If there is no key-value structure, render as a clean list (more professional than a 2-col table).
                    if (!hasAnyKeyValue) {
                      const items = [...bulletPlain.map((b) => b.text), ...raw].filter(Boolean);
                      return (
                        <div className="p-5">
                          {items.length > 0 ? (
                            <ul className="space-y-2.5">
                              {items.map((t, i) => (
                                <li key={i} className="flex items-start gap-3">
                                  <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${accent}`} />
                                  <span className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                    {t}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-sm text-slate-500 italic">—</div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b-2 border-slate-300">
                            <th className="w-64 min-w-[200px] px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                              Poin
                            </th>
                            <th className="px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                              Deskripsi
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulletKVs.map((kv, i) => (
                            <tr
                              key={`bkv-${kv._i}`}
                              className={`border-b border-slate-200 last:border-0 transition-all hover:bg-blue-50/50 ${
                                i % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                              }`}
                            >
                              <td className="w-64 min-w-[200px] px-5 py-4 align-top">
                                <div className="flex items-start gap-2.5">
                                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${accent}`} />
                                  <span className="font-bold text-slate-900 text-sm leading-tight">{kv.label}</span>
                                </div>
                              </td>
                              <td className="px-5 py-4 align-top">
                                <span className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                  {kv.content}
                                </span>
                              </td>
                            </tr>
                          ))}

                          {/* Non-key-value bullets are still useful: show as full-width rows without implying a 2-col structure */}
                          {bulletPlain.map((b, i) => (
                            <tr
                              key={`bplain-${b._i}`}
                              className={`border-b border-slate-200 last:border-0 transition-all hover:bg-blue-50/50 ${
                                (bulletKVs.length + i) % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                              }`}
                            >
                              <td colSpan={2} className="px-5 py-4">
                                <div className="flex items-start gap-3">
                                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${accent}`} />
                                  <span className="flex-1 leading-relaxed text-sm text-slate-700 font-medium whitespace-pre-wrap">
                                    {b.text}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}

                          {rows.map((r, i) => (
                            <tr
                              key={`row-${i}`}
                              className={`border-b border-slate-200 last:border-0 transition-all hover:bg-blue-50/50 ${
                                (bulletKVs.length + bulletPlain.length + i) % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                              }`}
                            >
                              <td className="w-64 min-w-[200px] px-5 py-4 align-top">
                                <div className="flex items-start gap-2.5">
                                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-bagana-primary" />
                                  <span className="font-bold text-slate-900 text-sm leading-tight">{r.label}</span>
                                </div>
                              </td>
                              <td className="px-5 py-4 align-top">
                                <span className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                  {r.content}
                                </span>
                              </td>
                            </tr>
                          ))}

                          {raw.map((t, i) => (
                            <tr
                              key={`raw-${i}`}
                              className={`border-b border-slate-200 last:border-0 transition-all hover:bg-blue-50/50 ${
                                (bulletKVs.length + bulletPlain.length + rows.length + i) % 2 === 0
                                  ? "bg-white"
                                  : "bg-slate-50/30"
                              }`}
                            >
                              <td colSpan={2} className="px-5 py-4">
                                <span className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{t}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              ) : (
                <div className="p-5 text-center">
                  <p className="text-sm text-slate-400 italic">—</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SentimentAnalysisView() {
  const [history, setHistory] = useState<SentimentAnalysisRecord[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [selected, setSelected] = useState<SentimentAnalysisRecord | null>(null);
  const [filterBrand, setFilterBrand] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [sort, setSort] = useState<"recent" | "brand" | "risk">("recent");
  const pageSize = 10;
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBrands = useCallback(async () => {
    setBrandsLoading(true);
    try {
      const list = await listSentimentBrands();
      setBrands(list);
    } catch (e) {
      console.error("Failed to load brands:", e);
      setBrands([]);
    } finally {
      setBrandsLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listSentimentAnalyses(filterBrand.trim() || undefined);
      setHistory(list);
      setPage(1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load history";
      setError(msg);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [filterBrand]);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const onCrewSaveDone = () => loadHistory();
    window.addEventListener("crew-save-done", onCrewSaveDone);
    return () => window.removeEventListener("crew-save-done", onCrewSaveDone);
  }, [loadHistory]);

  const handleRefresh = useCallback(() => {
    setError(null);
    loadBrands();
    loadHistory();
  }, [loadBrands, loadHistory]);

  const normalize = (s: string | undefined | null) => (s || "").toLowerCase().trim();

  const filteredHistory = useMemo(() => {
    const q = normalize(search);
    let list = [...history];
    if (q) {
      list = list.filter((r) => {
        const hay = [r.brandName, r.fullOutput].filter(Boolean).join(" ");
        return normalize(hay).includes(q);
      });
    }
    if (sort === "brand") {
      list.sort((a, b) => normalize(a.brandName).localeCompare(normalize(b.brandName)));
    } else if (sort === "risk") {
      list.sort((a, b) => (b.negativePct || 0) - (a.negativePct || 0));
    } else {
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    return list;
  }, [history, search, sort]);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBrand, search, sort]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredHistory.length / pageSize)),
    [filteredHistory.length]
  );

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const pagedHistory = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredHistory.slice(start, start + pageSize);
  }, [filteredHistory, page]);

  const downloadTextFile = (filename: string, content: string, mime = "text/plain;charset=utf-8") => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportSelected = (format: "md" | "json") => {
    if (!selected) return;
    const safeName = (selected.brandName || "sentiment")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 50);
    const ts = new Date(selected.createdAt || Date.now()).toISOString().replace(/[:.]/g, "-");
    if (format === "json") {
      downloadTextFile(
        `bagana-sentiment-${safeName}-${ts}.json`,
        JSON.stringify(selected, null, 2),
        "application/json;charset=utf-8"
      );
      return;
    }
    downloadTextFile(
      `bagana-sentiment-${safeName}-${ts}.md`,
      (selected.fullOutput || "").trim(),
      "text/markdown;charset=utf-8"
    );
  };

  const copySummary = async () => {
    if (!selected) return;
    const lines: string[] = [];
    lines.push(`Brand: ${selected.brandName}`);
    lines.push(`Sentiment: +${selected.positivePct}% / ${selected.neutralPct}% / -${selected.negativePct}%`);
    lines.push(`Created: ${new Date(selected.createdAt).toLocaleString()}`);
    const txt = lines.join("\n");
    try {
      await navigator.clipboard.writeText(txt);
    } catch {
      const el = document.createElement("textarea");
      el.value = txt;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">Sentiment Analysis</h2>
          <p className="text-sm text-slate-600">Review sentiment composition and risk notes. Export for stakeholders.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || brandsLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Refresh
          </button>
          <Link
            href="/chat"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-bagana-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-bagana-secondary transition-colors"
          >
            {IconHeart}
            Generate via Chat
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-4">
          <div className="space-y-1">
            <h3 className="font-semibold text-slate-800">History</h3>
            <p className="text-xs text-slate-500">
              Showing page {page} of {totalPages} • {filteredHistory.length} items
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:max-w-3xl">
            <div>
              <label htmlFor="filter-brand" className="block text-xs font-medium text-slate-700 mb-1">
                Brand
              </label>
              <select
                id="filter-brand"
                value={filterBrand}
                onChange={(e) => setFilterBrand(e.target.value)}
                disabled={brandsLoading}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-bagana-primary focus:outline-none focus:ring-1 focus:ring-bagana-primary/20 disabled:opacity-60"
              >
                <option value="">All brands</option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="search-sentiment" className="block text-xs font-medium text-slate-700 mb-1">
                Search
              </label>
              <input
                id="search-sentiment"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Brand / keyword…"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-bagana-primary focus:outline-none focus:ring-1 focus:ring-bagana-primary/20"
              />
            </div>
            <div>
              <label htmlFor="sort-sentiment" className="block text-xs font-medium text-slate-700 mb-1">
                Sort
              </label>
              <select
                id="sort-sentiment"
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-bagana-primary focus:outline-none focus:ring-1 focus:ring-bagana-primary/20"
              >
                <option value="recent">Most recent</option>
                <option value="brand">Brand (A–Z)</option>
                <option value="risk">Highest risk (negative%)</option>
              </select>
            </div>
          </div>
        </div>

        {brands.length === 0 && !brandsLoading && !error && (
          <p className="mt-1 text-xs text-slate-500">No data yet. Run the crew in Chat, then click Refresh.</p>
        )}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4 animate-pulse">
                <div className="h-4 w-1/2 bg-slate-200 rounded" />
                <div className="mt-3 h-3 w-2/3 bg-slate-200 rounded" />
                <div className="mt-4 h-10 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className="py-4 rounded-lg bg-red-50 text-red-700 text-sm px-4">
            {error}
            <p className="mt-2 text-xs">Pastikan database berjalan dan tabel sentiment_analyses ada (script: scripts/init-sentiment-db.py).</p>
          </div>
        )}
        {!loading && !error && history.length === 0 && (
          <div className="py-8 text-center text-slate-500 text-sm">
            No sentiment results yet. Generate from Chat (the crew will save automatically).
          </div>
        )}
        {!loading && !error && filteredHistory.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {pagedHistory.map((item) => {
                const isSelected = selected?.id === item.id;
                const risk =
                  item.negativePct >= 35 ? "High" : item.negativePct >= 20 ? "Medium" : "Low";
                const riskStyle =
                  risk === "High"
                    ? "bg-red-100 text-red-800"
                    : risk === "Medium"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800";
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelected(isSelected ? null : item)}
                    className={`text-left rounded-2xl border p-4 transition-colors hover:bg-slate-50 ${
                      isSelected ? "border-bagana-primary bg-bagana-primary/5" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{item.brandName}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {new Date(item.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${riskStyle}`}>{risk} risk</span>
                    </div>
                    <div className="mt-4">
                      <SentimentPieChart
                        positivePct={item.positivePct}
                        neutralPct={item.neutralPct}
                        negativePct={item.negativePct}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-emerald-800">+ {item.positivePct}%</span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">• {item.neutralPct}%</span>
                      <span className="rounded-md bg-red-100 px-2 py-0.5 text-red-800">- {item.negativePct}%</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {filteredHistory.length > pageSize && (
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Prev
                </button>
                <div className="text-xs text-slate-500">
                  Page <span className="font-semibold text-slate-700">{page}</span> /{" "}
                  <span className="font-semibold text-slate-700">{totalPages}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected: Pie Chart + full output */}
      {selected && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 truncate">Sentiment — {selected.brandName}</h3>
              <div className="mt-1 text-xs text-slate-500">
                {new Date(selected.createdAt).toLocaleString()}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => copySummary()}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Copy summary
              </button>
              <button
                type="button"
                onClick={() => exportSelected("md")}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Export .md
              </button>
              <button
                type="button"
                onClick={() => exportSelected("json")}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Export .json
              </button>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>

          <div className="flex justify-center">
            <SentimentPieChart
              positivePct={selected.positivePct}
              neutralPct={selected.neutralPct}
              negativePct={selected.negativePct}
              size={220}
            />
          </div>
          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
              {IconDocument}
              Full Report (sentiment_analyst)
            </h4>
            <div className="max-h-[28rem] overflow-y-auto">
              <FullReportTable text={selected.fullOutput || ""} />
            </div>
          </div>
        </div>
      )}

      {!selected && history.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 sm:p-12 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-bagana-muted/50 text-bagana-primary mb-4">
            {IconHeart}
          </div>
          <h3 className="font-semibold text-slate-800 mb-1">No analysis yet</h3>
          <p className="text-sm text-slate-600 mb-4 max-w-sm mx-auto">
            Hasil dari agent sentiment_analyst (CrewAI) akan tersimpan otomatis setelah Anda menjalankan crew dari Chat. Buka Chat, kirim brief kampanye, lalu kembali ke halaman ini untuk melihat history dan Pie Chart.
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-bagana-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-bagana-secondary transition-colors"
          >
            {IconHeart}
            Buka Chat
          </Link>
        </div>
      )}
    </div>
  );
}
