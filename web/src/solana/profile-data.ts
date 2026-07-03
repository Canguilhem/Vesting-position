import type { Address } from "@solana/addresses";
import type { Base58EncodedBytes, Base64EncodedBytes } from "@solana/rpc-types";
import type { SolanaClient } from "@solana/client";
import { findClaimReceiptPda } from "../generated/vesting-positions/src/generated/pdas/claimReceipt";
import { accountExists, type CampaignRecord } from "./vesting-positions";
import { MPL_CORE_PROGRAM_ADDRESS } from "./constants";
import { findAssetPda } from "./pdas";
import {
  isVestingPositionAsset,
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

type MplCoreProgramAccount = {
  pubkey: Address;
  account: { data: [string, string] };
};

/**
 * Positions held in this wallet (including received transfers). Asset PDAs stay
 * tied to the original recipient; owner is read from mpl-core account data.
 */
async function fetchHeldVestingPositions(
  rpc: AppRpc,
  wallet: Address,
  campaigns: CampaignRecord[],
): Promise<PositionRecord[]> {
  const campaignByCollection = new Map(
    campaigns.map((c) => [String(c.account.collection), c]),
  );

  const accounts = (await rpc
    .getProgramAccounts(MPL_CORE_PROGRAM_ADDRESS, {
      encoding: "base64",
      filters: [
        {
          memcmp: {
            offset: 0n,
            bytes: "AQ==" as Base64EncodedBytes,
            encoding: "base64",
          },
        },
        {
          memcmp: {
            offset: 1n,
            bytes: String(wallet) as Base58EncodedBytes,
            encoding: "base58",
          },
        },
      ],
    })
    .send()) as MplCoreProgramAccount[];

  const positions: PositionRecord[] = [];

  for (const { pubkey, account } of accounts) {
    const data = decodeBase64AccountData(account.data);
    if (!isVestingPositionAsset(data)) continue;

    const collection = parseAssetCollection(data);
    if (!collection) continue;

    const campaign = campaignByCollection.get(String(collection));
    if (!campaign) continue;

    const record = buildPositionRecord(pubkey, data, campaign, wallet);
    if (record) positions.push(record);
  }

  return positions;
}

async function tryLoadHeldPositionForCampaign(
  rpc: AppRpc,
  wallet: Address,
  campaign: CampaignRecord,
): Promise<PositionRecord | null> {
  const held = await fetchHeldVestingPositions(rpc, wallet, [campaign]);
  return held[0] ?? null;
}

export async function fetchUserCampaignPosition(
  rpc: AppRpc,
  wallet: Address,
  campaign: CampaignRecord,
): Promise<PositionRecord | null> {
  const asRecipient = await tryLoadPositionForWallet(rpc, wallet, campaign);
  if (asRecipient) return asRecipient;
  return tryLoadHeldPositionForCampaign(rpc, wallet, campaign);
}

/**
 * Scan campaigns for positions: claim-receipt path (original recipient, including
 * transferred away) plus mpl-core owner scan on the first batch (received transfers).
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

  const [receiptBased, held] = await Promise.all([
    mapInBatches(slice, 5, (campaign) =>
      tryLoadPositionForWallet(rpc, wallet, campaign),
    ),
    startIndex === 0
      ? fetchHeldVestingPositions(rpc, wallet, sorted)
      : Promise.resolve([]),
  ]);

  const positions = dedupePositions([
    ...receiptBased.filter(
      (record): record is PositionRecord => record != null,
    ),
    ...held,
  ]);

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
