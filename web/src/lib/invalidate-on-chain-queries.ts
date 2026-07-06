import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";

/** Refresh RPC-backed data after a successful on-chain write. */
export function invalidateAfterOnChainWrite(
  queryClient: QueryClient,
  wallet?: string,
): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.campaigns() });
  void queryClient.invalidateQueries({ queryKey: ["campaignVault"] });

  if (!wallet) return;

  void queryClient.invalidateQueries({ queryKey: queryKeys.profile(wallet) });
  void queryClient.resetQueries({ queryKey: queryKeys.profilePositions(wallet) });
  void queryClient.invalidateQueries({
    queryKey: ["claimState"],
    predicate: (query) =>
      query.queryKey[0] === "claimState" && query.queryKey[2] === wallet,
  });
  void queryClient.invalidateQueries({
    queryKey: ["campaignPosition"],
    predicate: (query) =>
      query.queryKey[0] === "campaignPosition" && query.queryKey[2] === wallet,
  });
  void queryClient.invalidateQueries({
    queryKey: ["walletBalance", wallet],
  });
}
