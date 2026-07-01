import type { CampaignData } from "../solana/vesting-positions";

export type CampaignStatus = "upcoming" | "active" | "grace" | "closed";

export function getCampaignStatus(
  campaign: CampaignData,
  nowSec = Math.floor(Date.now() / 1000),
): CampaignStatus {
  const { start, end, gracePeriod } = campaign;
  const graceEnd = end + gracePeriod;

  if (nowSec < start) return "upcoming";
  if (nowSec < end) return "active";
  if (nowSec < graceEnd) return "grace";
  return "closed";
}

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  upcoming: "Not started",
  active: "Claims open",
  grace: "Grace period",
  closed: "Claim window closed",
};

export const CAMPAIGN_STATUS_COLORS: Record<CampaignStatus, string> = {
  upcoming: "bg-zinc-500/20 text-zinc-300",
  active: "bg-emerald-500/20 text-emerald-300",
  grace: "bg-amber-500/20 text-amber-300",
  closed: "bg-red-500/20 text-red-300",
};
