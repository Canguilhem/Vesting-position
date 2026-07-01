import type { Address } from "@solana/addresses";

export const DAY_SEC = 86_400;

/** One campaign allocation in demo scale (10 × 1e12). */
export const DEFAULT_CAMPAIGN_DEPOSIT = 10_000_000_000_000n;

/** Default full mint supply for multi-campaign distribution (100 × 1e12). */
export const DEFAULT_TOKEN_SUPPLY = 100_000_000_000_000n;

/** @deprecated Use DEFAULT_CAMPAIGN_DEPOSIT */
export const DEFAULT_TOTAL_DEPOSIT = DEFAULT_CAMPAIGN_DEPOSIT;

export type CampaignFormValues = {
  mint: string;
  totalDeposit: string;
  merkleRootHex: string;
  start: string;
  end: string;
  cliffDays: number;
  cliffReleaseBps: number;
  graceDays: number;
  isTransferable: boolean;
  name: string;
  uri: string;
};

export type InitializeResult = {
  campaign: Address;
  collection: Address;
  mint: Address;
  totalDeposit: bigint;
  initializeSignature: string;
  initializeExplorerUrl: string;
};

export function defaultScheduleTimestamps(): { start: number; end: number } {
  const now = Math.floor(Date.now() / 1000);
  const start = now + DAY_SEC;
  return {
    start,
    end: start + 30 * DAY_SEC,
  };
}

export function toDatetimeLocal(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 16);
}

export function fromDatetimeLocal(value: string): number {
  return Math.floor(new Date(value).getTime() / 1000);
}

export function parseMerkleRootHex(hex: string): Uint8Array {
  const stripped = hex.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(stripped)) {
    throw new Error("Merkle root must be 32 bytes (64 hex characters)");
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) {
    bytes[i] = Number.parseInt(stripped.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function validateCampaignForm(
  values: CampaignFormValues,
  nowSec = Math.floor(Date.now() / 1000),
): string | null {
  const start = fromDatetimeLocal(values.start);
  const end = fromDatetimeLocal(values.end);
  const cliffDuration = values.cliffDays * DAY_SEC;
  const gracePeriod = values.graceDays * DAY_SEC;

  let totalDeposit: bigint;
  try {
    totalDeposit = BigInt(values.totalDeposit);
  } catch {
    return "Campaign deposit must be a whole number of raw token units";
  }

  if (!values.mint.trim()) return "Select or enter a token mint";
  if (totalDeposit <= 0n) return "Campaign deposit must be greater than zero";
  if (start <= nowSec) return "Start time must be in the future";
  if (end <= start) return "End time must be after start time";
  if (cliffDuration > end - start) {
    return "Cliff duration cannot exceed the vesting window";
  }
  if (values.cliffReleaseBps < 0 || values.cliffReleaseBps > 10_000) {
    return "Cliff release must be between 0 and 10,000 bps (100%)";
  }
  if (gracePeriod <= 0) return "Grace period must be at least one day";

  try {
    parseMerkleRootHex(values.merkleRootHex);
  } catch (err) {
    return err instanceof Error ? err.message : "Invalid merkle root";
  }

  if (!values.name.trim()) return "Collection name is required";
  if (!values.uri.trim()) return "Collection URI is required";

  return null;
}

export function campaignFormToParams(values: CampaignFormValues) {
  const start = fromDatetimeLocal(values.start);
  const end = fromDatetimeLocal(values.end);

  return {
    mint: values.mint.trim(),
    merkleRoot: parseMerkleRootHex(values.merkleRootHex),
    start,
    end,
    cliffDuration: BigInt(values.cliffDays * DAY_SEC),
    cliffReleaseBps: values.cliffReleaseBps,
    isTransferable: values.isTransferable,
    gracePeriod: BigInt(values.graceDays * DAY_SEC),
    totalDeposit: BigInt(values.totalDeposit),
    name: values.name.trim(),
    uri: values.uri.trim(),
  };
}

/** @deprecated Use CampaignFormValues */
export type InitializeFormValues = CampaignFormValues;

/** @deprecated Use validateCampaignForm */
export const validateInitializeForm = validateCampaignForm;

/** @deprecated Use campaignFormToParams */
export const formValuesToParams = campaignFormToParams;
