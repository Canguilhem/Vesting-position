export type VestingParams = {
  allocation: number;
  claimedSoFar: number;
  start: number;
  end: number;
  cliffDurationSec: number;
  cliffReleaseBps: number;
  now: number;
};

export type VestingResult = {
  claimable: number;
  totalVested: number;
  cliffEnd: number;
  beforeCliff: boolean;
  fullyVested: boolean;
};

export function computeVesting({
  allocation,
  claimedSoFar,
  start,
  end,
  cliffDurationSec,
  cliffReleaseBps,
  now,
}: VestingParams): VestingResult {
  const cliffEnd = start + cliffDurationSec;

  if (now < cliffEnd) {
    return {
      claimable: 0,
      totalVested: 0,
      cliffEnd,
      beforeCliff: true,
      fullyVested: false,
    };
  }

  const effectiveNow = Math.min(now, end);
  const cliffAmount = Math.floor((allocation * cliffReleaseBps) / 10_000);
  const linearPool = allocation - cliffAmount;
  const linearDuration = end - cliffEnd;

  let linearVested = 0;
  if (linearDuration > 0) {
    linearVested = Math.floor(
      (linearPool * (effectiveNow - cliffEnd)) / linearDuration,
    );
  }

  const totalVested = Math.min(cliffAmount + linearVested, allocation);
  const claimable = Math.max(0, totalVested - claimedSoFar);

  return {
    claimable,
    totalVested,
    cliffEnd,
    beforeCliff: false,
    fullyVested: totalVested >= allocation,
  };
}

export function formatTokens(raw: number, decimals = 6): string {
  const value = raw / 10 ** decimals;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatPercent(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}
