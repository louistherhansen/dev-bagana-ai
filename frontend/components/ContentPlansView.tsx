"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { IconClipboard, IconCalendar, IconDocument, IconCheck } from "@/components/icons";
import { getAllPlans, listContentPlanBrands, getPlan, type ContentPlanSummary, type ContentPlan } from "@/lib/contentPlans";
import { parseContentPlanMarkdown, type ContentPlanSchemaV1 } from "@/lib/contentPlanSchema";

/** Plan card item - matches ContentPlanSummary from API */
type PlanCard = ContentPlanSummary & {
  updatedAtFormatted: string;
};

function PlansSection() {
  const [history, setHistory] = useState<ContentPlanSummary[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [selected, setSelected] = useState<ContentPlan | null>(null);
  const [filterBrand, setFilterBrand] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [sort, setSort] = useState<"recent" | "title" | "brand">("recent");
  const pageSize = 10;
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");

  const loadBrands = useCallback(async () => {
    setBrandsLoading(true);
    try {
      const list = await listContentPlanBrands();
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
      const list = await getAllPlans(filterBrand.trim() || undefined);
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

  const loadPlanDetail = useCallback(async (planId: string) => {
    setLoadingDetail(true);
    try {
      const plan = await getPlan(planId);
      setSelected(plan);
      const firstVersion = plan?.versions?.[0];
      setSelectedVersionId(firstVersion?.id || "");
    } catch (e) {
      console.error("Failed to load plan detail:", e);
      setSelected(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

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

  const handleSelectPlan = useCallback((plan: ContentPlanSummary) => {
    if (selected?.id === plan.id) {
      setSelected(null);
    } else {
      loadPlanDetail(plan.id);
    }
  }, [selected, loadPlanDetail]);

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const normalize = (s: string | undefined | null) => (s || "").toLowerCase().trim();

  const filteredHistory = useMemo(() => {
    const q = normalize(search);
    let list = [...history];
    if (q) {
      list = list.filter((p) => {
        const hay = [
          p.title,
          p.brandName,
          p.campaign,
          p.version,
          ...(p.talents || []),
        ]
          .filter(Boolean)
          .join(" ");
        return normalize(hay).includes(q);
      });
    }
    if (sort === "title") {
      list.sort((a, b) => normalize(a.title).localeCompare(normalize(b.title)));
    } else if (sort === "brand") {
      list.sort((a, b) => normalize(a.brandName).localeCompare(normalize(b.brandName)));
    } else {
      list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }
    return list;
  }, [history, search, sort]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredHistory.length / pageSize)),
    [filteredHistory.length]
  );

  useEffect(() => {
    // Reset to first page on query changes
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBrand, search, sort]);

  useEffect(() => {
    // Clamp page when data size changes
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const pagedHistory = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredHistory.slice(start, start + pageSize);
  }, [filteredHistory, page]);

  const getSchemaFromVersion = (content: any): ContentPlanSchemaV1 | null => {
    if (!content) return null;
    // Re-parse at display-time so old saved plans also benefit from latest parser improvements
    const raw =
      content?.plan?.rawMarkdown ||
      content?.raw ||
      (typeof content === "string" ? content : "");
    if (typeof raw === "string" && raw.trim()) {
      return parseContentPlanMarkdown(raw);
    }
    return null;
  };

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
    const v =
      (selectedVersionId && selected.versions?.find((x) => x.id === selectedVersionId)) ||
      selected.versions?.[0];
    const content = v?.content;
    const schema = getSchemaFromVersion(content);

    const safeName = (selected.title || "content-plan")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 50);
    const ts = new Date().toISOString().replace(/[:.]/g, "-");

    if (format === "json") {
      downloadTextFile(
        `bagana-${safeName}-${ts}.json`,
        JSON.stringify({ ...selected, selectedVersionId, version: v?.version, content }, null, 2),
        "application/json;charset=utf-8"
      );
      return;
    }

    // md
    const md =
      schema?.rawMarkdown ||
      (typeof content === "string" ? content : "") ||
      (content?.raw && typeof content.raw === "string" ? content.raw : "") ||
      JSON.stringify(content ?? {}, null, 2);
    downloadTextFile(`bagana-${safeName}-${ts}.md`, md, "text/markdown;charset=utf-8");
  };

  const copySummary = async () => {
    if (!selected) return;
    const v =
      (selectedVersionId && selected.versions?.find((x) => x.id === selectedVersionId)) ||
      selected.versions?.[0];
    const schema = getSchemaFromVersion(v?.content);
    const lines: string[] = [];
    lines.push(`Title: ${selected.title}`);
    if (selected.brandName) lines.push(`Brand: ${selected.brandName}`);
    if (selected.campaign) lines.push(`Campaign: ${selected.campaign}`);
    if (schema?.campaignType) lines.push(`Campaign Type: ${schema.campaignType}`);
    if (schema?.productType) lines.push(`Product: ${schema.productType}`);
    if (schema?.objectives?.length) {
      lines.push("");
      lines.push("Objectives:");
      schema.objectives.slice(0, 6).forEach((o) => lines.push(`- ${o}`));
    }
    if (schema?.talentAssignments?.length) {
      lines.push("");
      lines.push("Talent Assignments:");
      schema.talentAssignments.slice(0, 6).forEach((t) =>
        lines.push(`- ${t.talent}: ${(t.responsibilities || []).slice(0, 3).join(", ")}`)
      );
    }
    const text = lines.join("\n").trim();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
  };

  const renderPlanContent = (content: any) => {
    if (!content) return null;
    const p = getSchemaFromVersion(content);
    if (p) {
      const section = (title: string, items?: string[]) =>
        items && items.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{title}</div>
            <ul className="list-disc pl-5 text-sm text-slate-800 space-y-1">
              {items.map((it, i) => (
                <li key={`${title}-${i}`}>{it}</li>
              ))}
            </ul>
          </div>
        ) : null;

      return (
        <div className="space-y-4 text-sm text-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {p.brandName && (
              <div>
                <div className="text-xs font-medium text-slate-500">Brand Name</div>
                <div className="mt-1">{p.brandName}</div>
              </div>
            )}
            {p.campaignType && (
              <div>
                <div className="text-xs font-medium text-slate-500">Campaign Type</div>
                <div className="mt-1">{p.campaignType}</div>
              </div>
            )}
            {p.companyType && (
              <div>
                <div className="text-xs font-medium text-slate-500">Company Type</div>
                <div className="mt-1">{p.companyType}</div>
              </div>
            )}
            {p.productType && (
              <div>
                <div className="text-xs font-medium text-slate-500">Product Type</div>
                <div className="mt-1">{p.productType}</div>
              </div>
            )}
            {p.website && (
              <div className="sm:col-span-2">
                <div className="text-xs font-medium text-slate-500">Website</div>
                <div className="mt-1 break-words">{p.website}</div>
              </div>
            )}
          </div>

          {p.strategicOverview && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Strategic Overview</div>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{p.strategicOverview}</p>
            </div>
          )}

          {section("Objectives", p.objectives)}

          {p.talentAssignments && p.talentAssignments.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Talent Assignments</div>
              <div className="space-y-2">
                {p.talentAssignments.map((ta, idx) => (
                  <div key={`${ta.talent}-${idx}`} className="rounded-lg bg-white border border-slate-200 p-3">
                    <div className="font-medium text-slate-900">{ta.talent}</div>
                    {ta.responsibilities?.length ? (
                      <ul className="mt-2 list-disc pl-5 text-sm text-slate-800 space-y-1">
                        {ta.responsibilities.map((r, i) => (
                          <li key={`${ta.talent}-r-${i}`}>{r}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {section("Content Themes", p.contentThemes)}
          {section("Content Calendar and Timeline", p.contentCalendarTimeline)}
          {section("Key Messaging", p.keyMessaging)}
          {section("Content Formats", p.contentFormats)}
          {section("Distribution Strategy", p.distributionStrategy)}
          {section("Audit", p.audit)}

          {p.unknownSections && Object.keys(p.unknownSections).length > 0 && (
            <details className="rounded-lg border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">Other sections</summary>
              <div className="mt-3 space-y-3">
                {Object.entries(p.unknownSections).map(([k, v]) => (
                  <div key={k}>
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{k}</div>
                    <pre className="mt-1 text-xs text-slate-700 whitespace-pre-wrap font-sans">{v}</pre>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      );
    }

    // Legacy fallback: show raw/ formatted / JSON
    if (typeof content === "string") {
      return <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans">{content}</pre>;
    }
    return (
      <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans">
        {JSON.stringify(content, null, 2)}
      </pre>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">Content Plans</h2>
          <p className="text-sm text-slate-600">
            Search, review, and export content plans for client-ready delivery.
          </p>
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
            {IconClipboard}
            Generate via Chat
          </Link>
        </div>
      </div>

      {/* History by Brand Name */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-4">
          <div className="space-y-1">
            <h3 className="font-semibold text-slate-800">History</h3>
            <p className="text-xs text-slate-500">
              Showing page {page} of {totalPages} • {filteredHistory.length} plans
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:max-w-3xl">
            <div className="sm:col-span-1">
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
            <div className="sm:col-span-1">
              <label htmlFor="search-plans" className="block text-xs font-medium text-slate-700 mb-1">
                Search
              </label>
              <input
                id="search-plans"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Title, brand, campaign, talent…"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-bagana-primary focus:outline-none focus:ring-1 focus:ring-bagana-primary/20"
              />
            </div>
            <div className="sm:col-span-1">
              <label htmlFor="sort-plans" className="block text-xs font-medium text-slate-700 mb-1">
                Sort
              </label>
              <select
                id="sort-plans"
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-bagana-primary focus:outline-none focus:ring-1 focus:ring-bagana-primary/20"
              >
                <option value="recent">Most recent</option>
                <option value="title">Title (A–Z)</option>
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
                <div className="h-4 w-2/3 bg-slate-200 rounded" />
                <div className="mt-3 h-3 w-1/2 bg-slate-200 rounded" />
                <div className="mt-4 flex gap-2">
                  <div className="h-6 w-16 bg-slate-200 rounded-md" />
                  <div className="h-6 w-20 bg-slate-200 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className="py-4 rounded-lg bg-red-50 text-red-700 text-sm px-4">
            {error}
            <p className="mt-2 text-xs">
              If your session expires, please sign in again. If you see a 5xx error, make sure the database is running and the <code className="font-mono">content_plans</code> table exists.
            </p>
          </div>
        )}
        {!loading && !error && history.length === 0 && (
          <div className="py-8 text-center text-slate-500 text-sm">
            No content plans yet. Generate one from Chat (the crew will save automatically).
          </div>
        )}
        {!loading && !error && filteredHistory.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {pagedHistory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectPlan(item)}
                  className={`text-left rounded-2xl border p-4 transition-colors hover:bg-slate-50 ${
                    selected?.id === item.id ? "border-bagana-primary bg-bagana-primary/5" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{item.title}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Updated: {formatDate(item.updatedAt)}
                      </div>
                    </div>
                    {item.schemaValid ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 shrink-0">
                        {IconCheck}
                        Valid
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 shrink-0">
                        Needs review
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    {item.brandName && (
                      <span className="rounded-md bg-blue-100 px-2 py-0.5 text-blue-700">
                        {item.brandName}
                      </span>
                    )}
                    {item.campaign && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                        {item.campaign}
                      </span>
                    )}
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">{item.version}</span>
                    {item.talents?.length ? (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                        {item.talents.length} talents
                      </span>
                    ) : null}
                  </div>

                  {item.talents?.length ? (
                    <div className="mt-3 text-xs text-slate-600">
                      <span className="font-medium text-slate-700">Talents:</span>{" "}
                      {item.talents.slice(0, 3).join(", ")}
                      {item.talents.length > 3 ? "…" : ""}
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-slate-500">
                      Click to review details and export for client delivery.
                    </div>
                  )}
                </button>
              ))}
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

      {/* Selected: Full Plan Detail */}
      {selected && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 truncate">Content Plan — {selected.title}</h3>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                {selected.brandName ? (
                  <span className="rounded-md bg-blue-100 px-2 py-0.5 text-blue-700">{selected.brandName}</span>
                ) : null}
                {selected.campaign ? (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">{selected.campaign}</span>
                ) : null}
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                  Updated {formatDate(selected.updatedAt)}
                </span>
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

          {/* Plan Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-200">
            {selected.brandName && (
              <div>
                <span className="text-xs font-medium text-slate-500">Brand</span>
                <p className="text-sm text-slate-800 mt-1">{selected.brandName}</p>
              </div>
            )}
            {selected.campaign && (
              <div>
                <span className="text-xs font-medium text-slate-500">Campaign</span>
                <p className="text-sm text-slate-800 mt-1">{selected.campaign}</p>
              </div>
            )}
            {selected.talents.length > 0 && (
              <div className="sm:col-span-2">
                <span className="text-xs font-medium text-slate-500">Talents</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {selected.talents.map((talent) => (
                    <span
                      key={talent}
                      className="rounded-md bg-bagana-muted/60 px-2 py-1 text-xs text-bagana-dark"
                    >
                      {talent}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div>
              <span className="text-xs font-medium text-slate-500">Schema Valid</span>
              <p className="text-sm text-slate-800 mt-1">
                {selected.schemaValid ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    {IconCheck}
                    Valid
                  </span>
                ) : (
                  <span className="text-amber-700">Invalid</span>
                )}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500">Updated</span>
              <p className="text-sm text-slate-800 mt-1">{formatDate(selected.updatedAt)}</p>
            </div>
          </div>

          {/* Plan Versions */}
          {selected.versions && selected.versions.length > 0 && (
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h4 className="text-sm font-medium text-slate-700">Version</h4>
                <select
                  value={selectedVersionId || selected.versions[0]?.id || ""}
                  onChange={(e) => setSelectedVersionId(e.target.value)}
                  className="w-full sm:w-auto rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-bagana-primary focus:outline-none focus:ring-1 focus:ring-bagana-primary/20"
                >
                  {selected.versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.version} — {formatDate(v.createdAt)}
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const v =
                  (selectedVersionId && selected.versions.find((x) => x.id === selectedVersionId)) ||
                  selected.versions[0];
                return v?.content ? (
                  <div className="max-h-[520px] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-700 whitespace-pre-wrap font-sans bg-white p-4 rounded-xl border border-slate-200">
                      {renderPlanContent(v.content)}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}

          {loadingDetail && (
            <div className="py-8 text-center text-slate-500 text-sm">Loading plan details…</div>
          )}
        </div>
      )}

      {!selected && history.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 sm:p-12 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-bagana-muted/50 text-bagana-primary mb-4">
            {IconClipboard}
          </div>
          <h3 className="font-semibold text-slate-800 mb-1">No content plans yet</h3>
          <p className="text-sm text-slate-600 mb-4 max-w-sm mx-auto">
            Results from the <span className="font-mono">content_planner</span> agent (CrewAI) are saved automatically after you run the crew from Chat. Open Chat, send a campaign brief, then return here to see history and plan details.
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-bagana-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-bagana-secondary transition-colors"
          >
            {IconClipboard}
            Buka Chat
          </Link>
        </div>
      )}
    </div>
  );
}

function CalendarStub() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 sm:p-12 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-bagana-muted/50 text-bagana-primary mb-4">
        {IconCalendar}
      </div>
      <h3 className="font-semibold text-slate-800 mb-1">Calendar view</h3>
      <p className="text-sm text-slate-600 max-w-sm mx-auto">
        Content calendar by week/month — linked to plans and briefs. (Placeholder; integration epic.)
      </p>
    </div>
  );
}

function BriefsStub() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 sm:p-12 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-bagana-muted/50 text-bagana-primary mb-4">
        {IconDocument}
      </div>
      <h3 className="font-semibold text-slate-800 mb-1">Briefs</h3>
      <p className="text-sm text-slate-600 max-w-sm mx-auto">
        Campaign and talent briefs — traceable to plans. (Placeholder; integration epic.)
      </p>
    </div>
  );
}

const TABS = [
  { id: "plans", label: "Plans", content: <PlansSection /> },
  { id: "calendar", label: "Calendar", content: <CalendarStub /> },
  { id: "briefs", label: "Briefs", content: <BriefsStub /> },
] as const;

export function ContentPlansView() {
  const [activeTab, setActiveTab] = useState<"plans" | "calendar" | "briefs">("plans");

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-slate-200 bg-white/80">
        <nav className="flex gap-1 px-1" aria-label="Content plans sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-bagana-primary border border-b-0 border-slate-200 -mb-px"
                  : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex-1 overflow-auto bg-slate-50/50 p-4 sm:p-6">
        {TABS.find((t) => t.id === activeTab)?.content}
      </div>
    </div>
  );
}
