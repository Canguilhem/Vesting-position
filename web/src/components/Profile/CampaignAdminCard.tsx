import { Link } from "react-router-dom";
import { formatPercent, formatTokens } from "../../lib/vesting";
import {
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
  formatCampaignTimestamp,
} from "../../lib/campaign-status";
import {
  EntityCard,
  EntityCardContent,
  EntityCardFooter,
  EntityCardHeader,
  EntityCardMeta,
  TruncatedExplorerLink,
} from "../Common/Common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CampaignRecord, useCampaignStatus } from "../../hooks/useCampaigns";
import { appCampaignUrl } from "../../lib/app-routes";
import { useState } from "react";
import { CampaignAdminPanel } from "../Campaigns/CampaignAdminPanel";

export function CampaignAdminCard({ record }: { record: CampaignRecord }) {
  const status = useCampaignStatus(record.account);
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <EntityCard size="sm">
      <EntityCardHeader
        title={`${formatTokens(record.account.totalDeposit)} deposited`}
        description={
          <TruncatedExplorerLink
            address={String(record.address)}
            className="font-mono"
          />
        }
        action={
          <Badge className={`${CAMPAIGN_STATUS_COLORS[status]}`}>
            {CAMPAIGN_STATUS_LABELS[status]}
          </Badge>
        }
      />
      <EntityCardContent>
        <EntityCardMeta
          rows={[
            {
              label: "Mint",
              value: (
                <TruncatedExplorerLink
                  address={String(record.account.mintToDistribute)}
                />
              ),
            },
            {
              label: "Cliff release",
              value: (
                <span className="font-mono">
                  {formatPercent(record.account.cliffReleaseBps)}
                </span>
              ),
            },
            {
              label: "Claim window",
              value: (
                <span className="font-mono text-[10px]">
                  {formatCampaignTimestamp(record.account.start)} →{" "}
                  {formatCampaignTimestamp(
                    record.account.end + record.account.gracePeriod
                  )}
                </span>
              ),
              fullWidth: true,
            },
          ]}
        />
      </EntityCardContent>
      <EntityCardFooter className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => setManageOpen((open) => !open)}
        >
          {manageOpen ? "Hide admin" : "Manage campaign"}
        </Button>
        <Button asChild size="xs" variant="ghost">
          <Link to={appCampaignUrl(String(record.address))}>Open in app →</Link>
        </Button>
      </EntityCardFooter>

      {manageOpen && (
        <EntityCardContent className="border-t border-border-low pt-4">
          <CampaignAdminPanel record={record} />
        </EntityCardContent>
      )}
    </EntityCard>
  );
}
