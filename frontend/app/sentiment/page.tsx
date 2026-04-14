import { PageLayout } from "@/components/PageLayout";
import { IconHeart } from "@/components/icons";
import { SentimentAnalysisView } from "@/components/SentimentAnalysisView";

/**
 * Sentiment Analysis: Analyze content or briefs for sentiment and tone.
 * Surface risks and opportunities. Configurable inputs; outputs usable by planning and reporting.
 * PRD F2; SAD MVP UI; frontend only — no backend wiring (integration epic).
 */
export default function SentimentPage() {
  return (
    <PageLayout currentPath="/sentiment">
      <div className="flex flex-col flex-1 min-h-0 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6">
        <header className="mb-6 shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-bagana-muted/50 text-bagana-primary">
              {IconHeart}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Sentiment Analysis</h1>
            </div>
          </div>
          <p className="text-slate-600 text-sm sm:text-base">
            Analyze content or briefs for sentiment and tone. Surface risks and opportunities. Configurable inputs; outputs usable by planning and reporting.
          </p>
        </header>

        <section className="flex-1 overflow-auto">
          <SentimentAnalysisView />
        </section>
      </div>
    </PageLayout>
  );
}
