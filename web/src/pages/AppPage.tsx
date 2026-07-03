import { CampaignExplorer } from "../components/CampaignExplorer";

export function AppPage() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-10">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          On-chain app
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">
          Devnet campaigns
        </h2>
        <p className="max-w-2xl text-sm text-muted">
          Browse campaigns or launch a new one via the guided wizard (token →
          allowlist → settings).
        </p>
      </div>
      <CampaignExplorer />
    </main>
  );
}
