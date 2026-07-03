import type { Address } from "@solana/addresses";
import { DEFAULT_DISPLAY_DECIMALS, formatTokens, tokensToRaw } from "./vesting";

export const DAY_SEC = 86_400;

/** Buffer so start is still in the future after wallet signing + confirmation. */
export const MIN_START_LEAD_SEC = 120;

/** 10M display tokens per campaign (matches program test TOTAL_DEPOSIT at 6 decimals). */
export const DEFAULT_CAMPAIGN_DEPOSIT_TOKENS = 10_000_000n;

/** 100M display tokens — full demo supply (10 campaigns). */
export const DEFAULT_TOKEN_SUPPLY_TOKENS = 100_000_000n;

export const DEFAULT_CAMPAIGN_DEPOSIT = tokensToRaw(
  DEFAULT_CAMPAIGN_DEPOSIT_TOKENS,
  DEFAULT_DISPLAY_DECIMALS
);
export const DEFAULT_TOKEN_SUPPLY = tokensToRaw(
  DEFAULT_TOKEN_SUPPLY_TOKENS,
  DEFAULT_DISPLAY_DECIMALS
);

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

export function createDefaultCampaignFormValues(
  prefilledMint?: string | null,
  merkleRootHex?: string,
): CampaignFormValues {
  const schedule = defaultScheduleTimestamps();
  return {
    mint: prefilledMint ?? "",
    totalDeposit: String(DEFAULT_CAMPAIGN_DEPOSIT_TOKENS),
    merkleRootHex: merkleRootHex ?? "",
    start: toDatetimeLocal(schedule.start),
    end: toDatetimeLocal(schedule.end),
    cliffDays: 1,
    cliffReleaseBps: 1000,
    graceDays: 7,
    isTransferable: true,
    name: "Vesting campaign",
    uri: "https://example.com/collection.json",
  };
}

export type InitializeResult = {
  campaign: Address;
  collection: Address;
  mint: Address;
  totalDeposit: bigint;
  initializeSignature: string;
  initializeExplorerUrl: string;
  registrySaved: boolean;
  registryPersistError?: string;
  allowlistSaved: boolean;
  allowlistPersistError?: string;
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
  const d = new Date(unixSec * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function applyDefaultSchedule(
  values: CampaignFormValues
): CampaignFormValues {
  const schedule = defaultScheduleTimestamps();
  return {
    ...values,
    start: toDatetimeLocal(schedule.start),
    end: toDatetimeLocal(schedule.end),
  };
}

export function isStartTooSoon(
  values: CampaignFormValues,
  nowSec = Math.floor(Date.now() / 1000)
): boolean {
  try {
    const start = fromDatetimeLocal(values.start);
    return start <= nowSec + MIN_START_LEAD_SEC;
  } catch {
    return true;
  }
}

// export function describeScheduleUnix(values: CampaignFormValues): string | null {
//   try {
//     const start = fromDatetimeLocal(values.start);
//     const end = fromDatetimeLocal(values.end);
//     return `start unix ${start}, end unix ${end}`;
//   } catch {
//     return null;
//   }
// }

export function fromDatetimeLocal(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value.trim()
  );
  if (!match) {
    throw new Error(`Invalid datetime-local value: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? 0);
  const ms = new Date(year, month - 1, day, hour, minute, second, 0).getTime();

  if (Number.isNaN(ms)) {
    throw new Error(`Invalid datetime-local value: ${value}`);
  }

  return Math.floor(ms / 1000);
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

export function formatScheduleLocal(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString();
}

export type CampaignFormValidation = {
  blocking: string[];
  warnings: string[];
};

export function collectCampaignFormErrors(
  values: CampaignFormValues,
  options?: {
    nowSec?: number;
    walletBalance?: bigint | null;
  }
): CampaignFormValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const nowSec = options?.nowSec ?? Math.floor(Date.now() / 1000);
  let start = 0;
  let end = 0;
  let cliffDuration = 0;
  let gracePeriod = 0;

  try {
    start = fromDatetimeLocal(values.start);
    end = fromDatetimeLocal(values.end);
    cliffDuration = values.cliffDays * DAY_SEC;
    gracePeriod = values.graceDays * DAY_SEC;
  } catch {
    blocking.push("Invalid start or end date");
    return { blocking, warnings };
  }

  let totalDepositRaw: bigint;
  try {
    const depositTokens = BigInt(values.totalDeposit);
    totalDepositRaw = tokensToRaw(depositTokens, DEFAULT_DISPLAY_DECIMALS);
  } catch {
    blocking.push("Campaign deposit must be a whole number of tokens");
    return { blocking, warnings };
  }

  if (!values.mint.trim()) blocking.push("Select or enter a token mint");
  if (totalDepositRaw <= 0n) {
    blocking.push("Campaign deposit must be greater than zero");
  }
  if (
    options?.walletBalance != null &&
    totalDepositRaw > options.walletBalance
  ) {
    blocking.push(
      `Campaign deposit exceeds wallet balance (${formatTokens(options.walletBalance)} tokens available)`
    );
  }
  if (start <= nowSec + MIN_START_LEAD_SEC) {
    warnings.push(
      `Start must be at least ${MIN_START_LEAD_SEC / 60} minutes after chain time (currently ${formatScheduleLocal(start)}; chain now ${formatScheduleLocal(nowSec)}). Use “Reset schedule”.`
    );
  }
  if (end <= start) {
    blocking.push(
      `End time must be after start time (start: ${formatScheduleLocal(start)}, end: ${formatScheduleLocal(end)})`
    );
  }
  if (cliffDuration > end - start) {
    blocking.push("Cliff duration cannot exceed the vesting window");
  }
  if (values.cliffReleaseBps < 0 || values.cliffReleaseBps > 10_000) {
    blocking.push("Cliff release must be between 0 and 10,000 bps (100%)");
  }
  if (gracePeriod <= 0) blocking.push("Grace period must be at least one day");

  try {
    parseMerkleRootHex(values.merkleRootHex);
  } catch (err) {
    blocking.push(err instanceof Error ? err.message : "Invalid merkle root");
  }

  if (!values.name.trim()) blocking.push("Collection name is required");
  if (!values.uri.trim()) blocking.push("Collection URI is required");

  return { blocking, warnings };
}

export function getCampaignFormWarnings(
  values: CampaignFormValues,
  options?: {
    nowSec?: number;
    walletBalance?: bigint | null;
  },
): string[] {
  return collectCampaignFormErrors(values, options).warnings;
}

export function getCampaignFormBlockingError(
  values: CampaignFormValues,
  options?: {
    nowSec?: number;
    walletBalance?: bigint | null;
  },
): string | undefined {
  const { blocking } = collectCampaignFormErrors(values, options);
  return blocking[0];
}

export function validateCampaignForm(
  values: CampaignFormValues,
  options?: {
    nowSec?: number;
    walletBalance?: bigint | null;
  }
): string | null {
  const { blocking, warnings } = collectCampaignFormErrors(values, options);
  return blocking[0] ?? warnings[0] ?? null;
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
    totalDeposit: tokensToRaw(
      BigInt(values.totalDeposit),
      DEFAULT_DISPLAY_DECIMALS
    ),
    name: values.name.trim(),
    uri: values.uri.trim(),
  };
}
