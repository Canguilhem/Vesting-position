use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};
use mpl_core::programs::MPL_CORE_ID;

use super::clawback::{burn_position_and_recover, BurnPositionAccounts};
use crate::{error::ErrorCode, Campaign, CAMPAIGN, UPDATE_AUTH};

/// Burn position NFT and returns unclaimed remainder (`allocation - claimed_so_far`) to creator
#[cfg_attr(
    not(target_os = "solana"),
    derive(anchor_litesvm::BundledPubkeys),
    bundled_with(crate::test_helpers::VestingBundle)
)]
#[derive(Accounts)]
pub struct ExcludeAsset<'info> {
    #[account(
        mut,
        constraint = creator.key() == campaign.creator @ ErrorCode::Unauthorized
    )]
    pub creator: Signer<'info>,

    #[account(
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

    /// CHECK: mpl-core asset validated in exclude
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,

    #[account(constraint = mint.key() == campaign.mint_to_distribute @ ErrorCode::InvalidMint)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = campaign,
        associated_token::token_program = token_program,
    )]
    pub campaign_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = creator,
        associated_token::token_program = token_program,
    )]
    pub creator_ata: InterfaceAccount<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// CHECK: mpl-core program id
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: UncheckedAccount<'info>,
}

impl<'info> ExcludeAsset<'info> {
    pub fn exclude(&self) -> Result<()> {
        burn_position_and_recover(BurnPositionAccounts {
            campaign: &self.campaign,
            collection: &self.collection,
            update_authority: &self.update_authority,
            asset: &self.asset,
            mint: &self.mint,
            campaign_ata: &self.campaign_ata,
            creator_ata: &self.creator_ata,
            payer: &self.creator,
            token_program: &self.token_program,
            system_program: &self.system_program,
            mpl_core_program: &self.mpl_core_program,
        })
    }
}
