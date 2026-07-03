import { useProfile } from "../hooks/useProfile";
import { truncate } from "../lib/utils";
import { EmptyState, ListPager } from "./Common/Common";
import { MintCard } from "./Profile/MintCard";
import { CampaignAdminCard } from "./Profile/CampaignAdminCard";
import { PositionCard } from "./Profile/PositionCard";

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
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-6 text-sm text-amber-200">
        Connect a wallet to view your profile — campaigns you created, tokens
        you minted, and vesting position NFTs you hold.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Wallet profile
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            Your activity
          </h2>
          {walletAddress && (
            <p className="font-mono text-sm text-muted">
              {truncate(String(walletAddress), 10, 10)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          disabled={loading || scanProgress.loading}
          className="rounded-lg border border-border-low px-4 py-2 text-sm font-medium transition hover:border-accent/30 disabled:opacity-60 cursor-pointer"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Campaign admin</h3>
          <p className="text-sm text-muted">
            Campaigns you launched — freeze, clawback, cancel, and other creator
            instructions. Distribution tokens tied to them are listed alongside.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h4 className="text-sm font-medium">
              My campaigns ({campaigns?.total ?? 0})
            </h4>
            {loading && !data ? (
              <p className="text-sm text-muted">Loading campaigns…</p>
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
              <p className="text-sm text-muted">Loading tokens…</p>
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
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">My positions</h3>
          <p className="text-sm text-muted">
            Positions you hold — minted as original recipient or received via
            transfer.
          </p>
        </div>

        {scanProgress.campaignsTotal > 0 && (
          <p className="text-xs text-muted">
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
          <p className="text-sm text-muted">
            Checking campaigns for positions…
          </p>
        ) : (
          <EmptyState message="No vesting positions found yet. Claim from a campaign to mint your first position." />
        )}

        {!scanProgress.done && positions.total > 0 && (
          <button
            type="button"
            onClick={() => loadMore()}
            disabled={scanProgress.loading}
            className="rounded-lg border border-border-low px-4 py-2 text-sm font-medium transition hover:border-accent/30 disabled:opacity-60 cursor-pointer"
          >
            {scanProgress.loading
              ? "Scanning more campaigns…"
              : "Scan more campaigns for positions"}
          </button>
        )}
      </section>
    </div>
  );
}
