"use client";

import { useState } from "react";
import Link from "next/link";
import { IconChart, IconClipboard, IconHeart, IconTrending, IconDocument, IconCalendar } from "@/components/icons";

/** Mock report combining plan + sentiment + trend outputs. */
type Report = {
  id: string;
  title: string;
  campaign: string;
  createdAt: string;
  planSummary: string;
  sentimentSummary: string;
  trendSummary: string;
  planId?: string;
  sentimentId?: string;
  trendId?: string;
};

const MOCK_REPORTS: Report[] = [
  {
    id: "report-1",
    title: "Nalarin Q1 Campaign Report",
    campaign: "Nalarin Q1",
    createdAt: "2025-02-01",
    planSummary: "Multi-talent content plan focused on educating users about content creation. 3 creators assigned: Content Strategist, Video Producer, Social Media Manager.",
    sentimentSummary: "Positive tone overall. Risks: content saturation, brand safety. Opportunities: audience engagement, creator expertise showcase.",
    trendSummary: "Key trends: interactive content, short-form video, creator collaboration. Implications: incorporate interactive elements, focus on Reels format.",
    planId: "plan-1",
    sentimentId: "sentiment-1",
    trendId: "trend-1",
  },
];

function ReportCard({ report }: { report: Report }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-800 mb-1">{report.title}</h3>
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">{report.campaign}</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500">{report.createdAt}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            disabled
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Export — Integration epic"
          >
            Export
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-bagana-primary">{IconClipboard}</div>
            <h4 className="text-sm font-medium text-slate-700">Content Plan</h4>
            {report.planId && (
              <Link href="/plans" className="text-xs text-bagana-primary hover:text-bagana-secondary ml-auto">
                View →
              </Link>
            )}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">{report.planSummary}</p>
        </div>

        <div className="rounded-lg border border-red-100 bg-red-50/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-red-600">{IconHeart}</div>
            <h4 className="text-sm font-medium text-slate-700">Sentiment Analysis</h4>
            {report.sentimentId && (
              <Link href="/sentiment" className="text-xs text-bagana-primary hover:text-bagana-secondary ml-auto">
                View →
              </Link>
            )}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">{report.sentimentSummary}</p>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-blue-600">{IconTrending}</div>
            <h4 className="text-sm font-medium text-slate-700">Trend Insights</h4>
            {report.trendId && (
              <Link href="/trends" className="text-xs text-bagana-primary hover:text-bagana-secondary ml-auto">
                View →
              </Link>
            )}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">{report.trendSummary}</p>
        </div>
      </div>
    </div>
  );
}

function DashboardFilters() {
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [dateRange, setDateRange] = useState("all");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h3 className="font-semibold text-slate-800 mb-4">Filters</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="campaign-filter" className="block text-sm font-medium text-slate-700 mb-2">
            Campaign
          </label>
          <select
            id="campaign-filter"
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-bagana-primary focus:outline-none focus:ring-1 focus:ring-bagana-primary/20"
          >
            <option value="">All campaigns</option>
            <option value="nalarin-q1">Nalarin Q1</option>
          </select>
        </div>
        <div>
          <label htmlFor="date-range" className="block text-sm font-medium text-slate-700 mb-2">
            Date Range
          </label>
          <select
            id="date-range"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-bagana-primary focus:outline-none focus:ring-1 focus:ring-bagana-primary/20"
          >
            <option value="all">All time</option>
            <option value="week">Last week</option>
            <option value="month">Last month</option>
            <option value="quarter">Last quarter</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export function ReportsDashboardView() {
  const reports = MOCK_REPORTS;

  // Calculate summary stats
  const stats = {
    total: reports.length,
    thisMonth: reports.filter((r) => {
      const reportDate = new Date(r.createdAt);
      const now = new Date();
      return reportDate.getMonth() === now.getMonth() && reportDate.getFullYear() === now.getFullYear();
    }).length,
    withPlans: reports.filter((r) => r.planId).length,
    withSentiment: reports.filter((r) => r.sentimentId).length,
    withTrends: reports.filter((r) => r.trendId).length,
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1">Total Reports</p>
              <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
            </div>
            <div className="text-slate-400">
              <div className="w-6 h-6">{IconChart}</div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1">This Month</p>
              <p className="text-2xl font-bold text-blue-600">{stats.thisMonth}</p>
            </div>
            <div className="text-blue-400">
              <div className="w-6 h-6">{IconCalendar}</div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1">With Plans</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.withPlans}</p>
            </div>
            <div className="text-emerald-400">
              <div className="w-6 h-6">{IconClipboard}</div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1">With Sentiment</p>
              <p className="text-2xl font-bold text-red-600">{stats.withSentiment}</p>
            </div>
            <div className="text-red-400">
              <div className="w-6 h-6">{IconHeart}</div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1">With Trends</p>
              <p className="text-2xl font-bold text-blue-600">{stats.withTrends}</p>
            </div>
            <div className="text-blue-400">
              <div className="w-6 h-6">{IconTrending}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Placeholder */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h3 className="font-semibold text-slate-800 mb-4">Report Trends</h3>
        <div className="h-64 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-bagana-muted/50 text-bagana-primary mb-2">
              <div className="w-6 h-6">{IconChart}</div>
            </div>
            <p className="text-sm text-slate-600">Chart visualization — Integration epic</p>
            <p className="text-xs text-slate-500 mt-1">Report generation trends over time</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-slate-600">
          Summaries and reports from plan + sentiment + trend outputs for stakeholders.
        </p>
        <div className="flex items-center gap-2">
          <button
            disabled
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Generate Report — Integration epic"
          >
            <div className="w-4 h-4">{IconChart}</div>
            Generate Report
          </button>
          <button
            disabled
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Export All — Integration epic"
          >
            <div className="w-4 h-4">{IconDocument}</div>
            Export All
          </button>
        </div>
      </div>

      <DashboardFilters />

      {reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 sm:p-12 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-bagana-muted/50 text-bagana-primary mb-4">
            {IconChart}
          </div>
          <h3 className="font-semibold text-slate-800 mb-1">No reports yet</h3>
          <p className="text-sm text-slate-600 mb-4 max-w-sm mx-auto">
            Reports combine outputs from Content Plans, Sentiment Analysis, and Trend Insights. Generate a report from Chat or create one manually.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Link
              href="/chat"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-bagana-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-bagana-secondary transition-colors"
            >
              Generate via Chat
            </Link>
            <button
              disabled
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Create Report — Integration epic"
            >
              Create Report
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">
              Reports ({reports.length})
            </h2>
          </div>
          <ul className="space-y-4">
            {reports.map((report) => (
              <li key={report.id}>
                <ReportCard report={report} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
        <div className="flex items-start gap-3">
          <span className="text-amber-600 shrink-0 mt-0.5">ℹ️</span>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-amber-800 mb-1">P1 Feature</h4>
            <p className="text-xs text-amber-700">
              Reports & Dashboards (F6) is a P1 feature. UI is ready; backend integration (report_summarizer agent, ReportTemplateRenderer tool) is deferred to P1 epic. Reports combine plan + sentiment + trend outputs for stakeholder summaries.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
