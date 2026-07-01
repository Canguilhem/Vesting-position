import type { Address } from "@solana/addresses";

const STORAGE_KEY = "vesting-positions-created-tokens";

export type SavedToken = {
  mint: string;
  decimals: number;
  supply: string;
  signature: string;
  label?: string;
  createdAt: number;
};

export function loadSavedTokens(): SavedToken[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedToken[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveToken(token: SavedToken): void {
  const existing = loadSavedTokens().filter((t) => t.mint !== token.mint);
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([token, ...existing].slice(0, 20)),
  );
}

export function removeSavedToken(mint: Address | string): void {
  const next = loadSavedTokens().filter((t) => t.mint !== String(mint));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
