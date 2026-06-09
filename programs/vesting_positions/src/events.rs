use anchor_lang::prelude::*;

#[event]
pub struct ClaimEvent {
    pub campaign: Pubkey,
    pub asset: Pubkey,
    pub claimant: Pubkey,
    pub original_recipient: Pubkey,
    pub amount: u64,
    pub claimed_so_far: u64,
    pub timestamp: i64,
}
