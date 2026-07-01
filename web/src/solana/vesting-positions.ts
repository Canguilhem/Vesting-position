/**
 * Kit-native vesting_positions client (Codama-generated).
 *
 * Instruction builders accept {@link TransactionSigner} for every wallet-owned
 * account (creator, user, authority, …). Callers must pass the same instance
 * returned by `getConnectedWalletSigner()` as `feePayer` in send(). See
 * `solana/wallet-transaction.ts`.
 *
 * @see https://www.solanakit.com/docs/plugins/generating-program-plugins
 */
import { address, type Address } from "@solana/addresses";
import { assertAccountExists, lamports, type Instruction, type TransactionSigner } from "@solana/kit";
import type { SolanaClient } from "@solana/client";
import {
  CAMPAIGN_DISCRIMINATOR,
  decodeCampaign,
  getCampaignSize,
  type Campaign,
} from "../generated/vesting-positions/src/generated/accounts/campaign";
import { getClaimInstructionAsync } from "../generated/vesting-positions/src/generated/instructions/claim";
import { getInitializeInstructionAsync } from "../generated/vesting-positions/src/generated/instructions/initialize";
import { findCampaignPda } from "../generated/vesting-positions/src/generated/pdas/campaign";
import { findClaimReceiptPda } from "../generated/vesting-positions/src/generated/pdas/claimReceipt";
import { findCollectionPda } from "../generated/vesting-positions/src/generated/pdas/collection";
import { VESTING_POSITIONS_PROGRAM_ADDRESS } from "../generated/vesting-positions/src/generated/programs/vestingPositions";
import { MPL_CORE_PROGRAM_ADDRESS } from "./constants";
import {
  buildMintSetupInstructions,
  type KeyPairSigner,
} from "./mint-setup";
import { findAssetPda } from "./pdas";

export type CampaignData = {
  creator: Address;
  merkleRoot: Uint8Array;
  start: number;
  end: number;
  cliffDuration: number;
  cliffReleaseBps: number;
  mintToDistribute: Address;
  isTransferable: boolean;
  gracePeriod: number;
  totalDeposit: number;
  collection: Address;
};

export type CampaignRecord = {
  address: Address;
  account: CampaignData;
};

function toCampaignData(campaign: Campaign): CampaignData {
  return {
    creator: campaign.creator,
    merkleRoot: Uint8Array.from(campaign.merkleRoot),
    start: Number(campaign.start),
    end: Number(campaign.end),
    cliffDuration: Number(campaign.cliffDuration),
    cliffReleaseBps: campaign.cliffReleaseBps,
    mintToDistribute: campaign.mintToDistribute,
    isTransferable: campaign.isTransferable,
    gracePeriod: Number(campaign.gracePeriod),
    totalDeposit: Number(campaign.totalDeposit),
    collection: campaign.collection,
  };
}

type AppRpc = SolanaClient["runtime"]["rpc"];

export async function fetchAllCampaigns(
  rpc: AppRpc,
): Promise<CampaignRecord[]> {
  type ProgramAccount = {
    pubkey: Address;
    account: {
      data: [string, string];
      executable: boolean;
      lamports: bigint;
      owner: Address;
      space: bigint;
    };
  };

  const accounts = (await rpc
    .getProgramAccounts(VESTING_POSITIONS_PROGRAM_ADDRESS, {
      encoding: "base64",
      filters: [{ dataSize: BigInt(getCampaignSize()) }],
    })
    .send()) as ProgramAccount[];

  return accounts
    .map(({ pubkey, account }) => {
      const [dataBase64] = account.data;
      const data = Uint8Array.from(Buffer.from(dataBase64, "base64"));
      if (
        data.length < 8 ||
        !data.slice(0, 8).every((b, i) => b === CAMPAIGN_DISCRIMINATOR[i])
      ) {
        return null;
      }
      const decoded = decodeCampaign({
        address: pubkey,
        exists: true,
        data,
        executable: account.executable,
        lamports: lamports(account.lamports),
        programAddress: account.owner,
        space: account.space,
      });
      assertAccountExists(decoded);
      return {
        address: pubkey,
        account: toCampaignData(decoded.data),
      };
    })
    .filter((record): record is CampaignRecord => record != null);
}

export async function accountExists(rpc: AppRpc, addr: Address): Promise<boolean> {
  const info = await rpc.getAccountInfo(addr, { encoding: "base64" }).send();
  return info.value != null && info.value.data.length > 0;
}

export type InitializeParams = {
  creator: TransactionSigner;
  mint: Address;
  merkleRoot: Uint8Array;
  start: number;
  end: number;
  cliffDuration: bigint;
  cliffReleaseBps: number;
  isTransferable: boolean;
  gracePeriod: bigint;
  totalDeposit: bigint;
  name: string;
  uri: string;
};

export async function previewInitializeAddresses(params: {
  creatorAddress: Address;
  mint: Address;
  merkleRoot: Uint8Array;
}) {
  const [collection] = await findCollectionPda({
    creator: params.creatorAddress,
    mint: params.mint,
    merkleRoot: params.merkleRoot,
  });
  const [campaign] = await findCampaignPda({ collection });
  return { collection, campaign };
}

