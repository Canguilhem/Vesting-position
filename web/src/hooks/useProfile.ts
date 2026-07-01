import { useCallback, useEffect, useState } from "react";
import { address, type Address } from "@solana/addresses";
import { useSolanaClient, useWalletConnection } from "@solana/react-hooks";
import { loadSavedTokens, type SavedToken } from "../lib/token-registry";
import { paginateSlice } from "../lib/pagination";
import { fetchWalletTokenBalance } from "../solana/token-balance";
import {
  fetchAllCampaigns,
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
  const { wallet, status } = useWalletConnection();

  const [data, setData] = useState<ProfileData | null>(null);
  const [allCampaigns, setAllCampaigns] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [campaignPage, setCampaignPage] = useState(0);
  const [mintPage, setMintPage] = useState(0);
  const [positionPage, setPositionPage] = useState(0);

  const [positionsState, setPositionsState] = useState<PositionsState>({
    items: [],
    campaignsScanned: 0,
    campaignsTotal: 0,
    done: false,
    loading: false,
  });

  const resetPositionScan = useCallback(() => {
    setPositionsState({
      items: [],
      campaignsScanned: 0,
      campaignsTotal: 0,
      done: false,
      loading: false,
    });
    setPositionPage(0);
  }, []);

  const scanMorePositions = useCallback(
    async (campaigns: CampaignRecord[], fromIndex: number) => {
      if (!wallet || status !== "connected") return;

      setPositionsState((prev) => ({ ...prev, loading: true }));

      try {
        const result = await scanCampaignsForPositions(
          client.runtime.rpc,
          wallet.account.address,
          campaigns,
          fromIndex,
          POSITION_CAMPAIGN_SCAN_BATCH,
        );

        setPositionsState((prev) => ({
          items: dedupePositions([...prev.items, ...result.positions]),
          campaignsScanned: result.campaignsScanned,
          campaignsTotal: result.campaignsTotal,
          done: result.done,
          loading: false,
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPositionsState((prev) => ({ ...prev, loading: false }));
      }
    },
    [client, wallet, status],
  );

  const refresh = useCallback(async () => {
    if (!wallet || status !== "connected") {
      setData(null);
      setAllCampaigns([]);
      setError(null);
      resetPositionScan();
      return;
    }

    setLoading(true);
    setError(null);
    resetPositionScan();
    setCampaignPage(0);
    setMintPage(0);

    try {
      const walletAddress = wallet.account.address;
      const rpc = client.runtime.rpc;

      const campaigns = await fetchAllCampaigns(rpc);
      setAllCampaigns(campaigns);

      const createdCampaigns = filterCampaignsByCreator(
        campaigns,
        walletAddress,
      );

      const mints = await buildProfileMints(
        rpc,
        walletAddress,
        loadSavedTokens(),
        createdCampaigns,
      );

      setData({
        wallet: walletAddress,
        createdCampaigns,
        mints,
        allCampaignsCount: campaigns.length,
      });

      void scanMorePositions(campaigns, 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [client, wallet, status, resetPositionScan, scanMorePositions]);

  const loadMorePositions = useCallback(() => {
    if (
      positionsState.loading ||
      positionsState.done ||
      allCampaigns.length === 0
    ) {
      return;
    }
    void scanMorePositions(allCampaigns, positionsState.campaignsScanned);
  }, [
    allCampaigns,
    positionsState.loading,
    positionsState.done,
    positionsState.campaignsScanned,
    scanMorePositions,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
    error,
    refresh,
    isConnected: status === "connected",
    walletAddress: wallet?.account.address,

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
