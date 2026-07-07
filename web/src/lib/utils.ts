import { address, type Address } from "@solana/addresses";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncate(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function tryParseAddress(value: string): Address | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return address(trimmed);
  } catch {
    return null;
  }
}
