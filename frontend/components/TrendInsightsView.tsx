"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { IconTrending, IconGlobe, IconCheck } from "@/components/icons";
import {
  listTrends,
  listTrendBrands,
  parseTrendLineChartData,
  parseSummaryBarChartData,
  type TrendRecord,
} from "@/lib/trends";
import { TrendBarChart } from "@/components/TrendBarChart";
import { SummaryBarChart } from "@/components/SummaryBarChart";

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
  let out = text.replace(/\*\*/g, "");
  
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
  out = out.replace(/^###\s+(.+)$/gm, "   $1");
  
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
    
    // Check if it's a numbered list item: "1. **Label**: Content" or "1. Label: Content"
    // Pattern: number. **bold text**: description or number. text: description
    const numberedMatch = trimmed.match(/^\d+\.\s+(?:\*\*)?([^*]+?)(?:\*\*)?\s*:\s*(.+)$/);
    if (numberedMatch) {
      const label = numberedMatch[1].trim().replace(/\*\*/g, "");
      const content = numberedMatch[2].trim();
      if (label.length < 100 && content.length > 0) {
        rows.push({ label, content });
        continue;
      }
    }
    
    // Check if it's a plain "Label: Description" format (without number or bullet)
    // Pattern: **Label**: Description or Label: Description
    // This handles formats like "Culture and Attention Shifts: Description"
    const plainLabelMatch = trimmed.match(/^(?:\*\*)?([^*:]+?)(?:\*\*)?\s*:\s*(.+)$/);
    if (plainLabelMatch) {
      const label = plainLabelMatch[1].trim().replace(/\*\*/g, "");
      const content = plainLabelMatch[2].trim();
      // Only treat as key-value if label is reasonable length and content exists
      if (label.length > 0 && label.length < 150 && content.length > 0) {
        rows.push({ label, content });
        continue;
      }
    }
    
    // Check if it's a bullet point
    if (/^[-*]\s+/.test(trimmed)) {
      const bullet = trimmed.replace(/^[-*]\s+/, "");
      const colonIdx = bullet.indexOf(": ");
      
      // If it has ":", treat as key-value pair
      if (colonIdx > 0 && colonIdx < bullet.length - 2) {
        const label = bullet.slice(0, colonIdx).trim().replace(/\*\*/g, "");
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
      // Check if it's Summary Bar Chart Data format: "Trend Name | Value"
      const barChartMatch = trimmed.match(/^(.+?)\s*\|\s*(\d+(?:\.\d+)?)$/);
      if (barChartMatch) {
        const trendName = barChartMatch[1].trim();
        const value = barChartMatch[2].trim();
        rows.push({ label: trendName, content: `${value} (trend strength)` });
      } else {
        // Not a bullet point, add as raw line
        rawLines.push(trimmed);
      }
    }
  }
  
  return { rows, rawLines, bulletPoints };
}

