import { CampaignExplorer } from "../components/CampaignExplorer";
import { PageHeader } from "../components/Common/Common";

export function AppPage() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl space-y-8 px-6 pb-24 pt-10">
      <PageHeader
        eyebrow="On-chain app"
        title="Devnet campaigns"
        description="Browse campaigns or launch a new one via the guided wizard (token → allowlist → settings)."
      />
      <CampaignExplorer />
    </main>
  );
}
