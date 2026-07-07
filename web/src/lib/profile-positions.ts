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
  return [...positions].sort((a, b) => {
    if (a.transferredAway !== b.transferredAway) {
      return a.transferredAway ? 1 : -1;
    }
    return b.claimable - a.claimable;
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
