use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid timeline")]
    InvalidTimeline,
    #[msg("Invalid update authority")]
    InvalidUpdateAuthority,
    #[msg("Invalid cliff duration")]
    InvalidCliffDuration,
    #[msg("Invalid cliff bps")]
    InvalidCliffBPS,
    #[msg("Maths error")]
    MathError,
    #[msg("Invalid deposit")]
    InvalidDeposit,
    #[msg("Invalid mint")]
    InvalidMint,
    #[msg("Invalid collection")]
    InvalidCollection,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Proofs are missing")]
    ProofsMissing,
    #[msg("Allocation is missing")]
    AllocationsMissing,
    #[msg("Invalid allocation")]
    InvalidAllocation,
    #[msg("Already claimed")]
    AlreadyClaimed,
    #[msg("Invalid proofs")]
    InvalidProofs,
    #[msg("Asset not found")]
    AssetNotFound,
    #[msg("Invalid asset")]
    InvalidAsset,
    #[msg("Not asset owner")]
    NotAssetOwner,
    #[msg("Attribute is missing")]
    AttributeMissing,
    #[msg("Attributes not found")]
    AttributesNotFound,
    #[msg("Invalid attribute")]
    InvalidAttribute,
    #[msg("Position already fully claimed")]
    AlreadyFullyClaimed,
    #[msg("Insufficient vault balance")]
    InsufficientVaultBalance,
    #[msg("Grace period not over")]
    GracePeriodNotOver,
    #[msg("Vault is not empty")]
    VaultNotEmpty,
    #[msg("Campaign already minted positions")]
    CampaignHasPositions,
    #[msg("Claim window closed")]
    ClaimWindowClosed,
    #[msg("Campaign has not started yet")]
    CampaignNotStarted,
    #[msg("Asset has no permanent freeze delegate")]
    FreezePluginMissing,
    #[msg("Campaign is still active")]
    CampaignStillActive,
}
