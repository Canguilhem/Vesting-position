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

/** Default SPL decimals for demo tokens and campaign forms. */
export const DEFAULT_DISPLAY_DECIMALS = 6;

export function formatTokens(
  raw: number | bigint,
  decimals = DEFAULT_DISPLAY_DECIMALS,
): string {
  const value =
    typeof raw === "bigint" ? Number(raw) / 10 ** decimals : raw / 10 ** decimals;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatPercent(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

/** SPL base units → display tokens (integer part when converting form input). */
export function tokensToRaw(
  tokens: bigint,
  decimals = DEFAULT_DISPLAY_DECIMALS,
): bigint {
  return tokens * 10n ** BigInt(decimals);
}

export function rawToTokens(
  raw: bigint,
  decimals = DEFAULT_DISPLAY_DECIMALS,
): bigint {
  return raw / 10n ** BigInt(decimals);
}

export function formatTokenCount(tokens: number | bigint): string {
  const value = typeof tokens === "bigint" ? tokens : BigInt(tokens);
  return value.toLocaleString();
}
