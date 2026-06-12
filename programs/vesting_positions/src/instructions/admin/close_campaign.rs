use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    close_account, CloseAccount, Mint, TokenAccount, TokenInterface,
};

use crate::{error::ErrorCode, Campaign, CloseEvent, CAMPAIGN};

/// Closes the Campaign PDA and Campaign ATA, returning rent to the creator.
/// Requires an empty vault — every allocation must be claimed or clawed back.
/// The mpl-core collection stays alive: loyalty badges keep it non-burnable.
#[cfg_attr(
    not(target_os = "solana"),
    derive(anchor_litesvm::BundledPubkeys),
    bundled_with(crate::test_helpers::VestingBundle)
)]
#[derive(Accounts)]
pub struct CloseCampaign<'info> {
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
    #[account(constraint = collection.key() == campaign.collection @ ErrorCode::InvalidCollection)]
    pub collection: UncheckedAccount<'info>,

    #[account(constraint = mint.key() == campaign.mint_to_distribute @ ErrorCode::InvalidMint)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = campaign,
        associated_token::token_program = token_program,
        constraint = campaign_ata.amount == 0 @ ErrorCode::VaultNotEmpty,
    )]
    pub campaign_ata: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> CloseCampaign<'info> {
    pub fn close(&self) -> Result<()> {
        let seeds = self.campaign.signer_seeds();
        close_account(CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            CloseAccount {
                account: self.campaign_ata.to_account_info(),
                destination: self.creator.to_account_info(),
                authority: self.campaign.to_account_info(),
            },
            &[&seeds],
        ))?;

        emit!(CloseEvent {
            campaign: self.campaign.key(),
            collection: self.collection.key(),
            creator: self.creator.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
