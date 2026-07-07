import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { buildTransferV1Instruction } from "../lib/mpl-core-transfer";
import { invalidateAfterOnChainWrite } from "../lib/invalidate-on-chain-queries";
import { tryParseAddress } from "../lib/utils";
import { explorerTxUrl } from "../config";
import { parseProgramError } from "../solana/vesting-positions";
import type { PositionRecord } from "../solana/profile-data";
import { useSendWalletTransaction } from "./useSendWalletTransaction";

export function useTransferPosition(position: PositionRecord) {
  const queryClient = useQueryClient();
  const { sendWithWallet, isSending, signature, error, reset, isConnected } =
    useSendWalletTransaction();
  const [localError, setLocalError] = useState<string | null>(null);
  const [lastSignature, setLastSignature] = useState<string | null>(null);

  const transfer = useCallback(
    async (recipientInput: string): Promise<string | null> => {
      if (!isConnected) {
        setLocalError("Connect a wallet first");
        return null;
      }

      const newOwner = tryParseAddress(recipientInput);
      if (!newOwner) {
        setLocalError("Invalid recipient address");
        return null;
      }

      setLocalError(null);
      setLastSignature(null);
      reset();

      try {
        let walletForInvalidation: string | undefined;

        const sig = await sendWithWallet(async (walletSigner) => {
          walletForInvalidation = String(walletSigner.address);

          if (String(walletSigner.address) === String(newOwner)) {
            throw new Error("Cannot transfer to yourself");
          }

          return [
            buildTransferV1Instruction({
              asset: position.asset,
              collection: position.collection,
              payer: walletSigner,
              authority: walletSigner,
              newOwner,
            }),
          ];
        }, { successMessage: "Position NFT transferred" });

        if (walletForInvalidation) {
          invalidateAfterOnChainWrite(queryClient, walletForInvalidation);
        }

        setLastSignature(sig);
        return sig;
      } catch (err) {
        setLocalError(parseProgramError(err));
        return null;
      }
    },
    [isConnected, reset, sendWithWallet, position, queryClient],
  );

  const txSignature = lastSignature ?? signature;

  return {
    transfer,
    isSending,
    signature: txSignature,
    explorerTxUrl: txSignature ? explorerTxUrl(txSignature) : null,
    error: localError ?? error,
    isConnected,
    clearResult: () => {
      setLastSignature(null);
      setLocalError(null);
      reset();
    },
  };
}
