import { PageLayout } from "@/components/PageLayout";
import { IconCog } from "@/components/icons";
import { UserManagement } from "@/components/UserManagement";
import { UserProfileSettings } from "@/components/UserProfileSettings";
import { RoleGuard } from "@/components/RoleGuard";

/**
 * Settings & Custom Rules: Configurable sentiment and trend rules.
 * Optional custom models. Integrations and API keys.
 * PRD F10; SAD P2; frontend only — no backend wiring (P2 epic).
 */
export default function SettingsPage() {
  return (
    <RoleGuard allowRoles={["admin", "moderator"]}>
      <PageLayout currentPath="/settings">
        <div className="flex flex-col flex-1 min-h-0 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6">
          <header className="mb-6 shrink-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-bagana-muted/50 text-bagana-primary">
                {IconCog}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Settings & Custom Rules</h1>
              </div>
            </div>
            <p className="text-slate-600 text-sm sm:text-base">
              Configurable sentiment and trend rules. Optional custom models. Integrations and API keys.
            </p>
          </header>

          <section className="space-y-6">
            {/* User Profile Settings Section */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <UserProfileSettings />
            </div>

            {/* User Management Section (Admin Only) */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <UserManagement showCreateByDefault />
            </div>
          </section>
        </div>
      </PageLayout>
    </RoleGuard>
  );
}
