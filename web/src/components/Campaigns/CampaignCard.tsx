import { CampaignRecord } from "../../solana/vesting-positions";
import {
  bytesToHex,
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
  formatCampaignTimestamp,
  formatDurationSec,
  TRANSFERABLE_PILL,
} from "../../lib/campaign-status";
import { useCampaignStatus } from "../../hooks/useCampaigns";
import { TruncatedExplorerLink } from "../TruncatedExplorerLink";
import { truncate } from "../../lib/utils";
import { formatPercent, formatTokens } from "../../lib/vesting";

type Props = {
  record: CampaignRecord;
  onSelect: () => void;
  selected: boolean;
};

const CampaignCard = ({ record, onSelect, selected }: Props) => {
  const { account, address } = record;
  const status = useCampaignStatus(account);
  const transferPill = TRANSFERABLE_PILL[String(account.isTransferable) as "true" | "false"];
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
        <div>
          <p className="font-mono text-xs text-muted">
            <TruncatedExplorerLink
              address={String(address)}
              stopPropagation
            />
          </p>
          <p className="mt-1 text-sm font-medium">
            {formatTokens(account.totalDeposit)} tokens locked
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${transferPill.className}`}
          >
            {transferPill.label}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${CAMPAIGN_STATUS_COLORS[status]}`}
          >
            {CAMPAIGN_STATUS_LABELS[status]}
          </span>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-muted">
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
