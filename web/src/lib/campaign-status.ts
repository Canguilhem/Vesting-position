import type { CampaignData } from "../solana/vesting-positions";

export type CampaignStatus = "upcoming" | "active" | "grace" | "closed";

export function getCampaignStatus(
  campaign: CampaignData,
  nowSec = Math.floor(Date.now() / 1000)
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

/** Badge `variant` for each campaign phase — matches `Badge` in ui/badge. */
export const CAMPAIGN_STATUS_VARIANT = {
  upcoming: "upcoming",
  active: "active",
  grace: "grace",
  closed: "closed",
} as const satisfies Record<CampaignStatus, string>;

export const TRANSFERABLE_PILL = {
  true: {
    label: "Transferable",
    className: "bg-sky-500/20 text-sky-300",
  },
  false: {
    label: "Frozen",
    className: "bg-zinc-500/20 text-zinc-400",
  },
} as const;

/** Badge `variant` for position NFT transferability. */
export const CAMPAIGN_TRANSFER_VARIANT = {
  true: "transferable",
  false: "non-transferable",
} as const;

export const CAMPAIGN_TRANSFER_LABELS = {
  true: "Transferable",
  false: "Non-transferable",
} as const;

/** 100% cliff release = full allocation at cliff (airdrop-style); otherwise linear vesting. */
export type CampaignDistributionType = "airdrop" | "vesting";

const FULL_CLIFF_RELEASE_BPS = 10_000;

export function getCampaignDistributionType(
  cliffReleaseBps: number,
): CampaignDistributionType {
  return cliffReleaseBps >= FULL_CLIFF_RELEASE_BPS ? "airdrop" : "vesting";
}

/** Badge `variant` for distribution type — matches `Badge` in ui/badge. */
export const CAMPAIGN_TYPE_VARIANT = {
  airdrop: "airdrop",
  vesting: "vesting",
} as const satisfies Record<CampaignDistributionType, string>;

export const CAMPAIGN_TYPE_LABELS: Record<CampaignDistributionType, string> = {
  airdrop: "Airdrop",
  vesting: "Vesting",
};

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function formatCampaignTimestamp(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatCampaignDateShort(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

export function formatCampaignDateRange(campaign: CampaignData): string {
  const start = formatCampaignDateShort(campaign.start);
  const end = formatCampaignDateShort(campaign.end + campaign.gracePeriod);
  return `${start} – ${end}`;
}

/** Elapsed % through [start, end + grace]. */
export function campaignWindowElapsedPercent(
  campaign: CampaignData,
  nowSec = Math.floor(Date.now() / 1000),
): number {
  const windowEnd = campaign.end + campaign.gracePeriod;
  const total = windowEnd - campaign.start;
  if (total <= 0) return 100;
  if (nowSec <= campaign.start) return 0;
  if (nowSec >= windowEnd) return 100;
  return ((nowSec - campaign.start) / total) * 100;
}

export function formatCampaignWindowShort(
  campaign: CampaignData,
  nowSec = Math.floor(Date.now() / 1000),
): string {
  const pct = campaignWindowElapsedPercent(campaign, nowSec);
  const start = formatCampaignDateShort(campaign.start);
  const end = formatCampaignDateShort(campaign.end + campaign.gracePeriod);
  return `${pct.toFixed(0)}% · ${start} – ${end}`;
}

/** Human-readable duration from on-chain seconds (avoids raw `sec / 86400` floats). */
export function formatDurationSec(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s >= 86_400) {
    const days = s / 86_400;
    if (Number.isInteger(days)) {
      return days === 1 ? "1 day" : `${days} days`;
    }
    return `${days.toFixed(1)} days`;
  }
  if (s >= 3_600) {
    const hours = s / 3_600;
    return Number.isInteger(hours) ? `${hours} hours` : `${hours.toFixed(1)} hours`;
  }
  if (s >= 60) {
    const minutes = Math.round(s / 60);
    return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  }
  return s === 1 ? "1 second" : `${s} seconds`;
}

export function formatCliffDuration(cliffDurationSec: number): string {
  if (cliffDurationSec <= 0) return "No cliff";
  return formatDurationSec(cliffDurationSec);
}
