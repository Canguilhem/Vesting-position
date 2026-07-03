import { useState } from "react";
import type { Address } from "@solana/addresses";
import { useCampaigns } from "../hooks/useCampaigns";
import { CreateTokenPanel } from "./CreateTokenPanel";
import { InitializeCampaign } from "./InitializeCampaign";
import CampaignCard from "./Campaigns/CampaignCard";
import SelectedCampaignPanel from "./Campaigns/SelectedCampaignPanel";

export function CampaignExplorer() {
  const { campaigns, loading, error, refresh } = useCampaigns();
  const [selected, setSelected] = useState<Address | null>(null);
  const [tab, setTab] = useState<"browse" | "token" | "launch">("browse");
  const [launchMint, setLaunchMint] = useState<Address | null>(null);

  const selectedRecord = selected
    ? campaigns.find((c) => c.address === selected)
    : null;

  const handleViewCampaign = (campaignAddress: Address) => {
    void refresh().then(() => {
      setSelected(campaignAddress);
      setTab("browse");
    });
  };

  const handleLaunchWithMint = (mint: Address) => {
    setLaunchMint(mint);
    setTab("launch");
  };

  return (
    <section className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            On-chain app
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            Devnet campaigns
          </h2>
          <p className="max-w-2xl text-sm text-muted">
            Browse campaigns, mint a distribution token, or launch a campaign
            from your token supply.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border-low p-0.5">
            {(
              [
                ["browse", "Browse"],
                ["token", "Token"],
                ["launch", "Launch"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition cursor-pointer ${
                  tab === id
                    ? "bg-accent/20 text-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "browse" && (
            <button
              type="button"
              onClick={() => refresh()}
              disabled={loading}
              className="rounded-lg border border-border-low px-4 py-2 text-sm font-medium transition hover:border-accent/30 disabled:opacity-60 cursor-pointer"
            >
              {loading ? "Loading…" : "Refresh campaigns"}
            </button>
          )}
        </div>
      </div>

      {tab === "token" ? (
        <CreateTokenPanel onLaunchWithMint={handleLaunchWithMint} />
      ) : tab === "launch" ? (
        <InitializeCampaign
          prefilledMint={launchMint}
          onViewCampaign={handleViewCampaign}
        />
      ) : (
        <>
          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          {loading && campaigns.length === 0 ? (
            <p className="text-sm text-muted">
              Fetching campaigns from devnet…
            </p>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted">
              No campaigns found. Use the Launch tab to create one, or run{" "}
              <code className="font-mono text-xs">yarn test:devnet</code>.
            </p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  {campaigns.length} campaign{campaigns.length === 1 ? "" : "s"}
                </p>
                <div className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
                  {campaigns.map((c) => (
                    <CampaignCard
                      key={c.address}
                      record={c}
                      selected={selected === c.address}
                      onSelect={() => setSelected(c.address)}
                    />
                  ))}
                </div>
              </div>

              <div>
                {selectedRecord ? (
                  <SelectedCampaignPanel record={selectedRecord} />
                ) : (
                  <div className="flex h-full min-h-[240px] items-center justify-center rounded-xl border border-dashed border-border-low p-8 text-center text-sm text-muted">
                    Select a campaign to view details and claim.
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
