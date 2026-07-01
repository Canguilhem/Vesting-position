import { QueryClient } from "@tanstack/react-query";

/** Default stale times for Solana RPC reads (ms). */
export const QUERY_STALE = {
  /** Campaign list — new campaigns appear occasionally on devnet. */
  campaigns: 30_000,
  /** Claim receipt / asset existence per wallet+campaign. */
  claimState: 15_000,
  /** ATA balance for a mint. */
  walletBalance: 20_000,
  /** Static bundled allowlist JSON. */
  merkle: Number.POSITIVE_INFINITY,
  /** Profile aggregates derived from campaigns + balances. */
  profile: 30_000,
} as const;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: true,
        staleTime: QUERY_STALE.campaigns,
      },
    },
  });
}
