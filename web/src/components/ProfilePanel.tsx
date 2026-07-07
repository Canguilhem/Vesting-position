import { useProfile } from "../hooks/useProfile";
import {
  EmptyState,
  ListPager,
  SectionHeader,
  TruncatedExplorerLink,
} from "./Common/Common";
import { MintCard } from "./Profile/MintCard";
import { CampaignAdminCard } from "./Profile/CampaignAdminCard";
import { PositionCard } from "./Profile/PositionCard";
import { Button } from "@/components/ui/button";
import { AppCallout } from "./Common/AppCard";

export function ProfilePanel() {
  const {
    data,
    loading,
    error,
    refresh,
    isConnected,
    walletAddress,
    campaigns,
    setCampaignPage,
    mints,
    setMintPage,
    positions,
  } = useProfile();

  const { scanProgress, loadMore, setPage: setPositionPage } = positions;

  if (!isConnected) {
    return (
      <AppCallout tone="warning" className="px-4 py-6">
        Connect a wallet to view your profile — campaigns you created, tokens
        you minted, and vesting position NFTs you hold.
      </AppCallout>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {walletAddress && (
          <p className="text-sm text-muted-foreground">
            <TruncatedExplorerLink
              address={String(walletAddress)}
              head={10}
              tail={10}
            />
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => refresh()}
          disabled={loading || scanProgress.loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {error && <AppCallout tone="error">{error}</AppCallout>}

      <section className="space-y-4">
        <SectionHeader
          title="Campaign admin"
          description="Campaigns you launched — freeze, clawback, cancel, and other creator instructions. Distribution tokens tied to them are listed alongside."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h4 className="text-sm font-medium">
              My campaigns ({campaigns?.total ?? 0})
            </h4>
            {loading && !data ? (
              <p className="text-sm text-muted-foreground">Loading campaigns…</p>
            ) : campaigns && campaigns.total > 0 ? (
              <>
                <div className="space-y-3">
                  {campaigns.items.map((c) => (
                    <CampaignAdminCard key={c.address} record={c} />
                  ))}
                </div>
                <ListPager
                  slice={campaigns}
                  onPageChange={setCampaignPage}
                  label="Campaigns"
                />
              </>
            ) : (
              <EmptyState message="No campaigns created with this wallet yet. Launch one from the App tab." />
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium">
              My mints ({mints?.total ?? 0})
            </h4>
            {loading && !data ? (
              <p className="text-sm text-muted-foreground">Loading tokens…</p>
            ) : mints && mints.total > 0 ? (
              <>
                <div className="space-y-3">
                  {mints.items.map((m) => (
                    <MintCard key={String(m.mint)} mint={m} />
                  ))}
                </div>
                <ListPager
                  slice={mints}
                  onPageChange={setMintPage}
                  label="Mints"
                />
              </>
            ) : (
              <EmptyState message="No distribution tokens yet. Create one in the Token tab or launch a campaign with an existing mint." />
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="My positions"
          description="Positions you hold — minted as original recipient or received via transfer."
        />

        {scanProgress.campaignsTotal > 0 && (
          <p className="text-xs text-muted-foreground">
            Scanned {scanProgress.campaignsScanned} of{" "}
            {scanProgress.campaignsTotal} devnet campaigns
            {scanProgress.loading ? "…" : ""}
          </p>
        )}

        {positions.total > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {positions.items.map((p) => (
                <PositionCard key={String(p.asset)} position={p} />
              ))}
            </div>
            <ListPager
              slice={positions}
              onPageChange={setPositionPage}
              label="Positions"
            />
          </>
        ) : scanProgress.loading || (loading && !data) ? (
          <p className="text-sm text-muted-foreground">
            Checking campaigns for positions…
          </p>
        ) : (
          <EmptyState message="No vesting positions found yet. Claim from a campaign to mint your first position." />
        )}

        {!scanProgress.done && positions.total > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => loadMore()}
            disabled={scanProgress.loading}
          >
            {scanProgress.loading
              ? "Scanning more campaigns…"
              : "Scan more campaigns for positions"}
          </Button>
        )}
      </section>
    </div>
  );
}
