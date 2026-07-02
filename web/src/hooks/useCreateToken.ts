import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Address } from "@solana/addresses";
import { generateKeyPairSigner } from "@solana/signers";
import {
  buildMintSetupTransactionInstructions,
  parseProgramError,
} from "../solana/vesting-positions";
import { saveToken, type SavedToken } from "../lib/token-registry";
import {
  parseCreateTokenSupply,
  validateCreateTokenForm,
  type CreateTokenFormValues,
} from "../lib/create-token";
import { useSendWalletTransaction } from "./useSendWalletTransaction";
import { invalidateAfterOnChainWrite } from "../lib/invalidate-on-chain-queries";

export type { CreateTokenFormValues } from "../lib/create-token";

export type CreateTokenResult = {
  mint: Address;
  decimals: number;
  supply: bigint;
  signature: string;
  explorerUrl: string;
};

function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function useCreateToken() {
  const queryClient = useQueryClient();
  const { sendWithWallet, isSending, signature, error, reset, isConnected, wallet } =
    useSendWalletTransaction();
  const [localError, setLocalError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CreateTokenResult | null>(null);

  const createToken = useCallback(
    async (values: CreateTokenFormValues): Promise<CreateTokenResult | null> => {
      if (!isConnected) {
        setLocalError("Connect a wallet first");
        return null;
      }

      const validationError = validateCreateTokenForm(values);
      if (validationError) {
        setLocalError(validationError);
        return null;
      }

      setLocalError(null);
      setLastResult(null);
      reset();

      try {
        const mintSigner = await generateKeyPairSigner();
        const supply = parseCreateTokenSupply(values);

        const sig = await sendWithWallet((walletSigner) =>
          buildMintSetupTransactionInstructions({
            authority: walletSigner,
            mintSigner,
            decimals: values.decimals,
            amount: supply,
          }),
        );

        const result: CreateTokenResult = {
          mint: mintSigner.address,
          decimals: values.decimals,
          supply,
          signature: sig,
          explorerUrl: explorerTxUrl(sig),
        };

        const saved: SavedToken = {
          mint: String(result.mint),
          decimals: values.decimals,
          supply: String(supply),
          signature: result.signature,
          label: values.label.trim() || undefined,
          createdAt: Date.now(),
        };
        saveToken(saved);

        setLastResult(result);
        if (wallet?.account.address) {
          invalidateAfterOnChainWrite(
            queryClient,
            String(wallet.account.address),
          );
        }
        return result;
      } catch (err) {
        setLocalError(parseProgramError(err));
        return null;
      }
    },
    [isConnected, reset, sendWithWallet, queryClient, wallet],
  );

  return {
    createToken,
    isSending,
    lastResult,
    signature,
    error: localError ?? error,
    canCreate: isConnected,
    clearResult: () => setLastResult(null),
    clearError: () => {
      setLocalError(null);
      reset();
    },
  };
}
