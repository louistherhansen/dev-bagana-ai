import { PageLayout } from "@/components/PageLayout";
import { IconClipboard } from "@/components/icons";
import { ContentPlansView } from "@/components/ContentPlansView";

/**
 * Content Plans: Multi-talent content plans, calendars, and briefs.
 * Schema-valid, versioned, traceable to campaign/talent.
 * PRD F1; SAD MVP UI; frontend only — no backend wiring (integration epic).
 */
export default function PlansPage() {
  return (
    <PageLayout currentPath="/plans">
      <div className="flex flex-col flex-1 min-h-0 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6">
        <header className="mb-6 shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-bagana-muted/50 text-bagana-primary">
              {IconClipboard}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Content Plans</h1>
            </div>
          </div>
          <p className="text-slate-600 text-sm sm:text-base">
            Multi-talent content plans, calendars, and briefs. Schema-valid, versioned, traceable to campaign/talent.
          </p>
        </header>

        <section className="flex-1 flex flex-col min-h-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <ContentPlansView />
        </section>
      </div>
    </PageLayout>
  );
}
