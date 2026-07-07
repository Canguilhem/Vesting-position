import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_VARIANT,
  formatCampaignDateRange,
} from "../../lib/campaign-status";
import { getCampaignDisplayName } from "../../lib/campaign-display";
import { appCampaignUrl } from "../../lib/app-routes";
import { formatTokens, formatPercent } from "../../lib/vesting";
import type { CampaignRecord } from "../../hooks/useCampaigns";
import { useCampaignStatus } from "../../hooks/useCampaigns";
import { CampaignAdminPanel } from "../Campaigns/CampaignAdminPanel";

type Props = {
  campaigns: CampaignRecord[];
};

function CampaignAdminRow({ record }: { record: CampaignRecord }) {
  const [manageOpen, setManageOpen] = useState(false);
  const status = useCampaignStatus(record.account);

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="min-w-0 max-w-[14rem]">
            <Link
              to={appCampaignUrl(String(record.address))}
              className="block truncate text-xs font-medium text-foreground hover:text-primary"
              title={getCampaignDisplayName(record)}
            >
              {getCampaignDisplayName(record)}
            </Link>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant={CAMPAIGN_STATUS_VARIANT[status]} className="text-[10px]">
            {CAMPAIGN_STATUS_LABELS[status]}
          </Badge>
        </TableCell>
        <TableCell className="text-right font-mono text-xs">
          {formatTokens(record.account.totalDeposit)}
        </TableCell>
        <TableCell className="text-right font-mono text-xs text-muted-foreground">
          {formatPercent(record.account.cliffReleaseBps)}
        </TableCell>
        <TableCell className="text-right font-mono text-xs text-muted-foreground">
          {formatCampaignDateRange(record.account)}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setManageOpen(true)}
            >
              Manage
            </Button>
            <Button asChild variant="ghost" size="xs">
              <Link to={appCampaignUrl(String(record.address))}>Open</Link>
            </Button>
          </div>
        </TableCell>
      </TableRow>
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{getCampaignDisplayName(record)}</DialogTitle>
          </DialogHeader>
          <CampaignAdminPanel record={record} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CampaignAdminDataTable({ campaigns }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-border-low">
      <Table>
        <TableHeader>
          <TableRow className="border-border-low bg-card/40 hover:bg-card/40">
            <TableHead>Campaign</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Deposited</TableHead>
            <TableHead className="text-right">Cliff %</TableHead>
            <TableHead className="text-right">Claim window</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((record) => (
            <CampaignAdminRow key={String(record.address)} record={record} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
