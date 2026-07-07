import { fetchCampaignsFromRegistry } from "./campaign-store";
import {
  fetchSortedCampaigns,
  type CampaignRecord,
} from "../solana/vesting-positions";
import type { SolanaClient } from "@solana/client";

type AppRpc = SolanaClient["runtime"]["rpc"];

export async function fetchCampaignsWithRegistry(
  rpc: AppRpc,
): Promise<CampaignRecord[]> {
  const [records, registry] = await Promise.all([
    fetchSortedCampaigns(rpc),
    fetchCampaignsFromRegistry().catch(() => []),
  ]);
  const namesByAddress = new Map(
    registry.map((row) => [
      row.campaignAddress.toLowerCase(),
      row.name,
    ]),
  );
  return records.map((record) => ({
    ...record,
    registryName:
      namesByAddress.get(String(record.address).toLowerCase()) ?? null,
  }));
}
