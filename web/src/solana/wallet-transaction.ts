import type { WalletSession } from "@solana/client";
import type { Instruction, TransactionSigner } from "@solana/kit";
import { COMPUTE_UNIT_LIMIT_MULTIPLIER } from "./constants";
import { getConnectedWalletSigner } from "./wallet-signer";

/**
 * Kit requires one {@link TransactionSigner} instance per address in a transaction.
 *
 * Pattern for every wallet-signed flow:
 * 1. `requireWalletSigner(wallet, status)` → single signer
 * 2. Pass that signer into instruction builders (`creator`, `user`, `authority`, …)
 * 3. `send({ instructions, feePayer: walletSigner })` — same instance, no `authority` on send()
 *
 * Never combine `createNoopSigner(address)` with `feePayer: address` or `authority: wallet`.
 */
export type WalletInstructionBuilder = (
  walletSigner: TransactionSigner,
) => Promise<readonly Instruction[]> | readonly Instruction[];

export function requireWalletSigner(
  wallet: WalletSession | null | undefined,
  status: string,
): TransactionSigner {
  if (!wallet || status !== "connected") {
    throw new Error("Connect a wallet first");
  }
  return getConnectedWalletSigner(wallet);
}

export function walletSendPayload(
  walletSigner: TransactionSigner,
  instructions: readonly Instruction[],
): {
  instructions: readonly Instruction[];
  feePayer: TransactionSigner;
  /** Simulate first, then inject SetComputeUnitLimit from unitsConsumed. */
  prepareTransaction: {
    computeUnitLimitMultiplier: number;
  };
} {
  return {
    instructions,
    feePayer: walletSigner,
    prepareTransaction: {
      computeUnitLimitMultiplier: COMPUTE_UNIT_LIMIT_MULTIPLIER,
    },
  };
}

export { getConnectedWalletSigner } from "./wallet-signer";
