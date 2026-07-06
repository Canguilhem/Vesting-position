import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Address } from "@solana/addresses";
import { useCampaigns } from "../hooks/useCampaigns";
import { tryParseAddress } from "../lib/utils";
import { CreateTokenPanel } from "./CreateTokenPanel";
import { LaunchCampaignWizard } from "./Launch/LaunchCampaignWizard";
import CampaignCard from "./Campaigns/CampaignCard";
import SelectedCampaignPanel from "./Campaigns/SelectedCampaignPanel";

export function CampaignExplorer() {
  const { campaigns, loading, error, refresh } = useCampaigns();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<Address | null>(null);
  const [tab, setTab] = useState<"browse" | "token" | "launch">("browse");
  const [launchMint, setLaunchMint] = useState<Address | null>(null);

  const campaignParam = searchParams.get("campaign");

  useEffect(() => {
    if (!campaignParam || campaigns.length === 0) return;
    const parsed = tryParseAddress(campaignParam);
    if (!parsed) return;
    const match = campaigns.find((c) => String(c.address) === String(parsed));
    if (match) {
      setSelected(match.address);
      setTab("browse");
    }
  }, [campaignParam, campaigns]);

  const selectCampaign = (campaignAddress: Address) => {
    setSelected(campaignAddress);
    setTab("browse");
    setSearchParams({ campaign: String(campaignAddress) }, { replace: true });
  };

  const selectedRecord = selected
    ? campaigns.find((c) => c.address === selected)
    : null;

  const handleViewCampaign = (campaignAddress: Address) => {
    void refresh().then(() => {
      selectCampaign(campaignAddress);
    });
  };

  const handleLaunchWithMint = (mint: Address) => {
    setLaunchMint(mint);
    setTab("launch");
  };

  return (
    <section className="space-y-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
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
        <LaunchCampaignWizard
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
                      onSelect={() => selectCampaign(c.address)}
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
