import type { SolanaClient } from "@solana/client";

type AppRpc = SolanaClient["runtime"]["rpc"];

/** Devnet/mainnet unix time from a recent confirmed slot (matches on-chain Clock). */
export async function fetchClusterUnixTime(rpc: AppRpc): Promise<number> {
  let slot = await rpc.getSlot({ commitment: "confirmed" }).send();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const blockTime = await rpc.getBlockTime(slot).send();
    if (blockTime != null) {
      return Number(blockTime);
    }
    slot = slot - 1n;
  }

  throw new Error("Could not read cluster time from RPC");
}
