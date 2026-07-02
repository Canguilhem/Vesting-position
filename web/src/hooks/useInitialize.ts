import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSolanaClient } from "@solana/react-hooks";
import { address, type Address } from "@solana/addresses";
import {
  accountExists,
  buildInitializeInstruction,
  parseProgramError,
  previewInitializeAddresses,
} from "../solana/vesting-positions";
import {
  type CampaignFormValues,
  type InitializeResult,
  campaignFormToParams,
} from "../lib/initialize";
import { invalidateAfterOnChainWrite } from "../lib/invalidate-on-chain-queries";
import { useSendWalletTransaction } from "./useSendWalletTransaction";

function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function toSubmitError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(parseProgramError(err));
}

/**
 * On-chain initialize flow. Throws on failure — TanStack Form owns submit/error UI state.
 */
export function useInitialize() {
  const client = useSolanaClient();
  const queryClient = useQueryClient();
  const { sendWithWallet, reset } = useSendWalletTransaction();

  const initialize = useCallback(
    async (values: CampaignFormValues): Promise<InitializeResult> => {
      reset();

      try {
        const formParams = campaignFormToParams(values);
        const mint = address(formParams.mint);
        let campaign!: Address;
        let collection!: Address;
        let walletAddress!: string;

        const sig = await sendWithWallet(async (walletSigner) => {
          walletAddress = String(walletSigner.address);

          const preview = await previewInitializeAddresses({
            creatorAddress: walletSigner.address,
            mint,
            merkleRoot: formParams.merkleRoot,
          });
          campaign = preview.campaign;
          collection = preview.collection;

          if (await accountExists(client.runtime.rpc, campaign)) {
            throw new Error(
              `Campaign already initialized at ${String(campaign)} for this token and merkle root. ` +
                "Check the Campaigns tab, or use a different merkle root to create another.",
            );
          }

          const initIx = await buildInitializeInstruction({
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
          });

          return [initIx];
        });

        const result: InitializeResult = {
          campaign,
          collection,
          mint,
          totalDeposit: formParams.totalDeposit,
          initializeSignature: sig,
          initializeExplorerUrl: explorerTxUrl(sig),
        };

        invalidateAfterOnChainWrite(queryClient, walletAddress);
        return result;
      } catch (err) {
        throw toSubmitError(err);
      }
    },
    [reset, sendWithWallet, queryClient, client],
  );

  return { initialize };
}
