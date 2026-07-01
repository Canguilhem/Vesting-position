export const PROGRAM_ID = "4hAzFNAWaGZ5YpbRkSsfLNnQ3JXenkb3hAQ19nL7vTH3";

export const CLUSTER = "devnet" as const;

export const RPC_ENDPOINT =
  import.meta.env.VITE_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

export const EXPLORER_PROGRAM_URL = `https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`;
