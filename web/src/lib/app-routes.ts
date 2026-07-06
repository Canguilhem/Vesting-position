/** Deep link to the app browse tab with a campaign pre-selected. */
export function appCampaignUrl(campaignAddress: string): string {
  return `/app?campaign=${encodeURIComponent(campaignAddress)}`;
}
