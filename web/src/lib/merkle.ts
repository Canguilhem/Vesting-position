export interface MerkleEntry {
  amount: string;
  proofs: string[];
}

export interface MerkleFixture {
  merkleRoot: string;
  [pubkey: string]: MerkleEntry[] | string;
}

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

let cachedFixture: MerkleFixture | null = null;

export async function loadMerkleFixture(): Promise<MerkleFixture> {
  if (cachedFixture) return cachedFixture;
  const res = await fetch("/merkle_proofs.json");
  if (!res.ok) {
    throw new Error("Failed to load merkle proofs");
  }
  cachedFixture = (await res.json()) as MerkleFixture;
  return cachedFixture;
}

export async function getMerkleProofForWallet(walletAddress: string): Promise<{
  allocation: bigint;
  proofs: number[][];
  merkleRoot: string;
} | null> {
  const fixture = await loadMerkleFixture();
  const entries = fixture[walletAddress.toLowerCase()] as
    | MerkleEntry[]
    | undefined;
  if (!entries?.length) return null;

  const entry = entries[0];
  return {
    allocation: BigInt(entry.amount),
    proofs: entry.proofs.map(parseProofHex),
    merkleRoot: fixture.merkleRoot,
  };
}

export function merkleRootMatchesCampaign(
  campaignRoot: Uint8Array,
  fixtureRootHex: string,
): boolean {
  const fixtureRoot = hexToBytes(fixtureRootHex);
  if (campaignRoot.length !== fixtureRoot.length) return false;
  return campaignRoot.every((byte, i) => byte === fixtureRoot[i]);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}
