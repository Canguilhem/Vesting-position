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
    #[msg("Asset must sign")]
    AssetMustSign,
    #[msg("Proofs are missing")]
    ProofsMissing,
    #[msg("Invalid allocation")]
    InvalidAllocation,
    #[msg("Invalid proofs")]
    InvalidProofs,
}
