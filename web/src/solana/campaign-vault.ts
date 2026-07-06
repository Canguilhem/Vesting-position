import type { Address } from "@solana/addresses";
import type { SolanaClient } from "@solana/client";
import type { CampaignRecord } from "./vesting-positions";
import { fetchWalletTokenBalance } from "./token-balance";

type AppRpc = SolanaClient["runtime"]["rpc"];

export type CampaignDistributionStats = {
  totalDeposit: bigint;
  vaultBalance: bigint;
  /** Tokens that have left the campaign vault (claims + clawbacks). */
  distributed: bigint;
};

export function computeCampaignDistribution(
  totalDeposit: bigint | number,
  vaultBalance: bigint,
): CampaignDistributionStats {
  const total = BigInt(totalDeposit);
  const distributed = total > vaultBalance ? total - vaultBalance : 0n;
  return { totalDeposit: total, vaultBalance, distributed };
}

export function distributionPercent(
  distributed: bigint,
  totalDeposit: bigint,
): number {
  if (totalDeposit === 0n) return 0;
  return Number((distributed * 10000n) / totalDeposit) / 100;
}

export async function fetchCampaignVaultBalance(
  rpc: AppRpc,
  campaign: Address,
  mint: Address,
): Promise<bigint> {
  const { balance } = await fetchWalletTokenBalance(rpc, campaign, mint);
  return balance;
}

export async function fetchCampaignDistributionStats(
  rpc: AppRpc,
  record: CampaignRecord,
): Promise<CampaignDistributionStats> {
  const vaultBalance = await fetchCampaignVaultBalance(
    rpc,
    record.address,
    record.account.mintToDistribute,
  );
  return computeCampaignDistribution(record.account.totalDeposit, vaultBalance);
}