/** Full Report as attractive table(s): section headers + rows with enhanced styling. */
function FullReportTable({ text }: { text: string }) {
  const sections = parseFullReportToSections(text);
  if (sections.length === 0) {
    const fallback = text.replace(/\*\*/g, "").trim();
    return (
      <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans bg-slate-50 p-4 rounded-lg border border-slate-200">
        {fallback || "—"}
      </pre>
    );
  }

  // Determine section type for special styling based on expected headers
  const getSectionType = (header: string): "trends" | "recommendations" | "insights" | "sources" | "barChart" | "competitive" | "contentFormat" | "timing" | "implications" | "audit" | "default" => {
    const lower = header.toLowerCase().trim();
    
    // Exact matches for known headers
    if (/^key\s+market\s+trends?$/i.test(lower)) return "trends";
    if (/^summary\s+bar\s+chart\s+data$/i.test(lower)) return "barChart";
    if (/^creator\s+economy\s+insights?$/i.test(lower)) return "insights";
    if (/^competitive\s+landscape$/i.test(lower)) return "competitive";
    if (/^content\s+format\s+trends?$/i.test(lower)) return "contentFormat";
    if (/^timing\s+and\s+seasonality$/i.test(lower)) return "timing";
    if (/^implications\s+for\s+strategy$/i.test(lower)) return "implications";
    if (/^recommendations?$/i.test(lower)) return "recommendations";
    if (/^sources?$/i.test(lower)) return "sources";
    if (/^audit$/i.test(lower)) return "audit";
    
    // Fallback pattern matching
    if (/summary.*bar.*chart/i.test(lower)) return "barChart";
    if (/key.*market.*trend/i.test(lower)) return "trends";
    if (/recommendation|suggestion|action/i.test(lower)) return "recommendations";
    if (/insight|implication|strategy/i.test(lower)) return "insights";
    if (/source|reference/i.test(lower)) return "sources";
    if (/competitive|landscape/i.test(lower)) return "competitive";
    if (/content.*format|format.*trend/i.test(lower)) return "contentFormat";
    if (/timing|seasonality/i.test(lower)) return "timing";
    if (/audit/i.test(lower)) return "audit";
    
    return "default";
  };

  return (
    <div className="space-y-5">
      {sections.map((sec) => {
        const sectionType = getSectionType(sec.header);
        
        // Use bulletPoints from parsed section, or extract from rawLines as fallback
        const bulletPoints = sec.bulletPoints.length > 0 
          ? sec.bulletPoints 
          : sec.rawLines
              .map((line) => {
                const trimmed = line.trim();
                if (/^[-*]\s+/.test(trimmed)) {
                  return trimmed.replace(/^[-*]\s+/, "").trim();
                }
                return null;
              })
              .filter((point): point is string => Boolean(point));

        // Section header colors - semua header menggunakan warna yang sama
        const headerColor = "bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200 text-slate-800";

        // Get bullet point color based on section type
        const getBulletColor = (type: string): string => {
          switch (type) {
            case "trends": return "bg-amber-500 ring-2 ring-amber-200";
            case "barChart": return "bg-amber-500 ring-2 ring-amber-200";
            case "insights": return "bg-purple-500 ring-2 ring-purple-200";
            case "competitive": return "bg-blue-500 ring-2 ring-blue-200";
            case "contentFormat": return "bg-indigo-500 ring-2 ring-indigo-200";
            case "timing": return "bg-teal-500 ring-2 ring-teal-200";
            case "implications": return "bg-violet-500 ring-2 ring-violet-200";
            case "recommendations": return "bg-emerald-500 ring-2 ring-emerald-200";
            case "sources": return "bg-slate-500 ring-2 ring-slate-200";
            case "audit": return "bg-gray-500 ring-2 ring-gray-200";
            default: return "bg-blue-500 ring-2 ring-blue-200";
          }
        };

        // Get cell background colors based on section type
        const getCellColors = (type: string, isEven: boolean): string => {
          const baseColors: Record<string, { even: string; odd: string; hover: string }> = {
            trends: { even: "bg-white", odd: "bg-amber-50/30", hover: "hover:bg-amber-50/50" },
            barChart: { even: "bg-white", odd: "bg-amber-50/30", hover: "hover:bg-amber-50/50" },
            insights: { even: "bg-white", odd: "bg-purple-50/30", hover: "hover:bg-purple-50/50" },
            competitive: { even: "bg-white", odd: "bg-blue-50/30", hover: "hover:bg-blue-50/50" },
            contentFormat: { even: "bg-white", odd: "bg-indigo-50/30", hover: "hover:bg-indigo-50/50" },
            timing: { even: "bg-white", odd: "bg-teal-50/30", hover: "hover:bg-teal-50/50" },
            implications: { even: "bg-white", odd: "bg-violet-50/30", hover: "hover:bg-violet-50/50" },
            recommendations: { even: "bg-white", odd: "bg-emerald-50/30", hover: "hover:bg-emerald-50/50" },
            sources: { even: "bg-white", odd: "bg-slate-50/30", hover: "hover:bg-slate-50/50" },
            audit: { even: "bg-white", odd: "bg-gray-50/30", hover: "hover:bg-gray-50/50" },
            default: { even: "bg-white", odd: "bg-slate-50/30", hover: "hover:bg-slate-50/50" },
          };
          const colors = baseColors[type] || baseColors.default;
          return `${isEven ? colors.even : colors.odd} ${colors.hover}`;
        };

        return (
          <div
            key={sec.number}
            className="overflow-hidden rounded-xl border-2 bg-white shadow-lg hover:shadow-xl transition-all duration-200"
          >
            {/* Enhanced Section Header */}
            <div className={`border-b-2 px-6 py-4 ${headerColor}`}>
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/90 text-sm font-bold text-slate-700 shadow-md ring-1 ring-slate-200/50">
                  {sec.number}
                </span>
                <h5 className="text-base font-bold text-slate-800 tracking-tight">
                  {sec.header}
                </h5>
              </div>
            </div>

            {/* Content Area */}
            <div className="overflow-x-auto bg-white">
              {/* Show as table if we have bullet points, regular rows, or raw lines */}
              {(bulletPoints.length > 0 || sec.rows.length > 0 || sec.rawLines.length > 0) ? (
                <div className="p-0">
                  <table className="w-full text-sm border-collapse table-auto">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-slate-300 border-b-2">
                        <th className="w-64 min-w-[200px] px-6 py-4 text-left text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Item
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Render bullet points as table rows */}
                      {bulletPoints.map((point, i) => {
                        const colonIdx = point.indexOf(": ");
                        const hasKeyValue = colonIdx > 0 && colonIdx < point.length - 2;
                        
                        if (hasKeyValue) {
                          const label = point.slice(0, colonIdx).trim();
                          const content = point.slice(colonIdx + 2).trim();
                          return (
                            <tr
                              key={`bullet-${i}`}
                              className={`border-b border-slate-200/60 last:border-0 transition-all duration-150 hover:shadow-sm ${getCellColors(sectionType, i % 2 === 0)}`}
                            >
                              <td className="w-64 min-w-[200px] px-6 py-4 align-top">
                                <div className="flex items-start gap-3">
                                  <span
                                    className={`mt-1.5 h-3 w-3 shrink-0 rounded-full shadow-sm ${getBulletColor(sectionType)}`}
                                  />
                                  <span className="font-semibold text-slate-900 text-sm leading-relaxed">
                                    {label}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 align-top">
                                <span className="text-sm text-slate-700 leading-relaxed">
                                  {content}
                                </span>
                              </td>
                            </tr>
                          );
                        } else {
                          // Regular bullet point - span full width
                          return (
                            <tr
                              key={`bullet-${i}`}
                              className={`border-b border-slate-200/60 last:border-0 transition-all duration-150 hover:shadow-sm ${getCellColors(sectionType, i % 2 === 0)}`}
                            >
                              <td colSpan={2} className="px-6 py-4">
                                <div className="flex items-start gap-3">
                                  <span
                                    className={`mt-1.5 h-3 w-3 shrink-0 rounded-full shadow-sm ${getBulletColor(sectionType)}`}
                                  />
                                  <span className="flex-1 leading-relaxed text-sm text-slate-700">
                                    {point}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                      })}
                      
                      {/* Render regular rows */}
                      {sec.rows.map((row, i) => (
                        <tr
                          key={`row-${i}`}
                          className={`border-b border-slate-200/60 last:border-0 transition-all duration-150 hover:shadow-sm ${getCellColors(sectionType, (bulletPoints.length + i) % 2 === 0)}`}
                        >
                          <td className="w-64 min-w-[200px] px-6 py-4 align-top">
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-1.5 h-3 w-3 shrink-0 rounded-full shadow-sm ${getBulletColor(sectionType)}`}
                              />
                              <span className="font-semibold text-slate-900 text-sm leading-relaxed">
                                {row.label}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 align-top">
                            <span className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                              {row.content}
                            </span>
                          </td>
                        </tr>
                      ))}
                      
                      {/* Render raw lines */}
                      {sec.rawLines.map((raw, i) => (
                        <tr
                          key={`raw-${i}`}
                          className={`border-b border-slate-200/60 last:border-0 transition-all duration-150 hover:shadow-sm ${getCellColors(sectionType, (bulletPoints.length + sec.rows.length + i) % 2 === 0)}`}
                        >
                          <td colSpan={2} className="px-6 py-4">
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-1.5 h-3 w-3 shrink-0 rounded-full shadow-sm ${getBulletColor(sectionType)}`}
                              />
                              <span className="flex-1 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {raw}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

function FullReportTablePro({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sections = useMemo(() => parseFullReportToSections(text), [text]);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  const orderedSections = useMemo(() => {
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
    (
      header: string
    ):
      | "trends"
      | "recommendations"
      | "insights"
      | "sources"
      | "barChart"
      | "competitive"
      | "contentFormat"
      | "timing"
      | "implications"
      | "audit"
      | "default" => {
      const lower = header.toLowerCase().trim();
      if (/^key\s+market\s+trends?$/i.test(lower)) return "trends";
      if (/^summary\s+bar\s+chart\s+data$/i.test(lower)) return "barChart";
      if (/^trend\s+line\s+chart\s+data$/i.test(lower)) return "barChart";
      if (/^creator\s+economy\s+insights?$/i.test(lower)) return "insights";
      if (/^competitive\s+landscape$/i.test(lower)) return "competitive";
      if (/^content\s+format\s+trends?$/i.test(lower)) return "contentFormat";
      if (/^timing\s+and\s+seasonality$/i.test(lower)) return "timing";
      if (/^implications\s+for\s+strategy$/i.test(lower)) return "implications";
      if (/^recommendations?$/i.test(lower)) return "recommendations";
      if (/^sources?$/i.test(lower)) return "sources";
      if (/^audit$/i.test(lower)) return "audit";
      if (/summary.*bar.*chart/i.test(lower)) return "barChart";
      if (/trend.*line.*chart/i.test(lower)) return "barChart";
      if (/key.*market.*trend/i.test(lower)) return "trends";
      if (/recommendation|suggestion|action/i.test(lower)) return "recommendations";
      if (/insight|implication|strategy/i.test(lower)) return "insights";
      if (/source|reference/i.test(lower)) return "sources";
      if (/competitive|landscape/i.test(lower)) return "competitive";
      if (/content.*format|format.*trend/i.test(lower)) return "contentFormat";
      if (/timing|seasonality/i.test(lower)) return "timing";
      if (/audit/i.test(lower)) return "audit";
      return "default";
    },
    []
  );

  const takeaways = useMemo(() => {
    const picked: string[] = [];
    const prioritized: Array<ReturnType<typeof getSectionType>> = [
      "trends",
      "implications",
      "recommendations",
      "insights",
      "competitive",
      "contentFormat",
      "timing",
      "default",
    ];

    const itemsFromSection = (sec: FullReportSection): string[] => {
      if (getSectionType(sec.header) === "barChart") return [];
      const bullets = sec.bulletPoints
        .map((b) => b.replace(/^###\s*/g, "").trim())
        .filter(Boolean);
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
      const merged = [...bullets, ...rows]
        .map((s) => s.replace(/\s+/g, " ").trim())
        .filter(Boolean);
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

    for (const t of prioritized) {
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

  if (orderedSections.length === 0) {
    const fallback = text.replace(/\*\*/g, "").trim();
    return (
      <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans bg-slate-50 p-4 rounded-lg border border-slate-200">
        {fallback || "—"}
      </pre>
    );
  }

  const headerColors: Record<ReturnType<typeof getSectionType>, string> = {
    trends: "bg-amber-50 border-amber-200 text-amber-900",
    barChart: "bg-amber-50 border-amber-200 text-amber-900",
    insights: "bg-purple-50 border-purple-200 text-purple-900",
    competitive: "bg-blue-50 border-blue-200 text-blue-900",
    contentFormat: "bg-indigo-50 border-indigo-200 text-indigo-900",
    timing: "bg-teal-50 border-teal-200 text-teal-900",
    implications: "bg-violet-50 border-violet-200 text-violet-900",
    recommendations: "bg-emerald-50 border-emerald-200 text-emerald-900",
    sources: "bg-slate-50 border-slate-200 text-slate-700",
    audit: "bg-slate-50 border-slate-200 text-slate-700",
    default: "bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200 text-slate-800",
  };

  const accentDot = (type: ReturnType<typeof getSectionType>) => {
    switch (type) {
      case "trends":
      case "barChart":
        return "bg-amber-500";
      case "insights":
        return "bg-purple-500";
      case "competitive":
        return "bg-blue-500";
      case "contentFormat":
        return "bg-indigo-500";
      case "timing":
        return "bg-teal-500";
      case "implications":
        return "bg-violet-500";
      case "recommendations":
        return "bg-emerald-500";
      case "sources":
      case "audit":
        return "bg-slate-500";
      default:
        return "bg-bagana-primary";
    }
  };

  return (
    <div ref={containerRef} className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="text-sm font-semibold text-slate-800">Key takeaways</div>
          <div className="mt-0.5 text-xs text-slate-500">Quick summary for stakeholders</div>
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
        const accent = accentDot(sectionType);

        const bulletPoints =
          sec.bulletPoints.length > 0
            ? sec.bulletPoints
            : sec.rawLines
                .map((line) => {
                  const trimmed = line.trim();
                  if (/^[-*]\s+/.test(trimmed)) return trimmed.replace(/^[-*]\s+/, "").trim();
                  return null;
                })
                .filter((p): p is string => Boolean(p));

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
          .filter((line) => !/^[-*]\s+/.test(line.trim()))
          .map((r) => r.replace(/^###\s*/g, "").trim())
          .filter(Boolean);

        const hasAnyKeyValue = bulletKVs.length > 0 || rows.length > 0;
        const listItems = [...bulletPlain.map((b) => b.text), ...raw].filter(Boolean);

        return (
          <div
            key={`${sec.number}-${sec.header}`}
            data-sec={sec.number}
            className="overflow-hidden rounded-xl border-2 bg-white shadow-md hover:shadow-lg transition-shadow"
          >
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
                  onClick={() => setCollapsed((prev) => ({ ...prev, [sec.number]: !prev[sec.number] }))}
                  className="shrink-0 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"
                >
                  {collapsed[sec.number] ? "Show" : "Hide"}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto bg-white">
              {collapsed[sec.number] ? (
                <div className="p-5 text-sm text-slate-500">This section is hidden.</div>
              ) : !hasAnyKeyValue ? (
                <div className="p-5">
                  {listItems.length > 0 ? (
                    <ul className="space-y-2.5">
                      {listItems.map((t, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${accent}`} />
                          <span className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{t}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-slate-500 italic">—</div>
                  )}
                </div>
              ) : (
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
                          <span className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{kv.content}</span>
                        </td>
                      </tr>
                    ))}

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
                          <span className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{r.content}</span>
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
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TrendInsightsView() {
  const [history, setHistory] = useState<TrendRecord[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [selected, setSelected] = useState<TrendRecord | null>(null);
  const [filterBrand, setFilterBrand] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [sort, setSort] = useState<"recent" | "brand">("recent");
  const pageSize = 10;
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Parse summary bar chart data from selected record
  const summaryBars = useMemo(() => {
    if (!selected?.fullOutput) return [];
    return parseSummaryBarChartData(selected.fullOutput);
  }, [selected?.fullOutput]);

  // Parse trend line chart data from selected record
  const trendLines = useMemo(() => {
    if (!selected?.fullOutput) return [];
    return parseTrendLineChartData(selected.fullOutput);
  }, [selected?.fullOutput]);

  const loadBrands = useCallback(async () => {
    setBrandsLoading(true);
    try {
      const list = await listTrendBrands();
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
      const list = await listTrends(filterBrand.trim() || undefined);
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
    const safeName = (selected.brandName || "trends")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 50);
    const ts = new Date(selected.createdAt || Date.now()).toISOString().replace(/[:.]/g, "-");
    if (format === "json") {
      downloadTextFile(
        `bagana-trends-${safeName}-${ts}.json`,
        JSON.stringify(selected, null, 2),
        "application/json;charset=utf-8"
      );
      return;
    }
    downloadTextFile(
      `bagana-trends-${safeName}-${ts}.md`,
      (selected.fullOutput || "").trim(),
      "text/markdown;charset=utf-8"
    );
  };

  const copySummary = async () => {
    if (!selected) return;
    const bars = parseSummaryBarChartData(selected.fullOutput || "").slice(0, 5);
    const lines: string[] = [];
    lines.push(`Brand: ${selected.brandName}`);
    lines.push(`Created: ${new Date(selected.createdAt).toLocaleString()}`);
    if (bars.length > 0) {
      lines.push("");
      lines.push("Top trends:");
      for (const b of bars) lines.push(`- ${b.name}: ${b.value}`);
    }
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
          <h2 className="text-lg font-semibold text-slate-900">Trend Market</h2>
          <p className="text-sm text-slate-600">Explore market trends and export reports for planning.</p>
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
            {IconTrending}
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
              <label htmlFor="search-trends" className="block text-xs font-medium text-slate-700 mb-1">
                Search
              </label>
              <input
                id="search-trends"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Brand / keyword…"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-bagana-primary focus:outline-none focus:ring-1 focus:ring-bagana-primary/20"
              />
            </div>
            <div>
              <label htmlFor="sort-trends" className="block text-xs font-medium text-slate-700 mb-1">
                Sort
              </label>
              <select
                id="sort-trends"
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-bagana-primary focus:outline-none focus:ring-1 focus:ring-bagana-primary/20"
              >
                <option value="recent">Most recent</option>
                <option value="brand">Brand (A–Z)</option>
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
            <p className="mt-2 text-xs">Pastikan database berjalan dan tabel market_trends ada (script: scripts/init-trends-db.py).</p>
          </div>
        )}
        {!loading && !error && history.length === 0 && (
          <div className="py-8 text-center text-slate-500 text-sm">
            No trend research results yet. Generate from Chat (the crew will save automatically).
          </div>
        )}
        {!loading && !error && filteredHistory.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {pagedHistory.map((item) => {
                const isSelected = selected?.id === item.id;
                const topBars = parseSummaryBarChartData(item.fullOutput || "").slice(0, 3);
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
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        Report
                      </span>
                    </div>
                    {topBars.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        <div className="text-xs font-medium text-slate-700">Highlights</div>
                        <ul className="space-y-1 text-xs text-slate-600">
                          {topBars.map((b, idx) => (
                            <li key={idx} className="flex items-center justify-between gap-3">
                              <span className="truncate">{b.name}</span>
                              <span className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                                {Math.round(b.value)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="mt-4 text-xs text-slate-500">Open to view full report.</div>
                    )}
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

      {/* Selected: Line Chart + Full output */}
      {selected && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 truncate">Trends — {selected.brandName}</h3>
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

          {/* Summary Bar Chart */}
          {summaryBars.length > 0 && (
            <div className="border-b border-slate-200 pb-6">
              <h4 className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
                {IconTrending}
                Summary Bar Chart
              </h4>
              <div className="flex justify-center overflow-x-auto">
                <SummaryBarChart data={summaryBars} width={600} height={400} />
              </div>
              <p className="mt-3 text-xs text-slate-500 text-center">
                Menampilkan ringkasan kekuatan trend saat ini. Nilai 0-100 menunjukkan tingkat kekuatan/minat trend.
              </p>
            </div>
          )}

          {/* Trend Bar Chart */}
          {trendLines.length > 0 && (
            <div className="border-b border-slate-200 pb-6">
              <h4 className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
                {IconTrending}
                Trend Bar Chart
              </h4>
              <div className="flex justify-center overflow-x-auto">
                <TrendBarChart trends={trendLines} width={600} height={400} />
              </div>
              <p className="mt-3 text-xs text-slate-500 text-center">
                Menampilkan perkembangan trend dari waktu ke waktu dalam bentuk bar chart. Nilai 0-100 menunjukkan tingkat kekuatan/minat trend.
              </p>
            </div>
          )}

          {/* Full Report */}
          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
              {IconGlobe}
              Full Report (trend_researcher)
            </h4>
            <div className="max-h-[28rem] overflow-y-auto">
              <FullReportTablePro text={selected.fullOutput || ""} />
            </div>
          </div>
        </div>
      )}

      {!selected && history.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 sm:p-12 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-bagana-muted/50 text-bagana-primary mb-4">
            {IconTrending}
          </div>
          <h3 className="font-semibold text-slate-800 mb-1">No trend insights yet</h3>
          <p className="text-sm text-slate-600 mb-4 max-w-sm mx-auto">
            Hasil dari agent trend_researcher (CrewAI) akan tersimpan otomatis setelah Anda menjalankan crew dari Chat. Buka Chat, kirim brief kampanye, lalu kembali ke halaman ini untuk melihat history dan full report.
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-bagana-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-bagana-secondary transition-colors"
          >
            {IconTrending}
            Buka Chat
          </Link>
        </div>
      )}
    </div>
  );
}
