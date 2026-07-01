import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { address } from "@solana/addresses";
import {
  buildInitializeInstructions,
  parseProgramError,
  previewInitializeAddresses,
} from "../solana/vesting-positions";
import {
  campaignFormToParams,
  validateCampaignForm,
  type CampaignFormValues,
  type InitializeResult,
} from "../lib/initialize";
import { useSendWalletTransaction } from "./useSendWalletTransaction";
import { requireWalletSigner } from "../solana/wallet-transaction";
import { invalidateAfterOnChainWrite } from "../lib/invalidate-on-chain-queries";

function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function useInitialize() {
  const queryClient = useQueryClient();
  const {
    sendWithWallet,
    isSending,
    signature,
    error,
    reset,
    isConnected,
    wallet,
    status,
  } = useSendWalletTransaction();
  const [localError, setLocalError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<InitializeResult | null>(null);

  const initialize = useCallback(
    async (values: CampaignFormValues): Promise<InitializeResult | null> => {
      if (!isConnected) {
        setLocalError("Connect a wallet first");
        return null;
      }

      const validationError = validateCampaignForm(values);
      if (validationError) {
        setLocalError(validationError);
        return null;
      }

      setLocalError(null);
      setLastResult(null);
      setProgress(null);
      reset();

      try {
        const formParams = campaignFormToParams(values);
        const mint = address(formParams.mint);
        const creatorAddress = requireWalletSigner(wallet, status).address;

        const { campaign, collection } = await previewInitializeAddresses({
          creatorAddress,
          mint,
          merkleRoot: formParams.merkleRoot,
        });

        setProgress("Initializing campaign…");

        const sig = await sendWithWallet("initialize", (walletSigner) =>
          buildInitializeInstructions({
            creator: walletSigner,
            mint,
            merkleRoot: formParams.merkleRoot,
            start: formParams.start,
            end: formParams.end,
            cliffDuration: formParams.cliffDuration,
            cliffReleaseBps: formParams.cliffReleaseBps,
            isTransferable: formParams.isTransferable,
            gracePeriod: formParams.gracePeriod,
            totalDeposit: formParams.totalDeposit,
            name: formParams.name,
            uri: formParams.uri,
          }),
        );

        const result: InitializeResult = {
          campaign,
          collection,
          mint,
          totalDeposit: formParams.totalDeposit,
          initializeSignature: sig,
          initializeExplorerUrl: explorerTxUrl(sig),
        };

        setProgress(null);
        setLastResult(result);
        invalidateAfterOnChainWrite(queryClient, String(creatorAddress));
        return result;
      } catch (err) {
        setProgress(null);
        setLocalError(parseProgramError(err));
        return null;
      }
    },
    [isConnected, reset, sendWithWallet, wallet, status, queryClient],
  );

  return {
    initialize,
    isSending,
    progress,
    lastResult,
    clearResult: () => setLastResult(null),
    signature,
    error: localError ?? error,
    canInitialize: isConnected,
  };
}
