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

#[event]
pub struct ClawbackEvent {
    pub campaign: Pubkey,
    pub asset: Pubkey,
    pub former_owner: Pubkey,
    pub original_recipient: Pubkey,
    pub amount_recovered: u64,
    pub timestamp: i64,
}

#[event]
pub struct InitializeEvent {
    pub campaign: Pubkey,
    pub collection: Pubkey,
    pub creator: Pubkey,
    pub mint: Pubkey,
    pub merkle_root: [u8; 32],
    pub start: i64,
    pub end: i64,
    pub grace_period: u64,
    pub total_deposit: u64,
    pub is_transferable: bool,
    pub timestamp: i64,
}

/// Emitted by both `freeze_collection` and `freeze_asset`;
/// `target` is the collection or asset that was toggled.
#[event]
pub struct FreezeEvent {
    pub campaign: Pubkey,
    pub target: Pubkey,
    pub frozen: bool,
    pub timestamp: i64,
}

#[event]
pub struct CancelEvent {
    pub campaign: Pubkey,
    pub collection: Pubkey,
    pub creator: Pubkey,
    pub amount_returned: u64,
    pub timestamp: i64,
}

#[event]
pub struct CloseEvent {
    pub campaign: Pubkey,
    pub collection: Pubkey,
    pub creator: Pubkey,
    pub timestamp: i64,
}
