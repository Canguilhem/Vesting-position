// #![allow(unexpected_cfgs,deprecated,ambiguous_glob_imports)]
#![allow(deprecated)]
use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;
pub mod utils;

#[cfg(not(target_os = "solana"))]
pub mod test_helpers;

pub use constants::*;
pub use events::*;
pub use instructions::*;
pub use state::*;
pub use utils::*;

declare_id!("4hAzFNAWaGZ5YpbRkSsfLNnQ3JXenkb3hAQ19nL7vTH3");

#[program]
pub mod vesting_positions {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        merkle_root: [u8; 32],
        start: i64, // absolute timestamp
        end: i64,   // absolute timestamp
        cliff_duration: u64,
        cliff_release_bps: u16,
        mint_to_distribute: Pubkey,
        is_transferable: bool,
        grace_period: u64, // duration
        total_deposit: u64,
        name: String,
        uri: String,
    ) -> Result<()> {
        ctx.accounts.init(
            name,
            merkle_root,
            start,
            end,
            cliff_duration,
            cliff_release_bps,
            mint_to_distribute,
            is_transferable,
            grace_period,
            total_deposit,
            uri,
            ctx.bumps,
        )
    }

    pub fn claim(
        ctx: Context<Claim>,
        proofs: Option<Vec<[u8; 33]>>,
        allocation: Option<u64>,
        name: String,
        uri: String,
    ) -> Result<()> {
        ctx.accounts.claim(proofs, allocation, name, uri)
    }

    pub fn exclude_asset(ctx: Context<ExcludeAsset>) -> Result<()> {
        ctx.accounts.exclude()
    }

    pub fn freeze_collection(ctx: Context<FreezeCollection>, should_freeze: bool) -> Result<()> {
        ctx.accounts.toggle_freeze(should_freeze)
    }

    pub fn freeze_asset(ctx: Context<FreezeAsset>, should_freeze: bool) -> Result<()> {
        ctx.accounts.toggle_freeze(should_freeze)
    }

    pub fn clawback(ctx: Context<Clawback>) -> Result<()> {
        ctx.accounts.clawback()
    }

    pub fn clawback_unclaimed(
        ctx: Context<ClawbackUnclaimed>,
        original_recipient: Pubkey,
        allocation: u64,
        proofs: Vec<[u8; 33]>,
    ) -> Result<()> {
        ctx.accounts
            .clawback_unclaimed(original_recipient, allocation, proofs)
    }

    pub fn close_campaign(ctx: Context<CloseCampaign>) -> Result<()> {
        ctx.accounts.close()
    }

    pub fn cancel_campaign(ctx: Context<CancelCampaign>) -> Result<()> {
        ctx.accounts.cancel()
    }

    pub fn close_receipt(ctx: Context<CloseReceipt>) -> Result<()> {
        ctx.accounts.close()
    }
}
