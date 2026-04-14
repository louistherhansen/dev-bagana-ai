"use client";

import { useState } from "react";
import Link from "next/link";
import {
  IconCalendar,
  IconDocument,
  IconClipboard,
  IconArrowRight,
  IconArrowDown,
  IconCheck,
  IconAlertTriangle,
} from "@/components/icons";

type CalendarIntegration = {
  id: string;
  name: string;
  type: "google" | "outlook" | "ical" | "other";
  status: "connected" | "disconnected" | "error";
  lastSync?: string;
  eventsCount?: number;
};

type BriefFormat = {
  id: string;
  name: string;
  format: "pdf" | "docx" | "markdown" | "json";
  description: string;
  supported: boolean;
};

const MOCK_CALENDARS: CalendarIntegration[] = [
  {
    id: "cal-1",
    name: "Google Calendar",
    type: "google",
    status: "disconnected",
  },
  {
    id: "cal-2",
    name: "Outlook Calendar",
    type: "outlook",
    status: "disconnected",
  },
  {
    id: "cal-3",
    name: "iCal Feed",
    type: "ical",
    status: "disconnected",
  },
];

const MOCK_BRIEF_FORMATS: BriefFormat[] = [
  {
    id: "brief-1",
    name: "PDF Document",
    format: "pdf",
    description: "Export content plans as PDF documents for sharing and printing.",
    supported: true,
  },
  {
    id: "brief-2",
    name: "Word Document",
    format: "docx",
    description: "Export content plans as Microsoft Word documents for editing.",
    supported: true,
  },
  {
    id: "brief-3",
    name: "Markdown",
    format: "markdown",
    description: "Export content plans as Markdown files for version control and documentation.",
    supported: true,
  },
  {
    id: "brief-4",
    name: "JSON",
    format: "json",
    description: "Export content plans as JSON for programmatic access and integrations.",
    supported: true,
  },
];

