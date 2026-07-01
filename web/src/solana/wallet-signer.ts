import { createWalletTransactionSigner, type WalletSession } from "@solana/client";
import type { Instruction, TransactionSigner } from "@solana/kit";

/**
 * Wrap the connected wallet as a Kit {@link TransactionSigner}.
 *
 * Use this **one instance** for:
 * - every instruction account that must sign (creator, user, payer, mint authority, …)
 * - `feePayer` in `useSendTransaction().send()`
 *
 * Do **not** pass `authority: wallet` to send(), and do not use
 * `createNoopSigner(address)` for the connected wallet.
 *
 * @see ../solana/wallet-transaction.ts
 */
export function getConnectedWalletSigner(
  wallet: WalletSession,
): TransactionSigner {
  return createWalletTransactionSigner(wallet).signer;
}

/** Dev-only: log when multiple signer objects share an address. */
export function debugInstructionSigners(
  label: string,
  instructions: readonly Instruction[],
): void {
  if (!import.meta.env.DEV) return;

  const byAddress = new Map<string, object[]>();

  for (const ix of instructions) {
    for (const meta of ix.accounts ?? []) {
      if (!("signer" in meta) || !meta.signer) continue;
      const addr = String(meta.address);
      const list = byAddress.get(addr) ?? [];
      list.push(meta.signer as object);
      byAddress.set(addr, list);
    }
  }

  for (const [addr, signers] of byAddress) {
    const unique = new Set(signers);
    if (unique.size > 1) {
      console.warn(
        `[${label}] address ${addr} has ${unique.size} distinct signer instances:`,
        signers,
      );
    } else {
      console.debug(`[${label}] address ${addr}: 1 signer instance`);
    }
  }
}
