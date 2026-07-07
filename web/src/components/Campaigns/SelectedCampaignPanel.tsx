import { useMemo } from "react";
import { useWalletConnection } from "@solana/react-hooks";
import {
  type CampaignRecord,
  useCampaignPosition,
  useCampaignStatus,
  useCampaignDistribution,
  useUserClaimState,
} from "../../hooks/useCampaigns";
import { useClaim } from "../../hooks/useClaim";
import { useMerkleAllowlist } from "../../hooks/useMerkleAllowlist";
import { formatCampaignTimestamp } from "../../lib/campaign-status";
import { TruncatedExplorerLink, TruncatedTxLink } from "../Common/Common";
import {
  EntityCard,
  EntityCardContent,
  EntityCardFooter,
  EntityCardHeader,
} from "../Common/Common";
import { AppCard, AppCallout } from "../Common/AppCard";
import { Button } from "@/components/ui/button";
import { formatTokens, computeVesting } from "../../lib/vesting";
import { distributionPercent } from "../../solana/campaign-vault";

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
    record.account.merkleRoot
  );

  const {
    stats: distribution,
    loading: distributionLoading,
    refresh: refreshDistribution,
  } = useCampaignDistribution(record);

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
    void refreshDistribution();
  };

  return (
    <EntityCard>
      <EntityCardHeader
        title="Claim vested tokens"
        description={
          effectiveFirstClaim
            ? "Provide merkle proofs and get your position minted"
            : "No Merkle proof required, claim via your position"
        }
      />

      <EntityCardContent className="space-y-4">
      {status === "connected" && (
        <AppCard variant="inset" padding="sm" className="gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Your position
          </p>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Position NFT</dt>
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
                <dt className="text-muted-foreground">Allocation</dt>
                <dd className="font-mono text-xs">
                  {formatTokens(Number(allocation))} tokens
                </dd>
              </div>
            )}
            {!effectiveFirstClaim && (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Claimed so far</dt>
                  <dd className="font-mono text-xs">
                    {formatTokens(Number(claimedSoFar))} tokens
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Claimable now</dt>
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
                  <dt className="text-muted-foreground">Vested at first claim</dt>
                  <dd className="font-mono text-xs text-emerald-300">
                    ~{formatTokens(expectedFirstClaim)} tokens
                  </dd>
                </div>
              )}
            {position && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Asset</dt>
                <dd className="text-xs">
                  <TruncatedExplorerLink address={String(position.asset)} />
                </dd>
              </div>
            )}
          </dl>
        </AppCard>
      )}

      <dl className="grid gap-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Distributed (all wallets)</dt>
          <dd className="text-right font-mono text-xs">
            {distributionLoading
              ? "Checking vault…"
              : distribution
                ? `${formatTokens(distribution.distributed)} / ${formatTokens(distribution.totalDeposit)} (${distributionPercent(distribution.distributed, distribution.totalDeposit).toFixed(1)}%)`
                : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Window</dt>
          <dd className="text-right font-mono text-xs">
            {formatCampaignTimestamp(record.account.start)} →{" "}
            {formatCampaignTimestamp(
              record.account.end + record.account.gracePeriod
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Collection</dt>
          <dd className="text-xs">
            <TruncatedExplorerLink
              address={String(record.account.collection)}
            />
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Token mint</dt>
          <dd className="text-xs">
            <TruncatedExplorerLink
              address={String(record.account.mintToDistribute)}
            />
          </dd>
        </div>
      </dl>

      {status !== "connected" && (
        <AppCallout tone="warning">Connect a wallet to claim.</AppCallout>
      )}

      {campaignStatus === "closed" && (
        <AppCallout tone="error">
          Claim window closed for this campaign. Deploy a fresh campaign on
          devnet to test live claims.
        </AppCallout>
      )}

      {campaignStatus === "upcoming" && status === "connected" && (
        <AppCard variant="inset" padding="sm" className="text-muted-foreground">
          Claims open {formatCampaignTimestamp(record.account.start)}.
          {allowlistLoading
            ? " Checking allowlist…"
            : allowlist?.onList
              ? ` You're on the allowlist (${formatTokens(Number(allowlist.allocation))} tokens allocated).`
              : effectiveFirstClaim
                ? " This wallet isn't on this campaign's allowlist."
                : null}
        </AppCard>
      )}

      {campaignStatus !== "upcoming" &&
        effectiveFirstClaim &&
        allowlist &&
        !allowlist.onList &&
        !allowlistLoading &&
        status === "connected" && (
          <AppCard variant="inset" padding="sm" className="text-muted-foreground">
            This wallet is not on this campaign&apos;s allowlist.
          </AppCard>
        )}

      {!effectiveFirstClaim &&
        !holdsAsset &&
        hasAsset &&
        status === "connected" && (
          <AppCallout tone="warning">
            You must hold the position NFT in this wallet to claim again.
          </AppCallout>
        )}

      {error && <AppCallout tone="error">{error}</AppCallout>}

      {lastResult && (
        <AppCallout tone="success" className="space-y-1">
          <p className="font-medium">
            Claim confirmed — received{" "}
            {formatTokens(Number(lastResult.received))} tokens
          </p>
          <TruncatedTxLink
            signature={lastResult.signature}
            head={10}
            tail={10}
          />
          <div>
            <Button
              type="button"
              variant="link"
              size="xs"
              className="h-auto p-0 text-xs text-muted-foreground"
              onClick={() => clearResult()}
            >
              Dismiss
            </Button>
          </div>
        </AppCallout>
      )}
      </EntityCardContent>

      <EntityCardFooter className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() =>
            void claim().then((result) => {
              if (result) refreshAll();
            })
          }
          disabled={!canSubmit || statusLoading || allowlistLoading}
        >
          {isSending
            ? "Confirm in wallet…"
            : effectiveFirstClaim
              ? "First claim (mint position)"
              : "Claim vested tokens"}
        </Button>
        <Button type="button" variant="outline" onClick={refreshAll}>
          Refresh status
        </Button>
      </EntityCardFooter>
    </EntityCard>
  );
};

export default SelectedCampaignPanel;
