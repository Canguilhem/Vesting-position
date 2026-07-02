import { DEFAULT_TOKEN_SUPPLY_TOKENS } from "./initialize";
import { tokensToRaw } from "./vesting";

export type CreateTokenFormValues = {
  decimals: number;
  supply: string;
  label: string;
};

export function createDefaultCreateTokenFormValues(): CreateTokenFormValues {
  return {
    decimals: 6,
    supply: String(DEFAULT_TOKEN_SUPPLY_TOKENS),
    label: "Vesting token",
  };
}

export function parseCreateTokenSupply(values: CreateTokenFormValues): bigint {
  return tokensToRaw(BigInt(values.supply), values.decimals);
}

export function validateCreateTokenForm(values: CreateTokenFormValues): string | null {
  if (values.decimals < 0 || values.decimals > 9) {
    return "Decimals must be between 0 and 9";
  }
  try {
    const supply = parseCreateTokenSupply(values);
    if (supply <= 0n) return "Supply must be greater than zero";
  } catch {
    return "Supply must be a whole number of tokens";
  }
  return null;
}
