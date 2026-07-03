import type { Address } from "@solana/addresses";
import { LaunchCampaignWizard } from "./Launch/LaunchCampaignWizard";

/** @deprecated Use LaunchCampaignWizard — kept as a thin alias. */
export function InitializeCampaign({
  prefilledMint,
  onViewCampaign,
}: {
  prefilledMint?: Address | null;
  onViewCampaign?: (campaign: Address) => void;
}) {
  return (
    <LaunchCampaignWizard
      prefilledMint={prefilledMint}
      onViewCampaign={onViewCampaign}
    />
  );
}
