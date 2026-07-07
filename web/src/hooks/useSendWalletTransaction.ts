import { useCallback } from "react";
import { useSendTransaction, useWalletConnection } from "@solana/react-hooks";
import {
  requireWalletSigner,
  walletSendPayload,
  type WalletInstructionBuilder,
} from "../solana/wallet-transaction";
import { parseProgramError } from "../solana/vesting-positions";
import {
  toastTransactionError,
  toastTransactionSuccess,
  type TransactionToastOptions,
} from "../lib/transaction-toast";

/**
 * Shared send path for all wallet-signed transactions.
 * Builds instructions with one signer instance and sends with the same fee payer.
 */
export function useSendWalletTransaction() {
  const { wallet, status } = useWalletConnection();
  const { send, isSending, signature, error, reset } = useSendTransaction();

  const sendWithWallet = useCallback(
    async (
      build: WalletInstructionBuilder,
      options?: TransactionToastOptions,
    ): Promise<string> => {
      try {
        const walletSigner = requireWalletSigner(wallet, status);
        const instructions = await build(walletSigner);
        const sig = String(
          await send(walletSendPayload(walletSigner, instructions)),
        );
        if (!options?.skipSuccessToast) {
          toastTransactionSuccess(
            sig,
            options?.successMessage ?? "Transaction confirmed",
          );
        }
        return sig;
      } catch (err) {
        toastTransactionError(
          err instanceof Error ? err : parseProgramError(err),
          options?.errorMessage ?? "Transaction failed",
        );
        throw err;
      }
    },
    [wallet, status, send],
  );

  return {
    sendWithWallet,
    isSending,
    signature: signature ? String(signature) : null,
    error: error ? parseProgramError(error) : null,
    reset,
    isConnected: status === "connected",
    wallet,
    status,
  };
}
