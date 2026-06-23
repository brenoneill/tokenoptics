import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PageHeader } from "@/components/ui/PageShell";
import { ChunkDisplayToggles } from "@/components/settings/ChunkDisplayToggles";
import { ComparisonCanvasToggle } from "@/components/settings/ComparisonCanvasToggle";
import { KiroPlanSetting } from "@/components/settings/KiroPlanSetting";
import { MinConversationCostSetting } from "@/components/settings/MinConversationCostSetting";
import { ModelComparisonToggle } from "@/components/settings/ModelComparisonToggle";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Settings" }]} />
      <PageHeader
        title="Settings"
        description="Configure pricing, storage location, and display preferences."
      />
      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
          Display
        </h2>
        <ChunkDisplayToggles />
        <ModelComparisonToggle />
      </section>
      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
          Conversations
        </h2>
        <MinConversationCostSetting />
      </section>
      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
          Kiro
        </h2>
        <KiroPlanSetting />
      </section>
      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
          Comparison Canvas
        </h2>
        <ComparisonCanvasToggle />
      </section>
    </div>
  );
}
