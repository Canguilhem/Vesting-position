use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{close_account, CloseAccount, Mint, TokenAccount, TokenInterface},
};
use mpl_core::{
    accounts::BaseCollectionV1, instructions::BurnCollectionV1CpiBuilder, programs::MPL_CORE_ID,
};

use super::clawback::transfer_to_creator;
use crate::{error::ErrorCode, Campaign, CancelEvent, CAMPAIGN, UPDATE_AUTH};

/// Safeguard for a campaign created by mistake:
/// only callable while no position has ever been minted
#[cfg_attr(
    not(target_os = "solana"),
    derive(anchor_litesvm::BundledPubkeys),
    bundled_with(crate::test_helpers::VestingBundle)
)]
#[derive(Accounts)]
pub struct CancelCampaign<'info> {
    #[account(
        mut,
        constraint = creator.key() == campaign.creator @ ErrorCode::Unauthorized
    )]
    pub creator: Signer<'info>,

    #[account(
        mut,
        close = creator,
        seeds = [CAMPAIGN, collection.key().as_ref()],
        bump = campaign.campaign_bump,
    )]
    pub campaign: Account<'info, Campaign>,

    /// CHECK: validated against campaign.collection
    #[account(
        mut,
        constraint = collection.key() == campaign.collection @ ErrorCode::InvalidCollection,
    )]
    pub collection: UncheckedAccount<'info>,

    /// CHECK: update-authority PDA for collection CPI signing.
    /// `mut` because BurnCollectionV1 marks the authority writable.
    #[account(
        mut,
        seeds = [UPDATE_AUTH, collection.key().as_ref()],
        bump = campaign.auth_bump,
    )]
    pub update_authority: UncheckedAccount<'info>,

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

impl<'info> CancelCampaign<'info> {
    pub fn cancel(&self) -> Result<()> {
        // Strict mistake-safeguard: nothing may ever have been minted. Once a
        // claim happened, teardown goes through claim/clawback + close_campaign.
        let collection = BaseCollectionV1::from_bytes(&self.collection.try_borrow_data()?)
            .map_err(|_| ErrorCode::InvalidCollection)?;
        require!(collection.num_minted == 0, ErrorCode::CampaignHasPositions);

        let deposit = self.campaign_ata.amount;
        if deposit > 0 {
            transfer_to_creator(
                &self.token_program,
                &self.campaign_ata,
                &self.mint,
                &self.creator_ata,
                &self.campaign,
                deposit,
            )?;
        }

        let campaign_seeds = self.campaign.signer_seeds();
        close_account(CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            CloseAccount {
                account: self.campaign_ata.to_account_info(),
                destination: self.creator.to_account_info(),
                authority: self.campaign.to_account_info(),
            },
            &[&campaign_seeds],
        ))?;

        let auth_seeds = self.campaign.update_authority_signer_seeds();
        BurnCollectionV1CpiBuilder::new(&self.mpl_core_program.to_account_info())
            .collection(&self.collection.to_account_info())
            .payer(&self.creator.to_account_info())
            .authority(Some(&self.update_authority.to_account_info()))
            .invoke_signed(&[&auth_seeds])?;

        emit!(CancelEvent {
            campaign: self.campaign.key(),
            collection: self.collection.key(),
            creator: self.creator.key(),
            amount_returned: deposit,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
