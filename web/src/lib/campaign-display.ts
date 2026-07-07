import type { CampaignRecord } from "../solana/vesting-positions";
import { truncate } from "./utils";

export function getCampaignDisplayName(record: CampaignRecord): string {
  const name = record.registryName?.trim();
  if (name) return name;
  return truncate(String(record.address), 6, 6);
}

export function campaignHasRegistryName(record: CampaignRecord): boolean {
  return Boolean(record.registryName?.trim());
}
