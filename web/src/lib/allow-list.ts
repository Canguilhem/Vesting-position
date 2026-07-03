import sha3 from "crypto-js/sha3";
import { MerkleTree } from "merkletreejs";
import Papa from "papaparse";

/** Keccak-256 — must match on-chain `leaf_hash` / `verify`. */
const keccak256 = (data: string) => sha3(data, { outputLength: 256 });

export type AllowListAccount = {
  address: string;
  /** Raw token amount (base units), same as on-chain u64. */
  amount: string;
};

export type AllowListSnapshot = {
  merkleRoot: string;
  sourceSha256?: string;
  entries: Array<{
    wallet: string;
    allocation: bigint;
    proofs: string[];
  }>;
};

export class AllowList {
  private tree: MerkleTree;
  private receivers: AllowListAccount[];

  static async fromCsv(csv: string): Promise<AllowList> {
    const records = await new Promise<AllowListAccount[]>((resolve, reject) => {
      Papa.parse<Record<string, string>>(csv.trim(), {
        header: true,
        delimiter: ";",
        transformHeader: (header) => header.trim().toLowerCase(),
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data
            .map((row) => ({
              address: (row.wallet ?? row.address ?? "").trim(),
              amount: (row.amount ?? "").trim(),
            }))
            .filter((row) => row.address && row.amount);
          resolve(rows);
        },
        error: (error: Error) => reject(error),
      });
    });

    return new AllowList(records);
  }

  constructor(accounts: AllowListAccount[]) {
    const sorted = [...accounts].sort((a, b) =>
      a.address > b.address ? 1 : a.address < b.address ? -1 : 0,
    );

    const dup = sorted.filter(
      (row, i) => i > 0 && row.address === sorted[i - 1].address,
    );
    if (dup.length > 0) {
      throw new Error(
        `Duplicate address in allowlist: ${dup.map((d) => d.address).join(", ")}`,
      );
    }

    const leaves = sorted.map((a) =>
      keccak256(a.address.toLowerCase().trim() + a.amount),
    );
    this.tree = new MerkleTree(leaves, keccak256, { sort: false });
    this.receivers = sorted;
  }

  getMerkleRoot(): string {
    return this.tree.getHexRoot().replace("0x", "");
  }

  getMerkleProof(account: AllowListAccount): string[] {
    const leaf = keccak256(
      account.address.toLowerCase().trim() + account.amount,
    ).toString();
    return this.tree
      .getPositionalHexProof(leaf)
      .map((step) =>
        "0x".concat(
          step[0].toString().padStart(2, "0"),
          step[1].toString().replace("0x", ""),
        ),
      );
  }

  get totalAllocation(): bigint {
    return this.receivers.reduce(
      (sum, row) => sum + BigInt(row.amount),
      0n,
    );
  }

  toSnapshot(sourceSha256?: string): AllowListSnapshot {
    const merkleRoot = this.getMerkleRoot();
    return {
      merkleRoot,
      sourceSha256,
      entries: this.receivers.map((account) => ({
        wallet: account.address.toLowerCase().trim(),
        allocation: BigInt(account.amount),
        proofs: this.getMerkleProof(account),
      })),
    };
  }
}

export async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(data),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildAllowListFromCsv(
  csv: string,
): Promise<{ list: AllowList; snapshot: AllowListSnapshot }> {
  const sourceSha256 = await sha256Hex(csv);
  const list = await AllowList.fromCsv(csv);
  return { list, snapshot: list.toSnapshot(sourceSha256) };
}
