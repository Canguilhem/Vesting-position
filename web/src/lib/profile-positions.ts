import type { PositionRecord } from "../solana/profile-data";

export function canClaimPosition(position: PositionRecord): boolean {
  if (position.transferredAway) return false;
  if (position.attributes.claimedSoFar >= position.attributes.allocation) {
    return false;
  }
  if (position.claimable <= 0) return false;
  if (
    position.campaignStatus === "closed" ||
    position.campaignStatus === "upcoming"
  ) {
    return false;
  }
  return true;
}

export function sortPositionsForProfile(
  positions: PositionRecord[],
): PositionRecord[] {
  function urgency(position: PositionRecord): number {
    // Lower = show earlier.
    if (position.transferredAway) return 10;

    // Claim is possible "right now".
    if (canClaimPosition(position)) return 0;

    // Vesting window is open, but claimable is currently 0 (e.g. before cliff).
    if (position.campaignStatus === "active" || position.campaignStatus === "grace") {
      return 1;
    }

    // Window hasn't opened yet.
    if (position.campaignStatus === "upcoming") return 2;

    // Closed (should typically have claimable = 0).
    return 3;
  }

  return [...positions].sort((a, b) => {
    // Keep "past" positions (transferred away) at the bottom of the table.
    if (a.transferredAway !== b.transferredAway) {
      return a.transferredAway ? 1 : -1;
    }

    const uA = urgency(a);
    const uB = urgency(b);
    if (uA !== uB) return uA - uB;

    // Higher claimable first within the same urgency tier.
    const claimableDiff = b.claimable - a.claimable;
    if (claimableDiff !== 0) return claimableDiff;

    // Secondary tie-breaker: show items that close sooner first.
    // (For active/grace positions this tends to match "most relevant now".)
    const windowEndA = a.campaign.account.end + a.campaign.account.gracePeriod;
    const windowEndB = b.campaign.account.end + b.campaign.account.gracePeriod;
    if (windowEndA !== windowEndB) return windowEndA - windowEndB;

    // Final tie-breaker: deterministic by campaign start.
    return a.campaign.account.start - b.campaign.account.start;
  });
}

export function splitProfilePositions(positions: PositionRecord[]): {
  held: PositionRecord[];
  past: PositionRecord[];
} {
  const held: PositionRecord[] = [];
  const past: PositionRecord[] = [];
  for (const position of positions) {
    if (position.transferredAway) past.push(position);
    else held.push(position);
  }
  return { held, past };
}
