import { CampaignRecord } from "../../solana/vesting-positions";
import {
  bytesToHex,
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_TYPE_PILL,
  formatCampaignTimestamp,
  formatDurationSec,
  getCampaignDistributionType,
  TRANSFERABLE_PILL,
} from "../../lib/campaign-status";
import {
  useCampaignStatus,
  useCampaignDistribution,
} from "../../hooks/useCampaigns";
import { TruncatedExplorerLink } from "../Common/Common";
import { truncate } from "../../lib/utils";
import { formatPercent, formatTokens } from "../../lib/vesting";
import { distributionPercent } from "../../solana/campaign-vault";

type Props = {
  record: CampaignRecord;
  onSelect: () => void;
  selected: boolean;
};

function TraitBadge({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={`rounded-md border border-border-low px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}

const CampaignCard = ({ record, onSelect, selected }: Props) => {
  const { account, address } = record;
  const status = useCampaignStatus(account);
  const { stats, loading: distributionLoading } =
    useCampaignDistribution(record);
  const transferPill =
    TRANSFERABLE_PILL[String(account.isTransferable) as "true" | "false"];
  const typePill =
    CAMPAIGN_TYPE_PILL[getCampaignDistributionType(account.cliffReleaseBps)];
  const merkleRoot = bytesToHex(account.merkleRoot);
  const claimWindowEnd = account.end + account.gracePeriod;
  const vestingSec = account.end - account.start;

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
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${CAMPAIGN_STATUS_COLORS[status]}`}
        >
          {CAMPAIGN_STATUS_LABELS[status]}
        </span>
        <div className="flex min-w-0 flex-col items-end gap-1.5">
          <TruncatedExplorerLink
            address={String(address)}
            head={6}
            tail={6}
            stopPropagation
            className="text-muted"
          />
          <div className="flex flex-wrap justify-end gap-1.5">
            <TraitBadge label={typePill.label} className={typePill.className} />
            <TraitBadge
              label={transferPill.label}
              className={transferPill.className}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-0.5">
        <p className="text-sm font-semibold text-foreground">
          {formatTokens(account.totalDeposit)} tokens deposited
        </p>
        <p className="text-xs text-muted">
          {distributionLoading
            ? "Checking vault…"
            : stats
              ? `${formatTokens(stats.distributed)} distributed (${distributionPercent(stats.distributed, stats.totalDeposit).toFixed(1)}%)`
              : "—"}
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border-low/60 pt-3 text-xs text-muted">
        <div className="col-span-2">
          <dt>Claim window</dt>
          <dd className="mt-0.5 text-foreground">
            {formatCampaignTimestamp(account.start)} →{" "}
            {formatCampaignTimestamp(claimWindowEnd)}
          </dd>
          <dd className="mt-0.5 text-[11px]">
            {formatDurationSec(vestingSec)} vesting
            {account.gracePeriod > 0 &&
              ` · ${formatDurationSec(account.gracePeriod)} grace after end`}
          </dd>
        </div>

        <div className="col-span-2">
          <dt>Cliff</dt>
          <dd className="mt-0.5 text-foreground">
            {formatPercent(account.cliffReleaseBps)} after{" "}
            {formatDurationSec(account.cliffDuration)}
          </dd>
        </div>

        <div className="col-span-2">
          <dt>Merkle root</dt>
          <dd
            className="mt-0.5 font-mono text-[10px] text-foreground/80"
            title={merkleRoot}
          >
            {truncate(merkleRoot, 10, 10)}
          </dd>
        </div>
      </dl>
    </button>
  );
};

export default CampaignCard;
