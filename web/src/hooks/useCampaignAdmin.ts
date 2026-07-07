import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Address } from "@solana/addresses";
import {
  buildCancelCampaignInstruction,
  buildClawbackInstruction,
  buildClawbackUnclaimedInstruction,
  buildCloseCampaignInstruction,
  buildExcludeAssetInstruction,
  buildFreezeAssetInstruction,
  buildFreezeCollectionInstruction,
  parseProgramError,
  type CampaignRecord,
} from "../solana/vesting-positions";
import { getMerkleProofForCampaign } from "../lib/merkle";
import { invalidateAfterOnChainWrite } from "../lib/invalidate-on-chain-queries";
import { tryParseAddress } from "../lib/utils";
import { explorerTxUrl } from "../config";
import { useSendWalletTransaction } from "./useSendWalletTransaction";

export type CampaignAdminAction =
  | { type: "freezeCollection"; shouldFreeze: boolean }
  | { type: "freezeAsset"; asset: string; shouldFreeze: boolean }
  | { type: "clawback"; asset: string }
  | { type: "clawbackUnclaimed"; originalRecipient: string }
  | { type: "cancelCampaign" }
  | { type: "closeCampaign" }
  | { type: "excludeAsset"; asset: string };

function adminSuccessMessage(action: CampaignAdminAction): string {
  switch (action.type) {
    case "freezeCollection":
      return action.shouldFreeze ? "Collection frozen" : "Collection unfrozen";
    case "freezeAsset":
      return action.shouldFreeze ? "Position NFT frozen" : "Position NFT unfrozen";
    case "clawback":
      return "Position clawed back";
    case "clawbackUnclaimed":
      return "Unclaimed tokens clawed back";
    case "cancelCampaign":
      return "Campaign cancelled";
    case "closeCampaign":
      return "Campaign closed";
    case "excludeAsset":
      return "Position excluded";
    default: {
      const _exhaustive: never = action;
      return `Admin transaction confirmed: ${String(_exhaustive)}`;
    }
  }
}

export function useCampaignAdmin(record: CampaignRecord) {
  const queryClient = useQueryClient();
  const { sendWithWallet, isSending, signature, error, reset, isConnected } =
    useSendWalletTransaction();
  const [localError, setLocalError] = useState<string | null>(null);
  const [lastSignature, setLastSignature] = useState<string | null>(null);

  const run = useCallback(
    async (action: CampaignAdminAction): Promise<string | null> => {
      if (!isConnected) {
        setLocalError("Connect a wallet first");
        return null;
      }

      setLocalError(null);
      setLastSignature(null);
      reset();

      try {
        let walletForInvalidation: string | undefined;

        const sig = await sendWithWallet(async (creator) => {
          walletForInvalidation = String(creator.address);
          const base = {
            creator,
            campaignAddress: record.address,
            campaign: record.account,
          };

          switch (action.type) {
            case "freezeCollection":
              return [
                await buildFreezeCollectionInstruction({
                  ...base,
                  shouldFreeze: action.shouldFreeze,
                }),
              ];
            case "freezeAsset": {
              const asset = requireAddress(action.asset, "asset");
              return [
                await buildFreezeAssetInstruction({
                  ...base,
                  asset,
                  shouldFreeze: action.shouldFreeze,
                }),
              ];
            }
            case "clawback": {
              const asset = requireAddress(action.asset, "asset");
              return [
                await buildClawbackInstruction({
                  ...base,
                  asset,
                }),
              ];
            }
            case "clawbackUnclaimed": {
              const originalRecipient = requireAddress(
                action.originalRecipient,
                "original recipient",
              );
              const merkle = await getMerkleProofForCampaign(
                String(record.address),
                String(originalRecipient),
                record.account.merkleRoot,
              );
              if (!merkle) {
                throw new Error(
                  "Recipient not found in this campaign's allowlist",
                );
              }
              return [
                await buildClawbackUnclaimedInstruction({
                  ...base,
                  originalRecipient,
                  allocation: merkle.allocation,
                  proofs: merkle.proofs.map((step) => Uint8Array.from(step)),
                }),
              ];
            }
            case "cancelCampaign":
              return [await buildCancelCampaignInstruction(base)];
            case "closeCampaign":
              return [await buildCloseCampaignInstruction(base)];
            case "excludeAsset": {
              const asset = requireAddress(action.asset, "asset");
              return [
                await buildExcludeAssetInstruction({
                  ...base,
                  asset,
                }),
              ];
            }
            default: {
              const _exhaustive: never = action;
              throw new Error(`Unknown admin action: ${String(_exhaustive)}`);
            }
          }
        }, { successMessage: adminSuccessMessage(action) });

        invalidateAfterOnChainWrite(queryClient, walletForInvalidation);
        setLastSignature(sig);
        return sig;
      } catch (err) {
        setLocalError(parseProgramError(err));
        return null;
      }
    },
    [isConnected, reset, sendWithWallet, record, queryClient],
  );

  const txSignature = lastSignature ?? signature;

  return {
    run,
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

function requireAddress(value: string, label: string): Address {
  const parsed = tryParseAddress(value);
  if (!parsed) {
    throw new Error(`Invalid ${label} address`);
  }
  return parsed;
}
