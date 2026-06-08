use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};
use mpl_core::{instructions::CreateCollectionV2CpiBuilder, programs::MPL_CORE_ID};

use crate::{error::ErrorCode, Campaign, CAMPAIGN, COLLECTION, UPDATE_AUTH};

#[derive(Accounts)]
#[instruction(merkle_root: [u8; 32])]
pub struct Initialize<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    /// CHECK: using a pda instead of a client signer
    // usign merkle_root as id => assumes each campaign should have different merkleroot
    // TODO: confirm w/ defensive tests: should we prevent root for empty tree ?
    #[account(
        mut,
        seeds = [COLLECTION, creator.key().as_ref(), mint.key().as_ref(), merkle_root.as_ref()],
        bump,
    )]
    pub collection: UncheckedAccount<'info>,

    /// CHECK: This account isnt initialized and is being used for signing purposed only, we verify that derives from the correct seed
    #[account(
        seeds=[UPDATE_AUTH, collection.key().as_ref()],
        bump
    )]
    pub update_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut,
        associated_token::mint= mint,
        associated_token::authority= creator,
        associated_token::token_program= associated_token_program
    )]
    pub creator_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer= creator,
        associated_token::mint= mint,
        associated_token::authority= campaign,
        associated_token::token_program= associated_token_program
    )]
    pub campaign_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer= creator,
        space= Campaign::DISCRIMINATOR.len() + Campaign::INIT_SPACE,
        seeds = [CAMPAIGN, collection.key().as_ref()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// CHECK: This is the ID of the MPL Core program
    #[account(address= MPL_CORE_ID)]
    pub mpl_core_program: UncheckedAccount<'info>,
}

impl<'info> Initialize<'info> {
    fn validate_campaign(&self, campaign: &Campaign) -> Result<()> {
        // validate timeline (start | end | grace_period)
        let now = Clock::get()?.unix_timestamp;

        // starts in future
        require!(
            campaign.start >= 0 && campaign.start < campaign.end && now > campaign.start,
            ErrorCode::InvalidTimeline
        );

        // ensure start + cliff doesn't overflow i64
        let _ = campaign
            .start
            .checked_add(campaign.cliff_duration as i64)
            .ok_or(ErrorCode::MathError)?;

        // validate amount total deposit
        require!(campaign.total_deposit > 0, ErrorCode::InvalidDeposit);

        //validate cliff duration & bps
        let total_duration = (campaign.end - campaign.start) as u64;
        require!(
            campaign.cliff_duration <= total_duration,
            ErrorCode::InvalidCliffDuration
        );
        require!(
            campaign.cliff_release_bps <= 10_000,
            ErrorCode::InvalidCliffBPS
        );

        Ok(())
    }

    fn init_campaign_collection(
        &mut self,
        name: String,
        uri: String,
        seeds: &[&[&[u8]]],
    ) -> Result<()> {
        CreateCollectionV2CpiBuilder::new(&self.mpl_core_program.to_account_info())
            .collection(&self.collection.to_account_info())
            .payer(&self.creator.to_account_info())
            .update_authority(Some(&self.update_authority.to_account_info()))
            .system_program(&self.system_program.to_account_info())
            .name(name)
            .uri(uri)
            .invoke_signed(seeds)?;

        Ok(())
    }

    fn deposit_tokens(&self, amount: u64) -> Result<()> {
        let cpi = TransferChecked {
            from: self.creator_ata.to_account_info(),
            mint: self.mint.to_account_info(),
            to: self.campaign_ata.to_account_info(),
            authority: self.creator.to_account_info(),
        };
        transfer_checked(
            CpiContext::new(self.token_program.to_account_info(), cpi),
            amount,
            self.mint.decimals,
        )?;
        Ok(())
    }

    pub fn init(
        &mut self,
        name: String,
        merkle_root: [u8; 32],
        start: i64,
        end: i64,
        cliff: u64,
        cliff_release_bps: u16,
        mint_to_distribute: Pubkey,
        is_transferable: bool,
        grace_period: u64,
        total_deposit: u64,
        // pub admin: Pubkey,
        // collection: Pubkey,
        uri: String,
        bumps: InitializeBumps,
    ) -> Result<()> {
        let campaign = Campaign {
            creator: self.creator.key(),
            merkle_root,
            start,
            end,
            cliff_duration: cliff,
            cliff_release_bps,
            mint_to_distribute,
            is_transferable,
            grace_period,
            total_deposit,
            collection: self.collection.key(),
            campaign_bump: bumps.campaign,
            collection_bump: bumps.collection,
            auth_bump: bumps.update_authority,
        };

        self.validate_campaign(&campaign)?;

        let collection_seeds = campaign.collection_signer_seeds();

        self.init_campaign_collection(name, uri, &[&collection_seeds])?;

        self.deposit_tokens(total_deposit)?;

        self.campaign.set_inner(campaign);

        Ok(())
    }
}
