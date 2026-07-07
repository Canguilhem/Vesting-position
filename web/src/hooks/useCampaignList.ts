import { useQuery } from "@tanstack/react-query";
import { useSolanaClient } from "@solana/react-hooks";
import { fetchCampaignsWithRegistry } from "../lib/fetch-campaigns";
import { QUERY_STALE } from "../lib/query-client";
import { queryKeys } from "../lib/query-keys";
import type { CampaignRecord } from "../solana/vesting-positions";

type Options = {
  enabled?: boolean;
};

/** Shared campaign list (on-chain + Supabase registry names). One cache entry app-wide. */
export function useCampaignList(options?: Options) {
  const client = useSolanaClient();

  return useQuery({
    queryKey: queryKeys.campaigns(),
    queryFn: () => fetchCampaignsWithRegistry(client.runtime.rpc),
    enabled: options?.enabled ?? true,
    staleTime: QUERY_STALE.campaigns,
  });
}

export type { CampaignRecord };
