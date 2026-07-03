import type { AllowListSnapshot } from "./allow-list";
import { getSupabase, isSupabaseConfigured } from "./supabase";

const BATCH_SIZE = 500;

export async function persistCampaignAllowlist(params: {
  campaignAddress: string;
  creatorWallet: string;
  snapshot: AllowListSnapshot;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn(
      "Supabase not configured — allowlist not persisted. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
    return;
  }

  const { campaignAddress, creatorWallet, snapshot } = params;

  const { error: headerError } = await supabase.from("campaign_allowlists").insert({
    campaign_address: campaignAddress,
    merkle_root: snapshot.merkleRoot,
    creator_wallet: creatorWallet.toLowerCase(),
    leaf_count: snapshot.entries.length,
    source_sha256: snapshot.sourceSha256 ?? null,
  });

  if (headerError) {
    throw new Error(`Failed to save allowlist metadata: ${headerError.message}`);
  }

  for (let i = 0; i < snapshot.entries.length; i += BATCH_SIZE) {
    const batch = snapshot.entries.slice(i, i + BATCH_SIZE).map((entry) => ({
      campaign_address: campaignAddress,
      wallet: entry.wallet,
      allocation: entry.allocation.toString(),
      proofs: entry.proofs,
    }));

    const { error } = await supabase.from("allowlist_entries").insert(batch);
    if (error) {
      throw new Error(`Failed to save allowlist entries: ${error.message}`);
    }
  }
}

export type StoredMerkleProof = {
  allocation: bigint;
  proofs: number[][];
  merkleRoot: string;
};

function parseProofHex(hex: string): number[] {
  const stripped = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes: number[] = [];
  for (let i = 0; i < stripped.length; i += 2) {
    bytes.push(Number.parseInt(stripped.slice(i, i + 2), 16));
  }
  if (bytes.length !== 33) {
    throw new Error(`Expected 33-byte proof step, got ${bytes.length}`);
  }
  return bytes;
}

export async function fetchMerkleProofFromStore(
  campaignAddress: string,
  walletAddress: string,
): Promise<StoredMerkleProof | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabase();
  if (!supabase) return null;

  const wallet = walletAddress.toLowerCase();

  const { data: entry, error: entryError } = await supabase
    .from("allowlist_entries")
    .select("allocation, proofs")
    .eq("campaign_address", campaignAddress)
    .eq("wallet", wallet)
    .maybeSingle();

  if (entryError) {
    throw new Error(`Allowlist lookup failed: ${entryError.message}`);
  }
  if (!entry) return null;

  const { data: campaign, error: campaignError } = await supabase
    .from("campaign_allowlists")
    .select("merkle_root")
    .eq("campaign_address", campaignAddress)
    .maybeSingle();

  if (campaignError) {
    throw new Error(`Campaign allowlist lookup failed: ${campaignError.message}`);
  }
  if (!campaign) return null;

  return {
    allocation: BigInt(entry.allocation),
    proofs: entry.proofs.map(parseProofHex),
    merkleRoot: campaign.merkle_root,
  };
}

export async function campaignHasStoredAllowlist(
  campaignAddress: string,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabase = getSupabase();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("campaign_allowlists")
    .select("campaign_address")
    .eq("campaign_address", campaignAddress)
    .maybeSingle();

  if (error) return false;
  return data != null;
}
