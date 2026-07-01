import type { Address } from "@solana/addresses";
import { findAssociatedTokenPda } from "@solana-program/token";
import type { SolanaClient } from "@solana/client";
import { TOKEN_PROGRAM_ADDRESS } from "./constants";

type AppRpc = SolanaClient["runtime"]["rpc"];

export async function fetchWalletTokenBalance(
  rpc: AppRpc,
  owner: Address,
  mint: Address,
): Promise<{ balance: bigint; ata: Address; exists: boolean }> {
  const [ata] = await findAssociatedTokenPda({
    owner,
    mint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  try {
    const response = await rpc
      .getTokenAccountBalance(ata, { commitment: "confirmed" })
      .send();
    return {
      balance: BigInt(response.value.amount),
      ata,
      exists: true,
    };
  } catch {
    return { balance: 0n, ata, exists: false };
  }
}
