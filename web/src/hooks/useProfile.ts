import { useCallback, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { address, type Address } from "@solana/addresses";
import { useSolanaClient, useWalletConnection } from "@solana/react-hooks";
import { loadSavedTokens, type SavedToken } from "../lib/token-registry";
import { paginateSlice } from "../lib/pagination";
import { QUERY_STALE } from "../lib/query-client";
import { queryKeys } from "../lib/query-keys";
import { fetchWalletTokenBalance } from "../solana/token-balance";
import {
  fetchSortedCampaigns,
  type CampaignRecord,
} from "../solana/vesting-positions";
import {
  dedupePositions,
  filterCampaignsByCreator,
  POSITION_CAMPAIGN_SCAN_BATCH,
  PROFILE_LIST_PAGE_SIZE,
  scanCampaignsForPositions,
  type PositionRecord,
} from "../solana/profile-data";

type AppRpc = ReturnType<typeof useSolanaClient>["runtime"]["rpc"];

async function ensureCampaigns(
  queryClient: QueryClient,
  rpc: AppRpc,
  cached: CampaignRecord[] | undefined,
): Promise<CampaignRecord[]> {
  if (cached) return cached;
  return queryClient.fetchQuery({
    queryKey: queryKeys.campaigns(),
    queryFn: () => fetchSortedCampaigns(rpc),
  });
}

export type ProfileMint = {
  mint: Address;
  label?: string;
  decimals: number;
  supply: bigint;
  walletBalance: bigint;
  campaignsUsingMint: number;
  source: "local" | "on-chain";
};

export type ProfileData = {
  wallet: Address;
  createdCampaigns: CampaignRecord[];
  mints: ProfileMint[];
  allCampaignsCount: number;
};

export type PositionsState = {
  items: PositionRecord[];
  campaignsScanned: number;
  campaignsTotal: number;
  done: boolean;
  loading: boolean;
};

export function useProfile() {
  const client = useSolanaClient();
  const queryClient = useQueryClient();
  const { wallet, status } = useWalletConnection();
  const walletAddress = wallet?.account.address;
  const connected = status === "connected" && !!walletAddress;
  const walletKey = walletAddress ? String(walletAddress) : "";

  const [campaignPage, setCampaignPage] = useState(0);
  const [mintPage, setMintPage] = useState(0);
  const [positionPage, setPositionPage] = useState(0);

  const campaignsQuery = useQuery({
    queryKey: queryKeys.campaigns(),
    queryFn: () => fetchSortedCampaigns(client.runtime.rpc),
    enabled: connected,
    staleTime: QUERY_STALE.campaigns,
  });

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(walletKey),
    queryFn: async () => {
      const campaigns = await ensureCampaigns(
        queryClient,
        client.runtime.rpc,
        campaignsQuery.data,
      );

      const createdCampaigns = filterCampaignsByCreator(
        campaigns,
        walletAddress!,
      );

      const mints = await buildProfileMints(
        client.runtime.rpc,
        walletAddress!,
        loadSavedTokens(),
        createdCampaigns,
      );

      return {
        wallet: walletAddress!,
        createdCampaigns,
        mints,
        allCampaignsCount: campaigns.length,
      } satisfies ProfileData;
    },
    enabled: connected && campaignsQuery.isSuccess,
    staleTime: QUERY_STALE.profile,
  });

  const positionsQuery = useInfiniteQuery({
    queryKey: queryKeys.profilePositions(walletKey),
    queryFn: async ({ pageParam }) => {
      const campaigns = await ensureCampaigns(
        queryClient,
        client.runtime.rpc,
        campaignsQuery.data,
      );

      return scanCampaignsForPositions(
        client.runtime.rpc,
        walletAddress!,
        campaigns,
        pageParam,
        POSITION_CAMPAIGN_SCAN_BATCH,
      );
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.done ? undefined : lastPage.nextCampaignIndex,
    enabled: connected && campaignsQuery.isSuccess,
  });

  const positionsState = useMemo((): PositionsState => {
    const pages = positionsQuery.data?.pages ?? [];
    const lastPage = pages.at(-1);

    return {
      items: dedupePositions(pages.flatMap((page) => page.positions)),
      campaignsScanned: lastPage?.campaignsScanned ?? 0,
      campaignsTotal: lastPage?.campaignsTotal ?? campaignsQuery.data?.length ?? 0,
      done: lastPage?.done ?? false,
      loading: positionsQuery.isFetchingNextPage,
    };
  }, [positionsQuery, campaignsQuery.data?.length]);

  const refresh = useCallback(async () => {
    if (!connected) return;
    await campaignsQuery.refetch();
    await profileQuery.refetch();
    await queryClient.resetQueries({
      queryKey: queryKeys.profilePositions(walletKey),
    });
    await positionsQuery.refetch();
    setCampaignPage(0);
    setMintPage(0);
    setPositionPage(0);
  }, [
    connected,
    campaignsQuery,
    profileQuery,
    positionsQuery,
    queryClient,
    walletKey,
  ]);

  const loadMorePositions = useCallback(() => {
    if (
      positionsState.loading ||
      positionsState.done ||
      !positionsQuery.hasNextPage
    ) {
      return;
    }
    void positionsQuery.fetchNextPage();
  }, [positionsState.loading, positionsState.done, positionsQuery]);

  const data = profileQuery.data ?? null;
  const loading =
    campaignsQuery.isLoading ||
    profileQuery.isLoading ||
    (positionsQuery.isLoading && positionsState.items.length === 0);

  const error =
    campaignsQuery.error ?? profileQuery.error ?? positionsQuery.error;

  const campaignSlice = data
    ? paginateSlice(data.createdCampaigns, campaignPage, PROFILE_LIST_PAGE_SIZE)
    : null;

  const mintSlice = data
    ? paginateSlice(data.mints, mintPage, PROFILE_LIST_PAGE_SIZE)
    : null;

  const positionSlice = paginateSlice(
    positionsState.items,
    positionPage,
    PROFILE_LIST_PAGE_SIZE,
  );

  return {
    data,
    loading,
    error: error
      ? error instanceof Error
        ? error.message
        : String(error)
      : null,
    refresh,
    isConnected: connected,
    walletAddress,

    campaigns: campaignSlice,
    setCampaignPage,
    mints: mintSlice,
    setMintPage,

    positions: {
      ...positionSlice,
      scanProgress: positionsState,
      loadMore: loadMorePositions,
      setPage: setPositionPage,
    },
  };
}

