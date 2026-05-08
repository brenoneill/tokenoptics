import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PageHeader } from "@/components/ui/PageShell";
import { FolderConnect } from "@/components/connect/FolderConnect";
import { EarlyAccessSignup } from "@/components/connect/EarlyAccessSignup";

export const dynamic = "force-static";

export default function ConnectPage() {
  return (
    <div>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Connect" }]} />
      <PageHeader
        title="Connect a folder"
        description="Index conversations from a local AI coding harness. The folder stays on your machine — nothing is uploaded."
      />
      <FolderConnect />
      <div className="mt-8">
        <EarlyAccessSignup />
      </div>
    </div>
  );
}
