import { PageLayout } from "@/components/PageLayout";
import { IconTrending } from "@/components/icons";
import { TrendInsightsView } from "@/components/TrendInsightsView";

/**
 * Market Trend Insights: Ingest and summarize relevant trend and market insights for content strategy.
 * Defined sources and rate limits; outputs linked to plans or briefs.
 * PRD F3; SAD MVP UI; frontend only — no backend wiring (integration epic).
 */
export default function TrendsPage() {
  return (
    <PageLayout currentPath="/trends">
      <div className="flex flex-col flex-1 min-h-0 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6">
        <header className="mb-6 shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-bagana-muted/50 text-bagana-primary">
              {IconTrending}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Market Trend Insights</h1>
            </div>
          </div>
          <p className="text-slate-600 text-sm sm:text-base">
            Ingest and summarize relevant trend and market insights for content strategy. Defined sources and rate limits; outputs linked to plans or briefs.
          </p>
        </header>

        <section className="flex-1 overflow-auto">
          <TrendInsightsView />
        </section>
      </div>
    </PageLayout>
  );
}
