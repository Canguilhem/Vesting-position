import { createWalletTransactionSigner, type WalletSession } from "@solana/client";
import type { TransactionSigner } from "@solana/kit";

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
