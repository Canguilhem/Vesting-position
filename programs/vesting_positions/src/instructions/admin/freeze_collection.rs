use anchor_lang::prelude::*;
use mpl_core::{
    instructions::UpdateCollectionPluginV1CpiBuilder,
    types::{PermanentFreezeDelegate, Plugin},
};

use crate::{error::ErrorCode, Campaign, FreezeEvent, CAMPAIGN, UPDATE_AUTH};

#[cfg_attr(
    not(target_os = "solana"),
    derive(anchor_litesvm::BundledPubkeys),
    bundled_with(crate::test_helpers::VestingBundle)
)]
#[derive(Accounts)]
pub struct FreezeCollection<'info> {
    #[account(
        mut,
        constraint = creator.key() == campaign.creator @ ErrorCode::Unauthorized
    )]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [CAMPAIGN, collection.key().as_ref()],
        bump = campaign.campaign_bump,
        constraint = collection.key() == campaign.collection @ ErrorCode::InvalidCollection,
    )]
    pub campaign: Account<'info, Campaign>,

    /// CHECK: validated against campaign.collection
    #[account(
        mut,
        constraint = collection.key() == campaign.collection @ ErrorCode::InvalidCollection,
    )]
    pub collection: UncheckedAccount<'info>,

    /// CHECK: update-authority PDA for collection CPI signing
    #[account(
        seeds = [UPDATE_AUTH, collection.key().as_ref()],
        bump = campaign.auth_bump,
    )]
    pub update_authority: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: mpl-core program id
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,
}

impl<'info> FreezeCollection<'info> {
    pub fn toggle_freeze(&mut self, should_freeze: bool) -> Result<()> {
        self.campaign.is_transferable = !should_freeze;

        let auth_seeds = self.campaign.update_authority_signer_seeds();

        UpdateCollectionPluginV1CpiBuilder::new(&self.mpl_core_program.to_account_info())
            .collection(&self.collection.to_account_info()) // NOT .collection(Some(...))
            .payer(&self.creator.to_account_info())
            .authority(Some(&self.update_authority.to_account_info()))
            .system_program(&self.system_program.to_account_info())
            .plugin(Plugin::PermanentFreezeDelegate(PermanentFreezeDelegate {
                frozen: should_freeze,
            }))
            .invoke_signed(&[&auth_seeds])?;

        emit!(FreezeEvent {
            campaign: self.campaign.key(),
            target: self.collection.key(),
            frozen: should_freeze,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
