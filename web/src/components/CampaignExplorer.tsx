import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Address } from "@solana/addresses";
import { useCampaigns } from "../hooks/useCampaigns";
import { tryParseAddress } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateTokenPanel } from "./CreateTokenPanel";
import { LaunchCampaignWizard } from "./Launch/LaunchCampaignWizard";
import CampaignCard from "./Campaigns/CampaignCard";
import SelectedCampaignPanel from "./Campaigns/SelectedCampaignPanel";
import { AppCard, AppCallout } from "./Common/AppCard";
import { EmptyState } from "./Common/Common";

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
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as "browse" | "token" | "launch")}
      >
        <div className="flex flex-wrap items-center gap-2">
          <TabsList>
            <TabsTrigger value="browse">Browse</TabsTrigger>
            <TabsTrigger value="token">Token</TabsTrigger>
            <TabsTrigger value="launch">Launch</TabsTrigger>
          </TabsList>
          {tab === "browse" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => refresh()}
              disabled={loading}
            >
              {loading ? "Loading…" : "Refresh campaigns"}
            </Button>
          )}
        </div>

        <TabsContent value="token" className="mt-6">
          <AppCard variant="panel" padding="lg">
            <CreateTokenPanel onLaunchWithMint={handleLaunchWithMint} />
          </AppCard>
        </TabsContent>

        <TabsContent value="launch" className="mt-6">
          <LaunchCampaignWizard
            prefilledMint={launchMint}
            onViewCampaign={handleViewCampaign}
          />
        </TabsContent>

        <TabsContent value="browse" className="mt-6 space-y-6">
          {error && <AppCallout tone="error">{error}</AppCallout>}

          {loading && campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Fetching campaigns from devnet…
            </p>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
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
                  <EmptyState message="Select a campaign to view details and claim." />
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
