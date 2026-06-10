use anchor_lang::prelude::*;

use crate::{CAMPAIGN, COLLECTION, UPDATE_AUTH};

#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub creator: Pubkey,
    pub merkle_root: [u8; 32],
    pub start: i64, // absolute timestamp
    pub end: i64,   // absolute timestamp
    pub cliff_duration: u64,
    pub cliff_release_bps: u16,
    pub mint_to_distribute: Pubkey,
    pub is_transferable: bool,
    pub grace_period: u64, // duration
    pub total_deposit: u64,
    // pub admin: Pubkey,
    pub collection: Pubkey,

    pub campaign_bump: u8,
    pub collection_bump: u8,
    pub auth_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ClaimReceipt {
    pub claimer: Pubkey,
    pub allocation: u64,
    pub asset: Pubkey,
}

impl Campaign {
    pub fn signer_seeds(&self) -> [&[u8]; 3] {
        [
            CAMPAIGN,
            self.collection.as_ref(),
            core::slice::from_ref(&self.campaign_bump),
        ]
    }
    pub fn collection_signer_seeds(&self) -> [&[u8]; 5] {
        [
            COLLECTION,
            self.creator.as_ref(),
            self.mint_to_distribute.as_ref(),
            self.merkle_root.as_ref(),
            core::slice::from_ref(&self.collection_bump),
        ]
    }
    pub fn update_authority_signer_seeds(&self) -> [&[u8]; 3] {
        [
            UPDATE_AUTH,
            self.collection.as_ref(),
            core::slice::from_ref(&self.auth_bump),
        ]
    }
}
