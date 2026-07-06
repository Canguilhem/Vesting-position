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

export const CAMPAIGN_STATUS_COLORS: Record<CampaignStatus, string> = {
  upcoming: "bg-zinc-500/20 text-zinc-300",
  active: "bg-emerald-500/20 text-emerald-300",
  grace: "bg-amber-500/20 text-amber-300",
  closed: "bg-red-500/20 text-red-300",
};

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

/** 100% cliff release = full allocation at cliff (airdrop-style); otherwise linear vesting. */
export type CampaignDistributionType = "airdrop" | "vesting";

const FULL_CLIFF_RELEASE_BPS = 10_000;

export function getCampaignDistributionType(
  cliffReleaseBps: number,
): CampaignDistributionType {
  return cliffReleaseBps >= FULL_CLIFF_RELEASE_BPS ? "airdrop" : "vesting";
}

export const CAMPAIGN_TYPE_PILL: Record<
  CampaignDistributionType,
  { label: string; className: string }
> = {
  airdrop: {
    label: "Airdrop",
    className: "bg-violet-500/20 text-violet-300",
  },
  vesting: {
    label: "Vesting",
    className: "bg-indigo-500/20 text-indigo-300",
  },
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

/** Human-readable duration from on-chain seconds (avoids raw `sec / 86400` floats). */
export function formatDurationSec(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s >= 86_400) {
    const days = s / 86_400;
    return Number.isInteger(days) ? `${days} days` : `${days.toFixed(1)} days`;
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
