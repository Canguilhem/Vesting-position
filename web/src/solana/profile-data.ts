import type { Address } from "@solana/addresses";
import type { SolanaClient } from "@solana/client";
import { findClaimReceiptPda } from "../generated/vesting-positions/src/generated/pdas/claimReceipt";
import { accountExists, type CampaignRecord } from "./vesting-positions";
import { findAssetPda } from "./pdas";
import {
  parseAssetCollection,
  parseAssetOwner,
  parsePositionAttributes,
  type ParsedPositionAttributes,
} from "../lib/mpl-core-asset";
import { computeVesting } from "../lib/vesting";
import { getCampaignStatus } from "../lib/campaign-status";
import { mapInBatches } from "../lib/pagination";

type AppRpc = SolanaClient["runtime"]["rpc"];

/** Campaigns checked per RPC batch when scanning for positions. */
export const POSITION_CAMPAIGN_SCAN_BATCH = 15;

/** UI page size for profile lists. */
export const PROFILE_LIST_PAGE_SIZE = 5;

export type PositionRecord = {
  asset: Address;
  campaign: CampaignRecord;
  owner: Address;
  collection: Address;
  attributes: ParsedPositionAttributes;
  claimable: number;
  totalVested: number;
  fullyVested: boolean;
  isOriginalRecipient: boolean;
  campaignStatus: ReturnType<typeof getCampaignStatus>;
  /** True when you minted but no longer hold the NFT. */
  transferredAway: boolean;
};

export type PositionScanResult = {
  positions: PositionRecord[];
  nextCampaignIndex: number;
  campaignsScanned: number;
  campaignsTotal: number;
  done: boolean;
};

function decodeBase64AccountData(data: string | [string, string]): Uint8Array {
  const base64 = Array.isArray(data) ? data[0] : data;
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

function buildPositionRecord(
  asset: Address,
  data: Uint8Array,
  campaign: CampaignRecord,
  wallet: Address,
): PositionRecord | null {
  const attributes = parsePositionAttributes(data);
  if (!attributes) return null;

  const owner = parseAssetOwner(data);
  const collection = parseAssetCollection(data);
  if (!owner || !collection) return null;

  const now = Math.floor(Date.now() / 1000);
  const vesting = computeVesting({
    allocation: Number(attributes.allocation),
    claimedSoFar: Number(attributes.claimedSoFar),
    start: campaign.account.start,
    end: campaign.account.end,
    cliffDurationSec: campaign.account.cliffDuration,
    cliffReleaseBps: campaign.account.cliffReleaseBps,
    now,
  });

  const isOriginalRecipient =
    String(attributes.originalRecipient) === String(wallet);

  return {
    asset,
    campaign,
    owner,
    collection,
    attributes,
    claimable: vesting.claimable,
    totalVested: vesting.totalVested,
    fullyVested: vesting.fullyVested,
    isOriginalRecipient,
    transferredAway:
      isOriginalRecipient && String(owner) !== String(wallet),
    campaignStatus: getCampaignStatus(campaign.account, now),
  };
}

async function tryLoadPositionForWallet(
  rpc: AppRpc,
  wallet: Address,
  campaign: CampaignRecord,
): Promise<PositionRecord | null> {
  const [claimReceipt] = await findClaimReceiptPda({
    campaign: campaign.address,
    user: wallet,
  });
  const receiptExists = await accountExists(rpc, claimReceipt);
  if (!receiptExists) return null;

  const asset = await findAssetPda({
    campaign: campaign.address,
    user: wallet,
  });

  const info = await rpc.getAccountInfo(asset, { encoding: "base64" }).send();
  if (!info.value?.data) return null;

  const data = decodeBase64AccountData(info.value.data);
  return buildPositionRecord(asset, data, campaign, wallet);
}

/**
 * Scan the next slice of campaigns for positions tied to `wallet` (via claim
 * receipt + asset PDA). Avoids mpl-core getProgramAccounts — O(batch) RPC calls
 * only. Secondary-market purchases need an indexer / Supabase later.
 */
export async function scanCampaignsForPositions(
  rpc: AppRpc,
  wallet: Address,
  campaigns: CampaignRecord[],
  startIndex: number,
  batchSize = POSITION_CAMPAIGN_SCAN_BATCH,
): Promise<PositionScanResult> {
  const sorted = [...campaigns].sort(
    (a, b) => b.account.start - a.account.start,
  );
  const slice = sorted.slice(startIndex, startIndex + batchSize);

  const found = await mapInBatches(slice, 5, (campaign) =>
    tryLoadPositionForWallet(rpc, wallet, campaign),
  );

  const positions = found.filter(
    (record): record is PositionRecord => record != null,
  );

  const nextCampaignIndex = startIndex + slice.length;

  return {
    positions,
    nextCampaignIndex,
    campaignsScanned: nextCampaignIndex,
    campaignsTotal: sorted.length,
    done: nextCampaignIndex >= sorted.length,
  };
}

export function filterCampaignsByCreator(
  campaigns: CampaignRecord[],
  creator: Address,
): CampaignRecord[] {
  return campaigns.filter((c) => String(c.account.creator) === String(creator));
}

export function dedupePositions(positions: PositionRecord[]): PositionRecord[] {
  const seen = new Set<string>();
  return positions.filter((p) => {
    const key = String(p.asset);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
