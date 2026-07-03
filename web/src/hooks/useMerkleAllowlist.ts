import { useQuery } from "@tanstack/react-query";
import {
  getMerkleProofForCampaign,
  merkleRootMatchesCampaign,
} from "../lib/merkle";
import { QUERY_STALE } from "../lib/query-client";
import { queryKeys } from "../lib/query-keys";

export function useMerkleAllowlist(
  campaignAddress: string,
  walletAddress: string | undefined,
  campaignMerkleRoot: Uint8Array,
) {
  const query = useQuery({
    queryKey:
      walletAddress && campaignAddress
        ? queryKeys.merkleProof(campaignAddress, walletAddress)
        : ["merkleProof", "disabled"],
    queryFn: () =>
      getMerkleProofForCampaign(
        campaignAddress,
        walletAddress!,
        campaignMerkleRoot,
      ),
    enabled: Boolean(walletAddress && campaignAddress),
    staleTime: QUERY_STALE.merkle,
  });

  if (!walletAddress) {
    return { allowlist: null as null, loading: false };
  }

  if (query.isLoading) {
    return { allowlist: null as null, loading: true };
  }

  const proof = query.data;
  if (!proof) {
    return {
      allowlist: { allocation: 0n, onList: false },
      loading: false,
    };
  }

  return {
    allowlist: {
      allocation: proof.allocation,
      onList: merkleRootMatchesCampaign(campaignMerkleRoot, proof.merkleRoot),
    },
    loading: false,
  };
}
