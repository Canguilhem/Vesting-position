import type { Address } from "@solana/addresses";
import { CampaignRecord } from "../../solana/vesting-positions";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_VARIANT,
  CAMPAIGN_TRANSFER_LABELS,
  CAMPAIGN_TRANSFER_VARIANT,
  CAMPAIGN_TYPE_LABELS,
  CAMPAIGN_TYPE_VARIANT,
  formatCampaignTimestamp,
  formatCampaignWindowShort,
  getCampaignDistributionType,
} from "../../lib/campaign-status";
import {
  useCampaignStatus,
  useCampaignDistribution,
} from "../../hooks/useCampaigns";
import { useClusterTime } from "../../hooks/useClusterTime";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatTokens } from "../../lib/vesting";
import { distributionPercent } from "../../solana/campaign-vault";
import {
  campaignHasRegistryName,
  getCampaignDisplayName,
} from "../../lib/campaign-display";

type Props = {
  campaigns: CampaignRecord[];
  selected: Address | null;
  onSelect: (address: Address) => void;
};

function NameCell({ record }: { record: CampaignRecord }) {
  const hasName = campaignHasRegistryName(record);
  return (
    <div className="min-w-0 max-w-[14rem]">
      <span
        className={cn(
          "block truncate text-xs",
          hasName ? "font-medium text-foreground" : "font-mono text-muted-foreground",
        )}
        title={getCampaignDisplayName(record)}
      >
        {getCampaignDisplayName(record)}
      </span>
    </div>
  );
}

function StatusCell({ record }: { record: CampaignRecord }) {
  const status = useCampaignStatus(record.account);
  return (
    <Badge variant={CAMPAIGN_STATUS_VARIANT[status]} className="text-[10px]">
      {CAMPAIGN_STATUS_LABELS[status]}
    </Badge>
  );
}

function DistributedCell({ record }: { record: CampaignRecord }) {
  const { stats, loading } = useCampaignDistribution(record);
  return (
    <span className="font-mono text-xs text-muted-foreground">
      {loading
        ? "…"
        : stats
          ? `${distributionPercent(stats.distributed, stats.totalDeposit).toFixed(1)}%`
          : "—"}
    </span>
  );
}

function ScheduleCell({ record }: { record: CampaignRecord }) {
  const { clusterNowSec } = useClusterTime();
  const nowSec = clusterNowSec ?? Math.floor(Date.now() / 1000);
  const windowEnd = record.account.end + record.account.gracePeriod;
  const label = formatCampaignWindowShort(record.account, nowSec);
  const title = `${formatCampaignTimestamp(record.account.start)} → ${formatCampaignTimestamp(windowEnd)}`;

  return (
    <span className="font-mono text-xs text-muted-foreground" title={title}>
      {label}
    </span>
  );
}

function CampaignDataRow({
  record,
  selected,
  onSelect,
}: {
  record: CampaignRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  const type = getCampaignDistributionType(record.account.cliffReleaseBps);
  const transferKey = String(record.account.isTransferable) as "true" | "false";

  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      className="cursor-pointer"
      onClick={onSelect}
    >
      <TableCell>
        <NameCell record={record} />
      </TableCell>
      <TableCell>
        <StatusCell record={record} />
      </TableCell>
      <TableCell>
        <Badge variant={CAMPAIGN_TYPE_VARIANT[type]} className="text-[10px]">
          {CAMPAIGN_TYPE_LABELS[type]}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          variant={CAMPAIGN_TRANSFER_VARIANT[transferKey]}
          className="text-[10px]"
        >
          {CAMPAIGN_TRANSFER_LABELS[transferKey]}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-mono text-xs">
        {formatTokens(record.account.totalDeposit)}
      </TableCell>
      <TableCell className="text-right">
        <DistributedCell record={record} />
      </TableCell>
      <TableCell className="text-right">
        <ScheduleCell record={record} />
      </TableCell>
    </TableRow>
  );
}

export default function CampaignDataTable({
  campaigns,
  selected,
  onSelect,
}: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-border-low">
      <Table>
        <TableHeader>
          <TableRow className="border-border-low bg-card/40 hover:bg-card/40">
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>NFT</TableHead>
            <TableHead className="text-right">Deposited</TableHead>
            <TableHead className="text-right">Paid out</TableHead>
            <TableHead className="text-right">Schedule</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((record) => (
            <CampaignDataRow
              key={String(record.address)}
              record={record}
              selected={selected === record.address}
              onSelect={() => onSelect(record.address)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
