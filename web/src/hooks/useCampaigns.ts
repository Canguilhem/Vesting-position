import { useQuery } from "@tanstack/react-query";
import type { Address } from "@solana/addresses";
import { useSolanaClient } from "@solana/react-hooks";
import {
  fetchSortedCampaigns,
  getUserClaimState,
  type CampaignRecord,
} from "../solana/vesting-positions";
import { fetchCampaignDistributionStats } from "../solana/campaign-vault";
import { fetchUserCampaignPosition } from "../solana/profile-data";
import {
  getCampaignStatus,
  type CampaignStatus,
} from "../lib/campaign-status";
import { QUERY_STALE } from "../lib/query-client";
import { queryKeys } from "../lib/query-keys";
import { useClusterTime } from "./useClusterTime";
import type { CampaignData } from "../solana/vesting-positions";

export type { CampaignStatus };
export { getCampaignStatus };

/** Campaign phase using devnet cluster clock (falls back to local time while loading). */
export function useCampaignStatus(campaign: CampaignData): CampaignStatus {
  const { clusterNowSec } = useClusterTime();
  const nowSec = clusterNowSec ?? Math.floor(Date.now() / 1000);
  return getCampaignStatus(campaign, nowSec);
}

export function useCampaigns() {
  const client = useSolanaClient();

  const query = useQuery({
    queryKey: queryKeys.campaigns(),
    queryFn: () => fetchSortedCampaigns(client.runtime.rpc),
    staleTime: QUERY_STALE.campaigns,
  });

  return {
    campaigns: query.data ?? [],
    loading: query.isLoading,
    error: query.error
      ? query.error instanceof Error
        ? query.error.message
        : String(query.error)
      : null,
    refresh: query.refetch,
  };
}

export function useUserClaimState(
  campaignAddress: Address | null,
  userAddress: Address | undefined,
) {
  const client = useSolanaClient();
  const campaign = campaignAddress ? String(campaignAddress) : null;
  const user = userAddress ? String(userAddress) : null;

  const query = useQuery({
    queryKey:
      campaign && user
        ? queryKeys.claimState(campaign, user)
        : ["claimState", "disabled"],
    queryFn: () =>
      getUserClaimState(client.runtime.rpc, campaignAddress!, userAddress!),
    enabled: Boolean(campaign && user),
    staleTime: QUERY_STALE.claimState,
  });

  const hasReceipt = query.data?.hasReceipt ?? false;
  const hasAsset = query.data?.hasAsset ?? false;

  return {
    hasReceipt,
    hasAsset,
    isFirstClaim: !hasReceipt && !hasAsset,
    loading: query.isLoading || query.isFetching,
    refresh: query.refetch,
  };
}

export function useCampaignPosition(
  record: CampaignRecord | null,
  userAddress: Address | undefined,
) {
  const client = useSolanaClient();
  const campaign = record ? String(record.address) : null;
  const user = userAddress ? String(userAddress) : null;

  const query = useQuery({
    queryKey:
      campaign && user
        ? queryKeys.campaignPosition(campaign, user)
        : ["campaignPosition", "disabled"],
    queryFn: () =>
      fetchUserCampaignPosition(
        client.runtime.rpc,
        userAddress!,
        record!,
      ),
    enabled: Boolean(record && userAddress),
    staleTime: QUERY_STALE.claimState,
  });

  return {
    position: query.data ?? null,
    loading: query.isLoading || query.isFetching,
    refresh: query.refetch,
  };
}

export function useCampaignDistribution(record: CampaignRecord) {
  const client = useSolanaClient();
  const campaign = String(record.address);

  const query = useQuery({
    queryKey: queryKeys.campaignVault(campaign),
    queryFn: () =>
      fetchCampaignDistributionStats(client.runtime.rpc, record),
    staleTime: QUERY_STALE.campaignVault,
  });

  return {
    stats: query.data ?? null,
    loading: query.isLoading || query.isFetching,
    refresh: query.refetch,
  };
}

export type { CampaignRecord };
