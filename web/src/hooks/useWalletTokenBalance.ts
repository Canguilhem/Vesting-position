import { useQuery } from "@tanstack/react-query";
import { address, type Address } from "@solana/addresses";
import { useSolanaClient, useWalletConnection } from "@solana/react-hooks";
import { fetchWalletTokenBalance } from "../solana/token-balance";
import { QUERY_STALE } from "../lib/query-client";
import { queryKeys } from "../lib/query-keys";

export function useWalletTokenBalance(mint: Address | string | null | undefined) {
  const client = useSolanaClient();
  const { wallet, status } = useWalletConnection();

  const walletAddress = wallet?.account.address;
  const mintAddress = mint ? String(mint).trim() : "";
  const enabled =
    status === "connected" && !!walletAddress && mintAddress.length > 0;

  const query = useQuery({
    queryKey:
      enabled && walletAddress
        ? queryKeys.walletBalance(String(walletAddress), mintAddress)
        : ["walletBalance", "disabled"],
    queryFn: () =>
      fetchWalletTokenBalance(
        client.runtime.rpc,
        walletAddress!,
        address(mintAddress),
      ),
    enabled,
    staleTime: QUERY_STALE.walletBalance,
    select: (result) => result.balance,
  });

  return {
    balance: query.data ?? null,
    loading: query.isLoading || query.isFetching,
    error: query.error,
    refresh: query.refetch,
  };
}
