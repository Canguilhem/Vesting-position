import { useCallback, useEffect, useState } from "react";
import type { Address } from "@solana/addresses";
import { useSolanaClient } from "@solana/react-hooks";
import {
  fetchAllCampaigns,
  getUserClaimState,
  type CampaignRecord,
} from "../solana/vesting-positions";
import {
  getCampaignStatus,
  type CampaignStatus,
} from "../lib/campaign-status";

export type { CampaignStatus };
export { getCampaignStatus };

export function useCampaigns() {
  const client = useSolanaClient();
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await fetchAllCampaigns(client.runtime.rpc);
      records.sort((a, b) => b.account.start - a.account.start);
      setCampaigns(records);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { campaigns, loading, error, refresh };
}

export function useUserClaimState(
  campaignAddress: Address | null,
  userAddress: Address | undefined,
) {
  const client = useSolanaClient();
  const [hasReceipt, setHasReceipt] = useState(false);
  const [hasAsset, setHasAsset] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!campaignAddress || !userAddress) {
      setHasReceipt(false);
      setHasAsset(false);
      return;
    }

    setLoading(true);
    try {
      const state = await getUserClaimState(
        client.runtime.rpc,
        campaignAddress,
        userAddress,
      );
      setHasReceipt(state.hasReceipt);
      setHasAsset(state.hasAsset);
    } finally {
      setLoading(false);
    }
  }, [client, campaignAddress, userAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isFirstClaim = !hasReceipt && !hasAsset;

  return { hasReceipt, hasAsset, isFirstClaim, loading, refresh };
}

export type { CampaignRecord };
