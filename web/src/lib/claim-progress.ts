export type ClaimProgressTone = "complete" | "partial" | "none";

export function computePctClaimed(
  claimedSoFar: bigint,
  allocation: bigint
): number {
  if (allocation <= 0n) return 0;
  return Number((claimedSoFar * 10000n) / allocation) / 100;
}

export function formatPctClaimed(pct: number): string {
  if (pct >= 100) return "100";
  return pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1);
}

export function formatPctClaimedLabel(pct: number): string {
  return `${formatPctClaimed(pct)}% claimed`;
}

export function claimProgressTone(pct: number): ClaimProgressTone {
  if (pct >= 100) return "complete";
  if (pct > 0) return "partial";
  return "none";
}

export const CLAIM_PROGRESS_BAR_STYLES: Record<ClaimProgressTone, string> = {
  complete: "bg-emerald-400",
  partial: "bg-sky-400",
  none: "bg-zinc-500",
};

export const CLAIM_PROGRESS_BADGE_VARIANT = {
  complete: "claimed-full",
  partial: "claimed-partial",
  none: "claimed-empty",
} as const satisfies Record<ClaimProgressTone, string>;
