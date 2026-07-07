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
import {
  getCampaignDisplayName,
  campaignHasRegistryName,
} from "../../lib/campaign-display";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_VARIANT,
  CAMPAIGN_TRANSFER_LABELS,
  CAMPAIGN_TRANSFER_VARIANT,
  CAMPAIGN_TYPE_LABELS,
  CAMPAIGN_TYPE_VARIANT,
  formatCampaignDateRange,
  formatCliffDuration,
  getCampaignDistributionType,
} from "../../lib/campaign-status";
import { TruncatedExplorerLink } from "../Common/Common";
import {
  EntityCard,
  EntityCardContent,
  EntityCardFooter,
} from "../Common/Common";
import { AppCard, AppCallout } from "../Common/AppCard";
import { Badge } from "@/components/ui/badge";
import { ClaimProgressHeader } from "../ClaimProgress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { computePctClaimed } from "../../lib/claim-progress";
import { formatTokens, formatPercent, computeVesting } from "../../lib/vesting";
import { distributionPercent } from "../../solana/campaign-vault";

type Props = {
  record: CampaignRecord;
};

function CampaignSettingsTable({
  record,
  distribution,
  distributionLoading,
}: {
  record: CampaignRecord;
  distribution: {
    distributed: bigint;
    totalDeposit: bigint;
  } | null;
  distributionLoading: boolean;
}) {
  const claimWindowTitle = `${formatCampaignTimestamp(record.account.start)} → ${formatCampaignTimestamp(record.account.end + record.account.gracePeriod)}`;
  const showCampaignAddress = !campaignHasRegistryName(record);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="pb-2 pr-2 text-left font-medium">Deposited</th>
            <th className="pb-2 px-2 text-right font-medium">Paid out</th>
            <th className="pb-2 px-2 text-right font-medium">Cliff</th>
            <th className="pb-2 px-2 text-right font-medium">Cliff %</th>
            <th className="pb-2 pl-2 text-right font-medium">Claim window</th>
          </tr>
        </thead>
        <tbody>
          <tr className="font-mono text-foreground">
            <td className="pr-2 text-left">
              {formatTokens(record.account.totalDeposit)}
            </td>
            <td className="px-2 text-right">
              {distributionLoading ? (
                <span className="text-muted-foreground">…</span>
              ) : distribution ? (
                <>
                  {formatTokens(Number(distribution.distributed))}
                  <span className="text-muted-foreground">
                    {" "}
                    (
                    {distributionPercent(
                      distribution.distributed,
                      distribution.totalDeposit,
                    ).toFixed(1)}
                    %)
                  </span>
                </>
              ) : (
                "—"
              )}
            </td>
            <td className="px-2 text-right">
              {formatCliffDuration(record.account.cliffDuration)}
            </td>
            <td className="px-2 text-right">
              {formatPercent(record.account.cliffReleaseBps)}
            </td>
            <td
              className="pl-2 text-right"
              title={claimWindowTitle}
            >
              {formatCampaignDateRange(record.account)}
            </td>
          </tr>
          <tr className="border-t border-border-low/60">
            <td colSpan={2} className="pt-3 align-top pr-2">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Collection
              </p>
              <TruncatedExplorerLink
                address={String(record.account.collection)}
              />
            </td>
            <td colSpan={showCampaignAddress ? 2 : 3} className="pt-3 align-top px-2">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Token mint
              </p>
              <TruncatedExplorerLink
                address={String(record.account.mintToDistribute)}
              />
            </td>
            {showCampaignAddress && (
              <td className="pt-3 align-top pl-2">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Campaign
                </p>
                <TruncatedExplorerLink address={String(record.address)} />
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PositionAmountsTable({
  allocation,
  claimedSoFar,
  claimable,
  loading = false,
}: {
  allocation: bigint;
  claimedSoFar: bigint;
  claimable: number;
  loading?: boolean;
}) {
  if (loading) {
    return <p className="text-xs text-muted-foreground">Checking position…</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="pb-2 pr-2 text-left font-medium">Allocation</th>
            <th className="pb-2 px-2 text-right font-medium">Claimed</th>
            <th className="pb-2 pl-2 text-right font-medium">Claimable</th>
          </tr>
        </thead>
        <tbody>
          <tr className="font-mono text-foreground">
            <td className="pr-2 text-left">
              {formatTokens(Number(allocation))}
            </td>
            <td className="px-2 text-right">
              {formatTokens(Number(claimedSoFar))}
            </td>
            <td
              className={cn(
                "pl-2 text-right",
                claimable > 0 ? "text-emerald-300" : "text-muted-foreground"
              )}
            >
              {formatTokens(claimable)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const SelectedCampaignPanel = ({ record }: Props) => {
  const { wallet, status } = useWalletConnection();
  const userAddress = wallet?.account.address;

  const {
    isFirstClaim,
    hasAsset,
    loading: claimStateLoading,
    refresh: refreshClaimState,
  } = useUserClaimState(record.address, userAddress);

  const {
    position,
    loading: positionLoading,
    refresh: refreshPosition,
  } = useCampaignPosition(record, userAddress);

  const { claim, isSending, canClaim } = useClaim(record);

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
  const campaignType = getCampaignDistributionType(
    record.account.cliffReleaseBps,
  );
  const transferKey = String(record.account.isTransferable) as "true" | "false";
  const holdsAsset =
    position != null &&
    userAddress != null &&
    String(position.owner) === String(userAddress);
  const transferredAway = position?.transferredAway ?? false;
  const isSubsequentHolder = holdsAsset && position != null;
  const effectiveFirstClaim = isFirstClaim && !isSubsequentHolder;
  const statusLoading = claimStateLoading || positionLoading;

  const allocation =
    position?.attributes.allocation ??
    (allowlist?.onList ? allowlist.allocation : null);
  const claimedSoFar = position?.attributes.claimedSoFar ?? 0n;
  const claimableNow = position?.claimable ?? 0;
  const fullyClaimed =
    position != null && allocation != null && claimedSoFar >= allocation;
  const pctClaimed =
    allocation != null ? computePctClaimed(claimedSoFar, allocation) : 0;
  const showClaimProgressBadge =
    status === "connected" &&
    allocation != null &&
    !transferredAway &&
    (position != null || allowlist?.onList === true);
  const isLoyaltyBadgeFrozen =
    fullyClaimed && position?.isFrozen && record.account.isTransferable;

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

  const effectiveClaimable = effectiveFirstClaim
    ? (expectedFirstClaim ?? 0)
    : claimableNow;

  const canSubmit =
    canClaim &&
    !isSending &&
    !fullyClaimed &&
    campaignStatus !== "closed" &&
    campaignStatus !== "upcoming" &&
    (effectiveFirstClaim
      ? allowlist?.onList === true && effectiveClaimable > 0
      : holdsAsset && claimableNow > 0);

  const positionChecking = statusLoading || allowlistLoading;

  const emptyPositionMessage = (() => {
    if (positionChecking) return null;
    if (campaignStatus === "upcoming") {
      if (allowlist?.onList) {
        return `Claims open ${formatCampaignTimestamp(record.account.start)}. You're on the allowlist (${formatTokens(Number(allowlist.allocation))} tokens allocated).`;
      }
      if (effectiveFirstClaim) {
        return `Claims open ${formatCampaignTimestamp(record.account.start)}. This wallet isn't on this campaign's allowlist.`;
      }
      return `Claims open ${formatCampaignTimestamp(record.account.start)}.`;
    }
    if (effectiveFirstClaim && allowlist && !allowlist.onList) {
      return "This wallet isn't on this campaign's allowlist.";
    }
    return "No position for this wallet yet.";
  })();

  const refreshAll = () => {
    void refreshClaimState();
    void refreshPosition();
    void refreshDistribution();
  };

  const campaignDetails = (
    <AppCard variant="inset" padding="sm" className="gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {getCampaignDisplayName(record)}
          </p>
          {campaignHasRegistryName(record) && (
            <div className="mt-0.5">
              <TruncatedExplorerLink address={String(record.address)} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={CAMPAIGN_STATUS_VARIANT[campaignStatus]}>
            {CAMPAIGN_STATUS_LABELS[campaignStatus]}
          </Badge>
          <Badge variant={CAMPAIGN_TYPE_VARIANT[campaignType]}>
            {CAMPAIGN_TYPE_LABELS[campaignType]}
          </Badge>
          <Badge variant={CAMPAIGN_TRANSFER_VARIANT[transferKey]}>
            {CAMPAIGN_TRANSFER_LABELS[transferKey]}
          </Badge>
        </div>
      </div>
      <CampaignSettingsTable
        record={record}
        distribution={distribution}
        distributionLoading={distributionLoading}
      />
    </AppCard>
  );

  return (
    <EntityCard>
      <EntityCardContent className="space-y-4">
        {campaignDetails}

        {status !== "connected" && (
          <AppCallout tone="warning">Connect a wallet to claim.</AppCallout>
        )}

        {status === "connected" && transferredAway && position && (
          <AppCallout tone="warning" className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Badge variant="transferred">Transferred</Badge>
            </div>
            <p className="text-center text-xs opacity-90">
              You minted this position but no longer hold the NFT. Claim rights
              follow the current holder.
            </p>
            <dl className="grid gap-1.5 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Asset</dt>
                <dd>
                  <TruncatedExplorerLink address={String(position.asset)} />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Current holder</dt>
                <dd>
                  <TruncatedExplorerLink address={String(position.owner)} />
                </dd>
              </div>
            </dl>
          </AppCallout>
        )}

        {status === "connected" && !transferredAway && allocation == null && (
          <AppCard variant="inset" padding="sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your position
            </p>
            <p className="text-xs text-muted-foreground">
              {positionChecking
                ? "Checking position…"
                : emptyPositionMessage}
            </p>
          </AppCard>
        )}

        {status === "connected" && !transferredAway && allocation != null && (
          <AppCard variant="inset" padding="sm" className="gap-3">
            {showClaimProgressBadge ? (
              <ClaimProgressHeader
                pct={pctClaimed}
                frozen={isLoyaltyBadgeFrozen}
              />
            ) : (
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Your position
              </p>
            )}
            {position && (
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="text-muted-foreground">Asset</span>
                <TruncatedExplorerLink address={String(position.asset)} />
              </div>
            )}
            {allocation != null && (
              <PositionAmountsTable
                allocation={allocation}
                claimedSoFar={claimedSoFar}
                claimable={effectiveClaimable}
                loading={false}
              />
            )}
          </AppCard>
        )}

        {!effectiveFirstClaim &&
          !holdsAsset &&
          hasAsset &&
          !transferredAway &&
          status === "connected" && (
            <AppCallout tone="warning">
              You must hold the position NFT in this wallet to claim again.
            </AppCallout>
          )}

        {!effectiveFirstClaim &&
          holdsAsset &&
          claimableNow === 0 &&
          !fullyClaimed &&
          status === "connected" &&
          (campaignStatus === "active" || campaignStatus === "grace") && (
            <AppCard
              variant="inset"
              padding="sm"
              className="text-xs text-muted-foreground"
            >
              Nothing claimable right now — more tokens unlock as the vesting
              schedule progresses.
            </AppCard>
          )}

      </EntityCardContent>

      <EntityCardFooter className="flex flex-wrap gap-3">
        {!fullyClaimed && !transferredAway && (
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
                ? effectiveClaimable > 0
                  ? "First claim (mint position)"
                  : "Nothing claimable yet"
                : holdsAsset && claimableNow === 0
                  ? "Nothing claimable yet"
                  : "Claim vested tokens"}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={refreshAll}>
          Refresh status
        </Button>
      </EntityCardFooter>
    </EntityCard>
  );
};

export default SelectedCampaignPanel;
