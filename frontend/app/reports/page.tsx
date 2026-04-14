import { PageLayout } from "@/components/PageLayout";
import { IconChart } from "@/components/icons";
import { ReportsDashboardView } from "@/components/ReportsDashboardView";

/**
 * Reports & Dashboards: Summaries and reports from plan + sentiment + trend outputs for stakeholders.
 * PRD F6; SAD P1; frontend only — no backend wiring (P1 epic).
 */
export default function ReportsPage() {
  return (
    <PageLayout currentPath="/reports">
      <div className="flex flex-col flex-1 min-h-0 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6">
        <header className="mb-6 shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-bagana-muted/50 text-bagana-primary">
              {IconChart}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Reports & Dashboards</h1>
            </div>
          </div>
          <p className="text-slate-600 text-sm sm:text-base">
            Summaries and reports from plan + sentiment + trend outputs for stakeholders.
          </p>
        </header>

        <section className="flex-1 overflow-auto">
          <ReportsDashboardView />
        </section>
      </div>
    </PageLayout>
  );
}
