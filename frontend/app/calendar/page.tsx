import { PageLayout } from "@/components/PageLayout";
import { IconCalendar } from "@/components/icons";
import { CalendarBriefsView } from "@/components/CalendarBriefsView";

/**
 * Calendar & Briefs Integration: Optional integration with calendar/brief systems for import/export.
 * PRD F7; SAD P1; frontend only — no backend wiring (P1 epic).
 */
export default function CalendarPage() {
  return (
    <PageLayout currentPath="/calendar">
      <div className="flex flex-col flex-1 min-h-0 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6">
        <header className="mb-6 shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-bagana-muted/50 text-bagana-primary">
              <div className="w-6 h-6">{IconCalendar}</div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Calendar & Briefs</h1>
            </div>
          </div>
          <p className="text-slate-600 text-sm sm:text-base">
            Optional integration with calendar/brief systems for import/export.
          </p>
        </header>

        <section className="flex-1 overflow-auto">
          <CalendarBriefsView />
        </section>
      </div>
    </PageLayout>
  );
}
