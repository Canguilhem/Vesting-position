import { useEffect, useState } from "react";
import type { Address } from "@solana/addresses";
import {
  useCampaigns,
  useUserClaimState,
  type CampaignRecord,
} from "../hooks/useCampaigns";
import {
  getCampaignStatus,
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
} from "../lib/campaign-status";
import { useClaim } from "../hooks/useClaim";
import { CreateTokenPanel } from "./CreateTokenPanel";
import { InitializeCampaign } from "./InitializeCampaign";
import { formatPercent, formatTokens } from "../lib/vesting";
import {
  getMerkleProofForWallet,
  merkleRootMatchesCampaign,
} from "../lib/merkle";
import { useWalletConnection } from "@solana/react-hooks";

function truncate(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function formatTimestamp(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString();
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const STATUS_LABELS = CAMPAIGN_STATUS_LABELS;
const STATUS_COLORS = CAMPAIGN_STATUS_COLORS;

function CampaignCard({
  record,
  onSelect,
  selected,
}: {
  record: CampaignRecord;
  onSelect: () => void;
  selected: boolean;
}) {
  const status = getCampaignStatus(record.account);
  const merkleRoot = bytesToHex(record.account.merkleRoot);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left transition cursor-pointer ${
        selected
          ? "border-accent/50 bg-accent/10"
          : "border-border-low bg-card/50 hover:border-accent/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted">
            {truncate(record.address, 8, 8)}
          </p>
          <p className="mt-1 text-sm font-medium">
            {formatTokens(record.account.totalDeposit)} tokens locked
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
        <div>
          <dt>Cliff release</dt>
          <dd className="font-mono text-foreground">
            {formatPercent(record.account.cliffReleaseBps)}
          </dd>
        </div>
        <div>
          <dt>Transferable</dt>
          <dd className="text-foreground">
            {record.account.isTransferable ? "Yes" : "No"}
          </dd>
        </div>
        <div className="col-span-2">
          <dt>Merkle root</dt>
          <dd className="font-mono text-[10px] break-all text-foreground/80">
            {merkleRoot}
          </dd>
        </div>
      </dl>
    </button>
  );
}

function ClaimPanel({ record }: { record: CampaignRecord }) {
  const { wallet, status } = useWalletConnection();
  const userAddress = wallet?.account.address;

  const {
    isFirstClaim,
    hasAsset,
    loading: claimStateLoading,
    refresh,
  } = useUserClaimState(record.address, userAddress);

  const { claim, isSending, signature, explorerTxUrl, error, canClaim } =
    useClaim(record.address, record.account);

  const [allowlist, setAllowlist] = useState<{
    allocation: bigint;
    onList: boolean;
  } | null>(null);

  useEffect(() => {
    if (!userAddress) {
      setAllowlist(null);
      return;
    }
    void getMerkleProofForWallet(userAddress).then((proof) => {
      if (!proof) {
        setAllowlist({ allocation: 0n, onList: false });
        return;
      }
      setAllowlist({
        allocation: proof.allocation,
        onList: merkleRootMatchesCampaign(
          record.account.merkleRoot,
          proof.merkleRoot,
        ),
      });
    });
  }, [userAddress, record.account.merkleRoot]);

  const campaignStatus = getCampaignStatus(record.account);
  const canSubmit =
    canClaim &&
    !isSending &&
    campaignStatus !== "closed" &&
    campaignStatus !== "upcoming" &&
    (isFirstClaim ? allowlist?.onList === true : hasAsset);

  return (
    <div className="space-y-4 rounded-xl border border-border-low bg-background/60 p-5">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Claim vested tokens</h3>
        <p className="text-sm text-muted">
          {isFirstClaim
            ? "First claim mints your position NFT and releases vested tokens."
            : "Subsequent claim — no Merkle proof required."}
        </p>
      </div>

      <dl className="grid gap-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Window</dt>
          <dd className="text-right font-mono text-xs">
            {formatTimestamp(record.account.start)} →{" "}
            {formatTimestamp(record.account.end + record.account.gracePeriod)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Collection</dt>
          <dd className="font-mono text-xs">
            {truncate(record.account.collection)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Token mint</dt>
          <dd className="font-mono text-xs">
            {truncate(record.account.mintToDistribute)}
          </dd>
        </div>
        {allowlist && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Your allocation</dt>
            <dd className="font-mono text-xs">
              {allowlist.onList
                ? formatTokens(Number(allowlist.allocation))
                : "Not on allowlist"}
            </dd>
          </div>
        )}
      </dl>

      {status !== "connected" && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Connect a wallet to claim.
        </p>
      )}

      {campaignStatus === "closed" && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          Claim window closed for this campaign. Deploy a fresh campaign on
          devnet to test live claims.
        </p>
      )}

      {isFirstClaim &&
        allowlist &&
        !allowlist.onList &&
        status === "connected" && (
          <p className="rounded-lg border border-border-low px-3 py-2 text-sm text-muted">
            This wallet is not on the bundled demo allowlist (
            <code className="font-mono text-xs">merkle_proofs.json</code>).
          </p>
        )}

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {signature && explorerTxUrl && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
          Transaction sent —{" "}
          <a
            href={explorerTxUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-2"
          >
            view on Explorer
          </a>
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void claim().then(() => refresh())}
          disabled={!canSubmit || claimStateLoading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          {isSending
            ? "Confirm in wallet…"
            : isFirstClaim
              ? "First claim (mint position)"
              : "Claim vested tokens"}
        </button>
        <button
          type="button"
          onClick={() => refresh()}
          className="rounded-lg border border-border-low px-4 py-2 text-sm transition hover:border-accent/30 cursor-pointer"
        >
          Refresh status
        </button>
      </div>
    </div>
  );
}

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
    <section className="space-y-6 rounded-2xl border border-border-low bg-card p-6">
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
            <p className="text-sm text-muted">Fetching campaigns from devnet…</p>
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
                  <ClaimPanel record={selectedRecord} />
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