export async function buildInitializeInstructions(
  params: InitializeParams,
): Promise<Instruction[]> {
  const {
    creator,
    mint,
    merkleRoot,
    start,
    end,
    cliffDuration,
    cliffReleaseBps,
    isTransferable,
    gracePeriod,
    totalDeposit,
    name,
    uri,
  } = params;

  const initializeIx = await getInitializeInstructionAsync({
    creator,
    mint,
    merkleRoot,
    start,
    end,
    cliffDuration,
    cliffReleaseBps,
    mintToDistribute: mint,
    isTransferable,
    gracePeriod,
    totalDeposit,
    name,
    uri,
    mplCoreProgram: MPL_CORE_PROGRAM_ADDRESS,
  });

  return [initializeIx];
}

export async function buildMintSetupTransactionInstructions(params: {
  authority: TransactionSigner;
  mintSigner: KeyPairSigner;
  decimals: number;
  amount: bigint;
}): Promise<Instruction[]> {
  const setup = await buildMintSetupInstructions({
    authority: params.authority,
    mintSigner: params.mintSigner,
    decimals: params.decimals,
    amount: params.amount,
  });

  return setup;
}

export async function buildLaunchCampaignInstructions(params: {
  creator: TransactionSigner;
  mint: Address;
  initialize: Omit<InitializeParams, "creator" | "mint">;
}): Promise<Instruction[]> {
  return buildInitializeInstructions({
    creator: params.creator,
    mint: params.mint,
    ...params.initialize,
  });
}

export async function buildClaimInstructions(params: {
  user: TransactionSigner;
  campaignAddress: Address;
  campaign: CampaignData;
  isFirstClaim: boolean;
  proofs?: Array<Uint8Array>;
  allocation?: bigint;
  name?: string;
  uri?: string;
}): Promise<Instruction[]> {
  const {
    user,
    campaignAddress,
    campaign,
    isFirstClaim,
    proofs,
    allocation,
    name = "Vesting Position",
    uri = "https://vesting-positions.dev/position.json",
  } = params;

  const asset = await findAssetPda({
    campaign: campaignAddress,
    user: user.address,
  });

  const claimIx = await getClaimInstructionAsync({
    user,
    collection: campaign.collection,
    campaign: campaignAddress,
    mint: campaign.mintToDistribute,
    asset,
    proofs: isFirstClaim ? (proofs ?? null) : null,
    allocation:
      isFirstClaim && allocation != null ? allocation : null,
    name,
    uri,
    mplCoreProgram: MPL_CORE_PROGRAM_ADDRESS,
  });

  return [claimIx];
}

export async function getUserClaimState(
  rpc: AppRpc,
  campaignAddress: Address,
  userAddress: Address,
) {
  const [claimReceipt] = await findClaimReceiptPda({
    campaign: campaignAddress,
    user: userAddress,
  });
  const asset = await findAssetPda({
    campaign: campaignAddress,
    user: userAddress,
  });

  const [receiptExists, assetExists] = await Promise.all([
    accountExists(rpc, claimReceipt),
    accountExists(rpc, asset),
  ]);

  return {
    hasReceipt: receiptExists,
    hasAsset: assetExists,
    isFirstClaim: !receiptExists && !assetExists,
    claimReceipt,
    asset,
  };
}

export function parseProgramError(error: unknown): string {
  const planError = extractTransactionPlanError(error);
  if (planError) return planError;

  if (error instanceof Error) {
    if ("cause" in error && error.cause) {
      const nested = parseProgramError(error.cause);
      if (nested !== String(error.cause)) return nested;
    }
    const match = error.message.match(/Error Code: (\w+)/);
    if (match) return match[1].replace(/([A-Z])/g, " $1").trim();
    const logs = extractSimulationLogs(error);
    if (logs) return logs;
    return error.message;
  }
  return String(error);
}

type TransactionPlanResult = {
  kind: string;
  status?: string;
  error?: unknown;
  plans?: TransactionPlanResult[];
};

function extractTransactionPlanError(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;

  const planResult = (error as { transactionPlanResult?: TransactionPlanResult })
    .transactionPlanResult;
  if (planResult) {
    const inner = findFailedPlanError(planResult);
    if (inner) return parseProgramError(inner);
  }

  return null;
}

function findFailedPlanError(plan: TransactionPlanResult): unknown {
  if (plan.kind === "single" && plan.status === "failed") {
    return plan.error;
  }
  for (const child of plan.plans ?? []) {
    const nested = findFailedPlanError(child);
    if (nested) return nested;
  }
  return null;
}

function extractSimulationLogs(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const context = (error as { context?: { logs?: string[]; __code?: number } })
    .context;
  const logs = context?.logs;
  if (!logs?.length) return null;

  const programLog = [...logs]
    .reverse()
    .find(
      (line) =>
        line.includes("Error") ||
        line.includes("failed") ||
        line.includes("custom program error"),
    );
  return programLog ?? logs.at(-1) ?? null;
}

export { getConnectedWalletSigner, debugInstructionSigners } from "./wallet-signer";
export {
  buildInstructionsWithWallet,
  requireWalletSigner,
  walletSendPayload,
  type WalletInstructionBuilder,
} from "./wallet-transaction";
export { address };
