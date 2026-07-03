import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSolanaClient } from "@solana/react-hooks";
import {
  buildClaimInstruction,
  getUserClaimState,
  parseProgramError,
  type CampaignRecord,
} from "../solana/vesting-positions";
import type { Address } from "@solana/addresses";
import {
  getMerkleProofForWallet,
  merkleRootMatchesCampaign,
} from "../lib/merkle";
import { fetchUserCampaignPosition } from "../solana/profile-data";
import { useSendWalletTransaction } from "./useSendWalletTransaction";
import { invalidateAfterOnChainWrite } from "../lib/invalidate-on-chain-queries";

function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function proofsToBytes(proofs: number[][]): Uint8Array[] {
  return proofs.map((step) => Uint8Array.from(step));
}

export type ClaimResult = {
  signature: string;
  explorerTxUrl: string;
  /** Tokens received this claim (delta from on-chain position attribute). */
  received: bigint;
};

export function useClaim(record: CampaignRecord) {
  const client = useSolanaClient();
  const queryClient = useQueryClient();
  const { sendWithWallet, isSending, signature, error, reset, isConnected } =
    useSendWalletTransaction();
  const [localError, setLocalError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ClaimResult | null>(null);

  const claim = useCallback(async (): Promise<ClaimResult | null> => {
    if (!isConnected) {
      setLocalError("Connect a wallet first");
      return null;
    }

    setLocalError(null);
    setLastResult(null);
    reset();

    try {
      let walletForInvalidation: string | undefined;
      let userAddressForRefresh: Address | undefined;
      let claimedBefore = 0n;

      const sig = await sendWithWallet(async (walletSigner) => {
        const userAddress = walletSigner.address;
        walletForInvalidation = String(userAddress);
        userAddressForRefresh = userAddress;

        const positionBefore = await fetchUserCampaignPosition(
          client.runtime.rpc,
          userAddress,
          record,
        );
        claimedBefore = positionBefore?.attributes.claimedSoFar ?? 0n;

        const holdsPosition =
          positionBefore != null &&
          String(positionBefore.owner) === String(userAddress);

        const { isFirstClaim: receiptSaysFirst } = await getUserClaimState(
          client.runtime.rpc,
          record.address,
          userAddress,
        );
        const isFirstClaim = receiptSaysFirst && !holdsPosition;

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
            !merkleRootMatchesCampaign(
              record.account.merkleRoot,
              merkle.merkleRoot,
            )
          ) {
            throw new Error(
              "Campaign merkle root does not match the bundled allowlist.",
            );
          }
          proofs = proofsToBytes(merkle.proofs);
          allocation = merkle.allocation;
        }

        return [
          await buildClaimInstruction({
            user: walletSigner,
            campaignAddress: record.address,
            campaign: record.account,
            isFirstClaim,
            proofs,
            allocation,
            assetAddress: positionBefore?.asset,
          }),
        ];
      });

      if (walletForInvalidation) {
        invalidateAfterOnChainWrite(queryClient, walletForInvalidation);
      }

      if (!userAddressForRefresh) {
        throw new Error("Wallet address missing after claim");
      }

      let positionAfter: Awaited<
        ReturnType<typeof fetchUserCampaignPosition>
      > = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        positionAfter = await fetchUserCampaignPosition(
          client.runtime.rpc,
          userAddressForRefresh,
          record,
        );
        const claimedAfter = positionAfter?.attributes.claimedSoFar ?? 0n;
        if (claimedAfter > claimedBefore) break;
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      const claimedAfter = positionAfter?.attributes.claimedSoFar ?? 0n;
      const received =
        claimedAfter > claimedBefore ? claimedAfter - claimedBefore : 0n;

      const result: ClaimResult = {
        signature: sig,
        explorerTxUrl: explorerTxUrl(sig),
        received,
      };
      setLastResult(result);
      return result;
    } catch (err) {
      setLocalError(parseProgramError(err));
      return null;
    }
  }, [
    isConnected,
    reset,
    sendWithWallet,
    client,
    record,
    queryClient,
  ]);

  const txError = localError ?? error;

  return {
    claim,
    isSending,
    signature,
    lastResult,
    explorerTxUrl: signature ? explorerTxUrl(signature) : null,
    error: txError,
    canClaim: isConnected,
    clearResult: () => setLastResult(null),
  };
}
