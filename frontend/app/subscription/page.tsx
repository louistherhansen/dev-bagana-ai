import { PageLayout } from "@/components/PageLayout";
import { IconSparkles } from "@/components/icons";
import { SubscriptionView } from "@/components/SubscriptionView";

/**
 * Subscription & Payment page.
 * Monthly, Annual, and Company Agency subscription options.
 * Frontend only — payment gateway integration deferred to integration epic.
 */
export default function SubscriptionPage() {
  return (
    <PageLayout currentPath="/subscription">
      <div className="flex flex-col flex-1 min-h-0 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6">
        <header className="mb-6 shrink-0 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-bagana-muted/50 text-bagana-primary">
              {IconSparkles}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Subscription & Pricing</h1>
            </div>
          </div>
          <p className="text-slate-600 text-sm sm:text-base max-w-2xl mx-auto">
            Choose the plan that works best for your team. Manage content strategy at scale with BAGANA AI.
          </p>
        </header>

        <section className="flex-1 overflow-auto">
          <SubscriptionView />
        </section>
      </div>
    </PageLayout>
  );
}