async function buildProfileMints(
  rpc: Parameters<typeof fetchWalletTokenBalance>[0],
  wallet: Address,
  saved: SavedToken[],
  createdCampaigns: CampaignRecord[],
): Promise<ProfileMint[]> {
  const byMint = new Map<string, ProfileMint>();

  for (const token of saved) {
    byMint.set(token.mint, {
      mint: address(token.mint),
      label: token.label,
      decimals: token.decimals,
      supply: BigInt(token.supply),
      walletBalance: 0n,
      campaignsUsingMint: 0,
      source: "local",
    });
  }

  for (const campaign of createdCampaigns) {
    const mintStr = String(campaign.account.mintToDistribute);
    if (!byMint.has(mintStr)) {
      byMint.set(mintStr, {
        mint: campaign.account.mintToDistribute,
        decimals: 6,
        supply: 0n,
        walletBalance: 0n,
        campaignsUsingMint: 0,
        source: "on-chain",
      });
    }
  }

  for (const mint of byMint.values()) {
    mint.campaignsUsingMint = createdCampaigns.filter(
      (c) => String(c.account.mintToDistribute) === String(mint.mint),
    ).length;

    try {
      const { balance } = await fetchWalletTokenBalance(rpc, wallet, mint.mint);
      mint.walletBalance = balance;
    } catch {
      mint.walletBalance = 0n;
    }
  }

  return [...byMint.values()].sort((a, b) => {
    if (a.source !== b.source) return a.source === "local" ? -1 : 1;
    return String(b.mint).localeCompare(String(a.mint));
  });
}

export type { PositionRecord };
