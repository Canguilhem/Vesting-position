import { useSearchParams } from "react-router-dom";
import { useProfile } from "../hooks/useProfile";
import { sortPositionsForProfile, splitProfilePositions } from "../lib/profile-positions";
import {
  EmptyState,
  ListPager,
  TruncatedExplorerLink,
} from "./Common/Common";
import { MintDataTable } from "./Profile/MintDataTable";
import { CampaignAdminDataTable } from "./Profile/CampaignAdminDataTable";
import { PositionDataTable } from "./Profile/PositionDataTable";
import { Button } from "@/components/ui/button";
import { AppCallout } from "./Common/AppCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ProfileTab = "positions" | "campaigns" | "mints";

function parseProfileTab(value: string | null): ProfileTab {
  if (value === "campaigns" || value === "mints") return value;
  return "positions";
}

export function ProfilePanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseProfileTab(searchParams.get("tab"));

  const {
    data,
    loading,
    refresh,
    isConnected,
    walletAddress,
    campaigns,
    setCampaignPage,
    mints,
    setMintPage,
    positions,
  } = useProfile();

  const {
    scanProgress,
    loadMore,
    setPage: setPositionPage,
    items: positionItems,
    total: positionsTotal,
  } = positions;
  const sortedPositions = sortPositionsForProfile(positionItems);
  const { held, past } = splitProfilePositions(sortedPositions);

  const setTab = (next: ProfileTab) => {
    setSearchParams(
      next === "positions" ? {} : { tab: next },
      { replace: true },
    );
  };

  if (!isConnected) {
    return (
      <AppCallout tone="warning" className="px-4 py-6">
        Connect a wallet to view your profile — campaigns you created, tokens
        you minted, and vesting position NFTs you hold.
      </AppCallout>
    );
  }

  return (
    <div className="space-y-6">
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

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(parseProfileTab(value))}
      >
        <TabsList>
          <TabsTrigger value="positions">
            My positions{positionsTotal > 0 ? ` (${positionsTotal})` : ""}
          </TabsTrigger>
          <TabsTrigger value="campaigns">
            My campaigns{campaigns && campaigns.total > 0 ? ` (${campaigns.total})` : ""}
          </TabsTrigger>
          <TabsTrigger value="mints">
            My mints{mints && mints.total > 0 ? ` (${mints.total})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="positions" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Positions you hold — minted as original recipient or received via
            transfer.
          </p>

          {scanProgress.campaignsTotal > 0 && (
            <p className="text-xs text-muted-foreground">
              Scanned {scanProgress.campaignsScanned} of{" "}
              {scanProgress.campaignsTotal} devnet campaigns
              {scanProgress.loading ? "…" : ""}
            </p>
          )}

          {positionsTotal > 0 ? (
            <>
              <PositionDataTable positions={held} />
              {past.length > 0 && (
                <div className="space-y-2">
                  <div>
                    <h4 className="text-sm font-medium">Past positions</h4>
                    <p className="text-xs text-muted-foreground">
                      You minted these but transferred the NFT away — claim
                      rights follow the current holder.
                    </p>
                  </div>
                  <PositionDataTable positions={past} />
                </div>
              )}
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

          {!scanProgress.done && positionsTotal > 0 && (
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
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Campaigns you launched — freeze, clawback, cancel, and other creator
            instructions.
          </p>

          {loading && !data ? (
            <p className="text-sm text-muted-foreground">Loading campaigns…</p>
          ) : campaigns && campaigns.total > 0 ? (
            <>
              <CampaignAdminDataTable campaigns={campaigns.items} />
              <ListPager
                slice={campaigns}
                onPageChange={setCampaignPage}
                label="Campaigns"
              />
            </>
          ) : (
            <EmptyState message="No campaigns created with this wallet yet. Launch one from the App tab." />
          )}
        </TabsContent>

        <TabsContent value="mints" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Distribution tokens you created or use in your campaigns.
          </p>

          {loading && !data ? (
            <p className="text-sm text-muted-foreground">Loading tokens…</p>
          ) : mints && mints.total > 0 ? (
            <>
              <MintDataTable mints={mints.items} />
              <ListPager
                slice={mints}
                onPageChange={setMintPage}
                label="Mints"
              />
            </>
          ) : (
            <EmptyState message="No distribution tokens yet. Create one in the Token tab or launch a campaign with an existing mint." />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
