import { PageLayout } from "@/components/PageLayout";
import { IconEye } from "@/components/icons";
import { ReviewDashboardView } from "@/components/ReviewDashboardView";

/**
 * Review Dashboard (Phase 3 — Scale): Review and approve content plans, sentiment analysis, trend insights, and reports.
 * PRD Phase 3; SAD Phase 3; Human-in-the-loop review for brand safety and approvals.
 * MRD: "human review for briefs and approvals. Human-in-the-loop where brand safety or final sign-off is required."
 */
export default function ReviewPage() {
  return (
    <PageLayout currentPath="/review">
      <div className="flex flex-col flex-1 min-h-0 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6">
        <header className="mb-6 shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-bagana-muted/50 text-bagana-primary">
              {IconEye}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Review & Approval</h1>
              <p className="text-sm text-slate-500">Phase 3 — Scale</p>
            </div>
          </div>
          <p className="text-slate-600 text-sm sm:text-base">
            Review and approve content plans, sentiment analysis, trend insights, and reports. Human-in-the-loop for brand safety and final sign-off.
          </p>
        </header>

        <section className="flex-1 flex flex-col min-h-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <ReviewDashboardView />
        </section>
      </div>
    </PageLayout>
  );
}
