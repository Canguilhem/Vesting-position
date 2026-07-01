import { Link } from "react-router-dom";
import type { Address } from "@solana/addresses";
import { useProfile } from "../hooks/useProfile";
import {
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
  getCampaignStatus,
} from "../lib/campaign-status";
import type { PageSlice } from "../lib/pagination";
import { formatPercent, formatTokens } from "../lib/vesting";
import type { CampaignRecord } from "../hooks/useCampaigns";
import type { PositionRecord } from "../solana/profile-data";
import type { ProfileMint } from "../hooks/useProfile";

function truncate(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function formatTimestamp(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString();
}

function explorerAddressUrl(addr: Address | string): string {
  return `https://explorer.solana.com/address/${addr}?cluster=devnet`;
}

function CopyButton({ value }: { value: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(value)}
      className="rounded-md border border-border-low px-2 py-0.5 text-xs text-muted transition hover:border-accent/40 hover:text-foreground cursor-pointer"
    >
      Copy
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border-low px-4 py-8 text-center text-sm text-muted">
      {message}
    </div>
  );
}

function ListPager<T>({
  slice,
  onPageChange,
  label,
}: {
  slice: PageSlice<T> | null;
  onPageChange: (page: number) => void;
  label: string;
}) {
  if (!slice || slice.total === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
      <p className="text-xs text-muted">
        {label}: page {slice.page + 1} of {slice.totalPages} ({slice.total}{" "}
        total)
      </p>
      {slice.totalPages > 1 && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!slice.hasPrev}
            onClick={() => onPageChange(slice.page - 1)}
            className="rounded-md border border-border-low px-2.5 py-1 text-xs transition hover:border-accent/30 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={!slice.hasNext}
            onClick={() => onPageChange(slice.page + 1)}
            className="rounded-md border border-border-low px-2.5 py-1 text-xs transition hover:border-accent/30 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function CampaignAdminCard({ record }: { record: CampaignRecord }) {
  const status = getCampaignStatus(record.account);

  return (
    <article className="rounded-xl border border-border-low bg-background/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted">
            {truncate(record.address, 8, 8)}
          </p>
          <p className="mt-1 text-sm font-medium">
            {formatTokens(record.account.totalDeposit)} deposited
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${CAMPAIGN_STATUS_COLORS[status]}`}
        >
          {CAMPAIGN_STATUS_LABELS[status]}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs text-muted">
        <div>
          <dt>Mint</dt>
          <dd className="font-mono text-foreground">
            {truncate(record.account.mintToDistribute)}
          </dd>
        </div>
        <div>
          <dt>Cliff release</dt>
          <dd className="font-mono text-foreground">
            {formatPercent(record.account.cliffReleaseBps)}
          </dd>
        </div>
        <div className="col-span-2">
          <dt>Claim window</dt>
          <dd className="font-mono text-[10px] text-foreground/90">
            {formatTimestamp(record.account.start)} →{" "}
            {formatTimestamp(record.account.end + record.account.gracePeriod)}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <a
          href={explorerAddressUrl(record.address)}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-accent underline underline-offset-2"
        >
          Explorer
        </a>
        <Link
          to="/app"
          className="text-xs text-muted hover:text-foreground transition"
        >
          Open in app →
        </Link>
      </div>
    </article>
  );
}

function MintCard({ mint }: { mint: ProfileMint }) {
  return (
    <article className="rounded-xl border border-border-low bg-background/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{mint.label ?? "Distribution token"}</p>
          <p className="font-mono text-xs text-muted mt-0.5">
            {truncate(String(mint.mint), 8, 8)}
          </p>
        </div>
        <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
          {mint.source === "local" ? "Created here" : "On-chain only"}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs text-muted">
        <div>
          <dt>Supply</dt>
          <dd className="font-mono text-foreground">
            {mint.supply > 0n ? formatTokens(Number(mint.supply)) : "—"}
          </dd>
        </div>
        <div>
          <dt>Your balance</dt>
          <dd className="font-mono text-foreground">
            {formatTokens(Number(mint.walletBalance))}
          </dd>
        </div>
        <div>
          <dt>Decimals</dt>
          <dd className="font-mono text-foreground">{mint.decimals}</dd>
        </div>
        <div>
          <dt>Campaigns</dt>
          <dd className="font-mono text-foreground">{mint.campaignsUsingMint}</dd>
        </div>
      </dl>
      <div className="flex items-center gap-2">
        <CopyButton value={String(mint.mint)} />
        <a
          href={explorerAddressUrl(mint.mint)}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-accent underline underline-offset-2"
        >
          Explorer
        </a>
      </div>
    </article>
  );
}

function PositionCard({ position }: { position: PositionRecord }) {
  const { campaign, attributes } = position;
  const pctClaimed =
    attributes.allocation > 0n
      ? Number((attributes.claimedSoFar * 10000n) / attributes.allocation) /
        100
      : 0;

  return (
    <article className="rounded-xl border border-border-low bg-background/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">Vesting position</p>
          <p className="font-mono text-xs text-muted mt-0.5">
            Asset {truncate(position.asset, 8, 8)}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${CAMPAIGN_STATUS_COLORS[position.campaignStatus]}`}
        >
          {CAMPAIGN_STATUS_LABELS[position.campaignStatus]}
        </span>
      </div>

      {position.transferredAway && (
        <p className="text-xs text-amber-200/90">
          You minted this position but no longer hold the NFT.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-2 text-xs text-muted">
        <div>
          <dt>Allocation</dt>
          <dd className="font-mono text-foreground">
            {formatTokens(Number(attributes.allocation))}
          </dd>
        </div>
        <div>
          <dt>Claimed</dt>
          <dd className="font-mono text-foreground">
            {formatTokens(Number(attributes.claimedSoFar))} (
            {pctClaimed.toFixed(1)}%)
          </dd>
        </div>
        <div>
          <dt>Claimable now</dt>
          <dd className="font-mono text-emerald-300">
            {formatTokens(position.claimable)}
          </dd>
        </div>
        <div>
          <dt>Holder</dt>
          <dd className="font-mono text-foreground">
            {position.isOriginalRecipient && !position.transferredAway
              ? "You"
              : truncate(String(position.owner))}
          </dd>
        </div>
        <div className="col-span-2">
          <dt>Campaign</dt>
          <dd className="font-mono text-[10px] text-foreground/90">
            {truncate(campaign.address, 8, 8)}
          </dd>
        </div>
      </dl>

      {position.fullyVested && (
        <p className="text-xs text-amber-200/90">
          Fully vested — position may be frozen as a loyalty badge.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <a
          href={explorerAddressUrl(position.asset)}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-accent underline underline-offset-2"
        >
          View asset
        </a>
        <Link
          to="/app"
          className="text-xs text-muted hover:text-foreground transition"
        >
          Claim in app →
        </Link>
      </div>
    </article>
  );
}

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
          <h2 className="text-2xl font-semibold tracking-tight">Your activity</h2>
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
            Campaigns you launched and distribution tokens tied to them.
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
            Positions you minted as original recipient (including transferred).
            Positions bought on secondary markets will appear once we index via
            Supabase.
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
          <p className="text-sm text-muted">Checking campaigns for positions…</p>
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