function CalendarIntegrationCard({ calendar }: { calendar: CalendarIntegration }) {
  const [isConnecting, setIsConnecting] = useState(false);

  const getStatusBadge = () => {
    switch (calendar.status) {
      case "connected":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
            <div className="w-3 h-3">{IconCheck}</div>
            Connected
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
            <div className="w-3 h-3">{IconAlertTriangle}</div>
            Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            Disconnected
          </span>
        );
    }
  };

  const handleConnect = () => {
    setIsConnecting(true);
    // Simulate connection process
    setTimeout(() => {
      setIsConnecting(false);
      alert("Calendar connection — Integration epic (backend wiring required)");
    }, 1000);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 shrink-0">
            <div className="w-6 h-6">{IconCalendar}</div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-800 mb-1">{calendar.name}</h3>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {getStatusBadge()}
              {calendar.lastSync && (
                <>
                  <span className="text-slate-400">•</span>
                  <span className="text-xs text-slate-500">Last sync: {calendar.lastSync}</span>
                </>
              )}
              {calendar.eventsCount !== undefined && (
                <>
                  <span className="text-slate-400">•</span>
                  <span className="text-xs text-slate-500">{calendar.eventsCount} events</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {calendar.status === "connected" ? (
        <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
          <button
            disabled
            className="text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Sync Now — Integration epic"
          >
            Sync Now
          </button>
          <span className="text-slate-300">•</span>
          <button
            disabled
            className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Disconnect — Integration epic"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="pt-4 border-t border-slate-100">
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Connect Calendar — Integration epic"
          >
            {isConnecting ? "Connecting..." : "Connect Calendar"}
            <div className="w-4 h-4">{IconArrowRight}</div>
          </button>
        </div>
      )}
    </div>
  );
}

function BriefFormatCard({ format }: { format: BriefFormat }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 shrink-0">
            <div className="w-6 h-6">{IconDocument}</div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-800 mb-1">{format.name}</h3>
            <p className="text-sm text-slate-600 mb-2">{format.description}</p>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                {format.format.toUpperCase()}
              </span>
              {format.supported && (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                  <div className="w-3 h-3">{IconCheck}</div>
                  Supported
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
        <button
          disabled
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Export — Integration epic"
        >
          <div className="w-4 h-4">{IconArrowDown}</div>
          Export Sample
        </button>
        <Link
          href="/plans"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-bagana-primary px-4 py-2 text-sm font-medium text-white hover:bg-bagana-secondary transition-colors"
        >
          Export from Plans
          <div className="w-4 h-4">{IconArrowRight}</div>
        </Link>
      </div>
    </div>
  );
}

export function CalendarBriefsView() {
  const calendars = MOCK_CALENDARS;
  const briefFormats = MOCK_BRIEF_FORMATS;

  const connectedCount = calendars.filter((c) => c.status === "connected").length;

  return (
    <div className="space-y-8">
      {/* Calendar Integrations Section */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Calendar Integrations</h2>
            <p className="text-sm text-slate-600">
              Connect your calendar systems to sync content plans and schedules ({connectedCount} connected)
            </p>
          </div>
          <button
            disabled
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            title="Add Integration — Integration epic"
          >
            <div className="w-4 h-4">{IconCalendar}</div>
            Add Integration
          </button>
        </div>

        {calendars.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 sm:p-12 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-bagana-muted/50 text-bagana-primary mb-4">
              <div className="w-7 h-7">{IconCalendar}</div>
            </div>
            <h3 className="font-semibold text-slate-800 mb-1">No calendar integrations</h3>
            <p className="text-sm text-slate-600 mb-4 max-w-sm mx-auto">
              Connect your calendar systems to sync content plans and schedules automatically.
            </p>
            <button
              disabled
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-bagana-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-bagana-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Add Integration — Integration epic"
            >
              Add Integration
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {calendars.map((calendar) => (
              <CalendarIntegrationCard key={calendar.id} calendar={calendar} />
            ))}
          </div>
        )}
      </section>

      {/* Brief Export Formats Section */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Brief Export Formats</h2>
            <p className="text-sm text-slate-600">
              Export content plans and briefs in various formats for sharing and integration
            </p>
          </div>
          <Link
            href="/plans"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-bagana-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-bagana-secondary transition-colors shrink-0"
          >
            View Plans
            <div className="w-4 h-4">{IconArrowRight}</div>
          </Link>
        </div>

        {briefFormats.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 sm:p-12 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-bagana-muted/50 text-bagana-primary mb-4">
              <div className="w-7 h-7">{IconDocument}</div>
            </div>
            <h3 className="font-semibold text-slate-800 mb-1">No export formats available</h3>
            <p className="text-sm text-slate-600 mb-4 max-w-sm mx-auto">
              Export formats will be available once content plans are created.
            </p>
            <Link
              href="/plans"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-bagana-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-bagana-secondary transition-colors"
            >
              View Plans
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {briefFormats.map((format) => (
              <BriefFormatCard key={format.id} format={format} />
            ))}
          </div>
        )}
      </section>

      {/* Import Section */}
      <section>
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 shrink-0">
              <div className="w-6 h-6">{IconArrowDown}</div>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-800 mb-1">Import Briefs</h3>
              <p className="text-sm text-slate-600 mb-4">
                Upload brief documents to create content plans automatically
              </p>
              <button
                disabled
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Import Brief — Integration epic"
              >
                <div className="w-4 h-4">{IconArrowDown}</div>
                Upload Brief File
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
        <div className="flex items-start gap-3">
          <span className="text-amber-600 shrink-0 mt-0.5">ℹ️</span>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-amber-800 mb-1">P1 Feature</h4>
            <p className="text-xs text-amber-700">
              Calendar & Briefs Integration (F7) is a P1 feature. UI is ready; backend integration (calendar sync APIs, brief import/export parsers) is deferred to P1 epic. Supports Google Calendar, Outlook, iCal feeds, and various brief formats (PDF, DOCX, Markdown, JSON).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
