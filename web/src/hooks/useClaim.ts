import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSolanaClient } from "@solana/react-hooks";
import {
  buildClaimInstructions,
  getUserClaimState,
  parseProgramError,
  type CampaignData,
} from "../solana/vesting-positions";
import type { Address } from "@solana/addresses";
import {
  getMerkleProofForWallet,
  merkleRootMatchesCampaign,
} from "../lib/merkle";
import { useSendWalletTransaction } from "./useSendWalletTransaction";
import { invalidateAfterOnChainWrite } from "../lib/invalidate-on-chain-queries";

function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function proofsToBytes(proofs: number[][]): Uint8Array[] {
  return proofs.map((step) => Uint8Array.from(step));
}

export function useClaim(campaignAddress: Address, campaign: CampaignData) {
  const client = useSolanaClient();
  const queryClient = useQueryClient();
  const { sendWithWallet, isSending, signature, error, reset, isConnected } =
    useSendWalletTransaction();
  const [localError, setLocalError] = useState<string | null>(null);

  const claim = useCallback(async () => {
    if (!isConnected) {
      setLocalError("Connect a wallet first");
      return;
    }

    setLocalError(null);
    reset();

    try {
      let walletForInvalidation: string | undefined;

      await sendWithWallet("claim", async (walletSigner) => {
        const userAddress = walletSigner.address;
        walletForInvalidation = String(userAddress);
        const { isFirstClaim } = await getUserClaimState(
          client.runtime.rpc,
          campaignAddress,
          userAddress,
        );

        let proofs: Uint8Array[] | undefined;
        let allocation: bigint | undefined;

        if (isFirstClaim) {
          const merkle = await getMerkleProofForWallet(userAddress);
          if (!merkle) {
            throw new Error(
              "Your wallet is not on the demo allowlist. Use a whitelisted devnet wallet or deploy a new campaign.",
            );
          }
          if (
            !merkleRootMatchesCampaign(campaign.merkleRoot, merkle.merkleRoot)
          ) {
            throw new Error(
              "Campaign merkle root does not match the bundled allowlist.",
            );
          }
          proofs = proofsToBytes(merkle.proofs);
          allocation = merkle.allocation;
        }

        return buildClaimInstructions({
          user: walletSigner,
          campaignAddress,
          campaign,
          isFirstClaim,
          proofs,
          allocation,
        });
      });

      if (walletForInvalidation) {
        invalidateAfterOnChainWrite(queryClient, walletForInvalidation);
      }
    } catch (err) {
      setLocalError(parseProgramError(err));
    }
  }, [
    isConnected,
    reset,
    sendWithWallet,
    client,
    campaignAddress,
    campaign,
    queryClient,
  ]);

  const txError = localError ?? error;

  return {
    claim,
    isSending,
    signature,
    explorerTxUrl: signature ? explorerTxUrl(signature) : null,
    error: txError,
    canClaim: isConnected,
  };
}
