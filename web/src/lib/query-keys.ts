/** Central query keys — use these so cache invalidation stays consistent. */
export const queryKeys = {
  campaigns: () => ["campaigns"] as const,

  claimState: (campaign: string, user: string) =>
    ["claimState", campaign, user] as const,

  walletBalance: (wallet: string, mint: string) =>
    ["walletBalance", wallet, mint] as const,

  merkleProof: (wallet: string) => ["merkleProof", wallet] as const,

  merkleFixture: () => ["merkleFixture"] as const,

  profile: (wallet: string) => ["profile", wallet] as const,

  profilePositions: (wallet: string) => ["profilePositions", wallet] as const,
};
