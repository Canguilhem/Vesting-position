import { useCallback } from "react";
import { useSendTransaction, useWalletConnection } from "@solana/react-hooks";
import {
  buildInstructionsWithWallet,
  requireWalletSigner,
  walletSendPayload,
  type WalletInstructionBuilder,
} from "../solana/wallet-transaction";
import { parseProgramError } from "../solana/vesting-positions";

/**
 * Shared send path for all wallet-signed transactions.
 * Builds instructions with one signer instance and sends with the same fee payer.
 */
export function useSendWalletTransaction() {
  const { wallet, status } = useWalletConnection();
  const { send, isSending, signature, error, reset } = useSendTransaction();

  const sendWithWallet = useCallback(
    async (
      label: string,
      build: WalletInstructionBuilder,
    ): Promise<string> => {
      const walletSigner = requireWalletSigner(wallet, status);
      const instructions = await buildInstructionsWithWallet(
        walletSigner,
        label,
        build,
      );
      const sig = await send(walletSendPayload(walletSigner, instructions));
      return String(sig);
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
