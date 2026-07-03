import { useMemo } from "react";
import { useWalletConnection } from "@solana/react-hooks";
import {
  type CampaignRecord,
  useCampaignPosition,
  useCampaignStatus,
  useUserClaimState,
} from "../../hooks/useCampaigns";
import { useClaim } from "../../hooks/useClaim";
import { useMerkleAllowlist } from "../../hooks/useMerkleAllowlist";
import { formatCampaignTimestamp } from "../../lib/campaign-status";
import { TruncatedExplorerLink } from "../TruncatedExplorerLink";
import { formatTokens, computeVesting } from "../../lib/vesting";

type Props = {
  record: CampaignRecord;
};

function PositionStatus({
  loading,
  hasReceipt,
  hasAsset,
  holdsAsset,
  transferredAway,
}: {
  loading: boolean;
  hasReceipt: boolean;
  hasAsset: boolean;
  holdsAsset: boolean;
  transferredAway: boolean;
}) {
  if (loading) return <>Checking…</>;

  if (!hasReceipt && !hasAsset) {
    return <>No position NFT: first claim mints one</>;
  }

  if (holdsAsset) {
    return <>Position NFT minted: you hold it</>;
  }

  if (transferredAway) {
    return <>Position NFT exists: you minted but no longer hold it</>;
  }

  if (hasAsset) {
    return <>Position NFT exists: held by another wallet</>;
  }

  return <>Claim receipt on-chain: asset account missing</>;
}

