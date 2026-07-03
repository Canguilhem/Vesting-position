import { Link } from "react-router-dom";
import { formatPercent, formatTokens } from "../../lib/vesting";
import {
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
  formatCampaignTimestamp,
} from "../../lib/campaign-status";
import { TruncatedExplorerLink } from "../Common/Common";
import { CampaignRecord, useCampaignStatus } from "../../hooks/useCampaigns";
import { useState } from "react";
import { CampaignAdminPanel } from "../Campaigns/CampaignAdminPanel";

export function CampaignAdminCard({ record }: { record: CampaignRecord }) {
  const status = useCampaignStatus(record.account);
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <article className="rounded-xl border border-border-low bg-background/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted">
            <TruncatedExplorerLink address={String(record.address)} />
          </p>
          <p className="mt-1 text-sm font-medium">
            {formatTokens(record.account.totalDeposit)} deposited
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${CAMPAIGN_STATUS_COLORS[status]}`}
        >
          {CAMPAIGN_STATUS_LABELS[status]}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs text-muted">
        <div>
          <dt>Mint</dt>
          <dd className="text-foreground">
            <TruncatedExplorerLink
              address={String(record.account.mintToDistribute)}
            />
          </dd>
        </div>
        <div>
          <dt>Cliff release</dt>
          <dd className="font-mono text-foreground">
            {formatPercent(record.account.cliffReleaseBps)}
          </dd>
        </div>
        <div className="col-span-2">
          <dt>Claim window</dt>
          <dd className="font-mono text-[10px] text-foreground/90">
            {formatCampaignTimestamp(record.account.start)} →{" "}
            {formatCampaignTimestamp(
              record.account.end + record.account.gracePeriod
            )}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setManageOpen((open) => !open)}
          className="rounded-md border border-border-low px-2.5 py-1 text-xs font-medium transition hover:border-accent/30 cursor-pointer"
        >
          {manageOpen ? "Hide admin" : "Manage campaign"}
        </button>
        <Link
          to="/app"
          className="rounded-md px-2.5 py-1 text-xs text-muted hover:text-foreground transition"
        >
          Claim in app →
        </Link>
      </div>

      {manageOpen && <CampaignAdminPanel record={record} embedded />}
    </article>
  );
}
