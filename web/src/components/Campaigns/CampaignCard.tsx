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
import {
  EntityCardButton,
  EntityCardContent,
  EntityCardMeta,
  TruncatedExplorerLink,
} from "../Common/Common";
import { Badge } from "@/components/ui/badge";
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
    <Badge
      variant="secondary"
      className={`rounded-md border border-border-low px-2 py-0.5 text-[10px] uppercase tracking-wide ${className}`}
    >
      {label}
    </Badge>
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
    <EntityCardButton selected={selected} onClick={onSelect}>
      <EntityCardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <Badge
            className={`shrink-0 px-2.5 py-1 text-xs font-semibold ${CAMPAIGN_STATUS_COLORS[status]}`}
          >
            {CAMPAIGN_STATUS_LABELS[status]}
          </Badge>
          <div className="flex min-w-0 flex-col items-end gap-1.5">
            <TruncatedExplorerLink
              address={String(address)}
              head={6}
              tail={6}
              stopPropagation
              className="text-muted-foreground"
            />
            <div className="flex flex-wrap justify-end gap-1.5">
              <TraitBadge
                label={typePill.label}
                className={typePill.className}
              />
              <TraitBadge
                label={transferPill.label}
                className={transferPill.className}
              />
            </div>
          </div>
        </div>

        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-foreground">
            {formatTokens(account.totalDeposit)} tokens deposited
          </p>
          <p className="text-xs text-muted-foreground">
            {distributionLoading
              ? "Checking vault…"
              : stats
                ? `${formatTokens(stats.distributed)} distributed (${distributionPercent(stats.distributed, stats.totalDeposit).toFixed(1)}%)`
                : "—"}
          </p>
        </div>

        <EntityCardMeta
          className="border-t border-border-low/60 pt-3"
          rows={[
            {
              label: "Claim window",
              value: (
                <>
                  {formatCampaignTimestamp(account.start)} →{" "}
                  {formatCampaignTimestamp(claimWindowEnd)}
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {formatDurationSec(vestingSec)} vesting
                    {account.gracePeriod > 0 &&
                      ` · ${formatDurationSec(account.gracePeriod)} grace after end`}
                  </span>
                </>
              ),
              fullWidth: true,
            },
            {
              label: "Cliff",
              value: (
                <>
                  {formatPercent(account.cliffReleaseBps)} after{" "}
                  {formatDurationSec(account.cliffDuration)}
                </>
              ),
              fullWidth: true,
            },
            {
              label: "Merkle root",
              value: (
                <span
                  className="font-mono text-[10px] text-foreground/80"
                  title={merkleRoot}
                >
                  {truncate(merkleRoot, 10, 10)}
                </span>
              ),
              fullWidth: true,
            },
          ]}
        />
      </EntityCardContent>
    </EntityCardButton>
  );
};

export default CampaignCard;