const SelectedCampaignPanel = ({ record }: Props) => {
  const { wallet, status } = useWalletConnection();
  const userAddress = wallet?.account.address;

  const {
    isFirstClaim,
    hasAsset,
    hasReceipt,
    loading: claimStateLoading,
    refresh: refreshClaimState,
  } = useUserClaimState(record.address, userAddress);

  const {
    position,
    loading: positionLoading,
    refresh: refreshPosition,
  } = useCampaignPosition(record, userAddress);

  const { claim, isSending, lastResult, error, canClaim, clearResult } =
    useClaim(record);

  const { allowlist, loading: allowlistLoading } = useMerkleAllowlist(
    String(record.address),
    userAddress,
    record.account.merkleRoot,
  );

  const campaignStatus = useCampaignStatus(record.account);
  const holdsAsset =
    position != null &&
    userAddress != null &&
    String(position.owner) === String(userAddress);
  const isSubsequentHolder = holdsAsset && position != null;
  const effectiveFirstClaim = isFirstClaim && !isSubsequentHolder;
  const statusLoading = claimStateLoading || positionLoading;

  const canSubmit =
    canClaim &&
    !isSending &&
    campaignStatus !== "closed" &&
    campaignStatus !== "upcoming" &&
    (effectiveFirstClaim ? allowlist?.onList === true : holdsAsset);

  const allocation =
    position?.attributes.allocation ??
    (allowlist?.onList ? allowlist.allocation : null);
  const claimedSoFar = position?.attributes.claimedSoFar ?? 0n;
  const claimableNow = position?.claimable ?? 0;

  const expectedFirstClaim = useMemo(() => {
    if (!effectiveFirstClaim || !allowlist?.onList) return null;
    return computeVesting({
      allocation: Number(allowlist.allocation),
      claimedSoFar: 0,
      start: record.account.start,
      end: record.account.end,
      cliffDurationSec: record.account.cliffDuration,
      cliffReleaseBps: record.account.cliffReleaseBps,
      now: Math.floor(Date.now() / 1000),
    }).claimable;
  }, [effectiveFirstClaim, allowlist, record.account]);

  const refreshAll = () => {
    void refreshClaimState();
    void refreshPosition();
  };

  return (
    <div className="space-y-4 rounded-xl border border-border-low bg-background/60 p-5">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Claim vested tokens</h3>
        <p className="text-sm text-muted">
          {effectiveFirstClaim
            ? "First claim mints your position NFT and releases vested tokens."
            : "Subsequent claim: no Merkle proof required."}
        </p>
      </div>

      {status === "connected" && (
        <div className="rounded-lg border border-border-low bg-card/40 px-3 py-3 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Your position
          </p>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Position NFT</dt>
              <dd className="text-right text-xs">
                <PositionStatus
                  loading={statusLoading}
                  hasReceipt={hasReceipt}
                  hasAsset={hasAsset}
                  holdsAsset={holdsAsset}
                  transferredAway={position?.transferredAway ?? false}
                />
              </dd>
            </div>
            {allocation != null && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Allocation</dt>
                <dd className="font-mono text-xs">
                  {formatTokens(Number(allocation))} tokens
                </dd>
              </div>
            )}
            {!effectiveFirstClaim && (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Claimed so far</dt>
                  <dd className="font-mono text-xs">
                    {formatTokens(Number(claimedSoFar))} tokens
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Claimable now</dt>
                  <dd className="font-mono text-xs text-emerald-300">
                    {formatTokens(claimableNow)} tokens
                  </dd>
                </div>
              </>
            )}
            {effectiveFirstClaim &&
              allowlist?.onList &&
              expectedFirstClaim != null && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Vested at first claim</dt>
                  <dd className="font-mono text-xs text-emerald-300">
                    ~{formatTokens(expectedFirstClaim)} tokens
                  </dd>
                </div>
              )}
            {position && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Asset</dt>
                <dd className="text-xs">
                  <TruncatedExplorerLink address={String(position.asset)} />
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <dl className="grid gap-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Window</dt>
          <dd className="text-right font-mono text-xs">
            {formatCampaignTimestamp(record.account.start)} →{" "}
            {formatCampaignTimestamp(
              record.account.end + record.account.gracePeriod
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Collection</dt>
          <dd className="text-xs">
            <TruncatedExplorerLink
              address={String(record.account.collection)}
            />
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Token mint</dt>
          <dd className="text-xs">
            <TruncatedExplorerLink
              address={String(record.account.mintToDistribute)}
            />
          </dd>
        </div>
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

      {campaignStatus === "upcoming" && status === "connected" && (
        <p className="rounded-lg border border-border-low px-3 py-2 text-sm text-muted">
          Claims open {formatCampaignTimestamp(record.account.start)}.
          {allowlistLoading
            ? " Checking allowlist…"
            : allowlist?.onList
              ? ` You're on the allowlist (${formatTokens(Number(allowlist.allocation))} tokens allocated).`
              : effectiveFirstClaim
                ? " This wallet isn't on this campaign's allowlist."
                : null}
        </p>
      )}

      {campaignStatus !== "upcoming" &&
        effectiveFirstClaim &&
        allowlist &&
        !allowlist.onList &&
        !allowlistLoading &&
        status === "connected" && (
          <p className="rounded-lg border border-border-low px-3 py-2 text-sm text-muted">
            This wallet is not on this campaign&apos;s allowlist.
          </p>
        )}

      {!effectiveFirstClaim &&
        !holdsAsset &&
        hasAsset &&
        status === "connected" && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            You must hold the position NFT in this wallet to claim again.
          </p>
        )}

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {lastResult && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm space-y-1">
          <p className="font-medium text-emerald-200">
            Claim confirmed — received{" "}
            {formatTokens(Number(lastResult.received))} tokens
          </p>
          <a
            href={lastResult.explorerTxUrl}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            View transaction on Explorer
          </a>
          <div>
            <button
              type="button"
              onClick={() => clearResult()}
              className="text-xs text-muted underline underline-offset-2 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() =>
            void claim().then((result) => {
              if (result) refreshAll();
            })
          }
          disabled={!canSubmit || statusLoading || allowlistLoading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          {isSending
            ? "Confirm in wallet…"
            : effectiveFirstClaim
              ? "First claim (mint position)"
              : "Claim vested tokens"}
        </button>
        <button
          type="button"
          onClick={refreshAll}
          className="rounded-lg border border-border-low px-4 py-2 text-sm transition hover:border-accent/30 cursor-pointer"
        >
          Refresh status
        </button>
      </div>
    </div>
  );
};

export default SelectedCampaignPanel;
