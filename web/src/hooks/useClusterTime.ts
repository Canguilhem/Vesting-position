import { useQuery } from "@tanstack/react-query";
import { useSolanaClient } from "@solana/react-hooks";
import { fetchClusterUnixTime } from "../solana/cluster-time";
import { QUERY_STALE } from "../lib/query-client";

export function useClusterTime() {
  const client = useSolanaClient();

  const query = useQuery({
    queryKey: ["clusterTime"],
    queryFn: () => fetchClusterUnixTime(client.runtime.rpc),
    staleTime: QUERY_STALE.walletBalance,
    refetchInterval: 30_000,
  });

  return {
    clusterNowSec: query.data ?? null,
    loading: query.isLoading,
  };
}
