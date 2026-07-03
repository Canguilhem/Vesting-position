import type { AllowListSnapshot } from "./allow-list";
import { CLUSTER } from "../config";
import { persistCampaignAllowlist } from "./merkle-store";
import { getSupabase, isSupabaseConfigured } from "./supabase";

export type CampaignRegistryInput = {
  campaignAddress: string;
  collectionAddress: string;
  mintAddress: string;
  creatorWallet: string;
  merkleRoot: string;
  name: string;
  uri: string;
  totalDeposit: bigint;
  startUnix: number;
  endUnix: number;
  cliffDurationSec: bigint;
  cliffReleaseBps: number;
  gracePeriodSec: bigint;
  isTransferable: boolean;
  initSignature: string;
  cluster?: string;
};

export type LaunchPersistResult = {
  registrySaved: boolean;
  allowlistSaved: boolean;
  registryPersistError?: string;
  allowlistPersistError?: string;
};

function unixToIso(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString();
}

export async function persistCampaignRegistry(
  input: CampaignRegistryInput,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const { error } = await supabase.from("campaigns").insert({
    campaign_address: input.campaignAddress,
    collection_address: input.collectionAddress,
    mint_address: input.mintAddress,
    creator_wallet: input.creatorWallet.toLowerCase(),
    cluster: input.cluster ?? CLUSTER,
    merkle_root: input.merkleRoot,
    name: input.name || null,
    uri: input.uri || null,
    total_deposit: input.totalDeposit.toString(),
    start_at: unixToIso(input.startUnix),
    end_at: unixToIso(input.endUnix),
    cliff_duration_sec: Number(input.cliffDurationSec),
    cliff_release_bps: input.cliffReleaseBps,
    grace_period_sec: Number(input.gracePeriodSec),
    is_transferable: input.isTransferable,
    init_signature: input.initSignature,
  });

  if (error) {
    throw new Error(`Failed to save campaign registry: ${error.message}`);
  }
}

/** Persist campaign row first, then allowlist (FK order). */
export async function persistCampaignLaunch(params: {
  registry: CampaignRegistryInput;
  allowlist?: AllowListSnapshot;
}): Promise<LaunchPersistResult> {
  if (!isSupabaseConfigured()) {
    console.warn(
      "Supabase not configured — campaign not persisted. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
    return { registrySaved: false, allowlistSaved: false };
  }

  const result: LaunchPersistResult = {
    registrySaved: false,
    allowlistSaved: false,
  };

  try {
    await persistCampaignRegistry(params.registry);
    result.registrySaved = true;
  } catch (err) {
    result.registryPersistError =
      err instanceof Error ? err.message : String(err);
    return result;
  }

  if (!params.allowlist) {
    return result;
  }

  try {
    await persistCampaignAllowlist({
      campaignAddress: params.registry.campaignAddress,
      creatorWallet: params.registry.creatorWallet,
      snapshot: params.allowlist,
    });
    result.allowlistSaved = true;
  } catch (err) {
    result.allowlistPersistError =
      err instanceof Error ? err.message : String(err);
  }

  return result;
}

export type StoredCampaign = {
  campaignAddress: string;
  collectionAddress: string;
  mintAddress: string;
  creatorWallet: string;
  cluster: string;
  merkleRoot: string;
  name: string | null;
  uri: string | null;
  totalDeposit: bigint;
  startUnix: number;
  endUnix: number;
  cliffDurationSec: number;
  cliffReleaseBps: number;
  gracePeriodSec: number;
  isTransferable: boolean;
  initSignature: string;
  lifecycleStatus: string;
  createdAt: string;
};

export async function fetchCampaignsFromRegistry(): Promise<StoredCampaign[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Campaign registry fetch failed: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    campaignAddress: row.campaign_address,
    collectionAddress: row.collection_address,
    mintAddress: row.mint_address,
    creatorWallet: row.creator_wallet,
    cluster: row.cluster,
    merkleRoot: row.merkle_root,
    name: row.name,
    uri: row.uri,
    totalDeposit: BigInt(row.total_deposit),
    startUnix: Math.floor(new Date(row.start_at).getTime() / 1000),
    endUnix: Math.floor(new Date(row.end_at).getTime() / 1000),
    cliffDurationSec: Number(row.cliff_duration_sec),
    cliffReleaseBps: row.cliff_release_bps,
    gracePeriodSec: Number(row.grace_period_sec),
    isTransferable: row.is_transferable,
    initSignature: row.init_signature,
    lifecycleStatus: row.lifecycle_status,
    createdAt: row.created_at,
  }));
}
