use crate::{error::ErrorCode, leaf_hash, verify, Campaign, CAMPAIGN, UPDATE_AUTH};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};
use mpl_core::{instructions::CreateV2CpiBuilder, programs::MPL_CORE_ID};

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: empty + signer on first claim; existing asset on subsequent claims
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: using a pda instead of a client signer
    #[account(
        mut,
        constraint = collection.key() == campaign.collection @ ErrorCode::InvalidCollection
    )]
    pub collection: UncheckedAccount<'info>,

    /// CHECK: This account isnt initialized and is being used for signing purposed only, we verify that derives from the correct seed
    #[account(
        seeds=[UPDATE_AUTH, collection.key().as_ref()],
        bump= campaign.auth_bump
    )]
    pub update_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint= mint.key()== campaign.mint_to_distribute @ ErrorCode::InvalidMint
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint= mint,
        associated_token::authority= campaign,
        associated_token::token_program= associated_token_program
    )]
    pub campaign_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer= user,
        associated_token::mint= mint,
        associated_token::authority= user,
        associated_token::token_program= associated_token_program
    )]
    pub user_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [CAMPAIGN, collection.key().as_ref()],
        bump = campaign.campaign_bump,
    )]
    pub campaign: Account<'info, Campaign>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// CHECK: This is the ID of the MPL Core program
    #[account(address= MPL_CORE_ID)]
    pub mpl_core_program: UncheckedAccount<'info>,
}

impl<'info> Claim<'info> {
    pub fn mint_asset(&mut self) -> Result<()> {
        let signer_seeds = self.campaign.update_authority_signer_seeds();

        // need a way to have distinct name/uri per asset
        let name = "Vesting position";
        let uri = "https://example.com/";

        CreateV2CpiBuilder::new(&self.mpl_core_program.to_account_info())
            .asset(&self.asset.to_account_info())
            .collection(Some(&self.collection.to_account_info()))
            .authority(Some(&self.update_authority.to_account_info()))
            .payer(&self.user.to_account_info())
            .update_authority(None)
            .system_program(&self.system_program.to_account_info())
            .name(name.to_string())
            .uri(uri.to_string())
            .invoke_signed(&[&signer_seeds])?;

        Ok(())
    }

    pub fn verify_proofs(&mut self, proof: Vec<[u8; 33]>, allocation: u64) -> Result<()> {
        require!(!proof.is_empty(), ErrorCode::ProofsMissing);
        require!(allocation > 0, ErrorCode::InvalidAllocation);
        let leaf = leaf_hash(&self.user.key(), allocation);
        require!(
            verify(leaf, &proof, &self.campaign.merkle_root),
            ErrorCode::InvalidProofs
        );
        Ok(())
    }

    pub fn verify_ownership(&mut self) -> Result<()> {
        Ok(())
    }

    pub fn compute_and_transfer(&mut self) -> Result<()> {
        Ok(())
    }

    pub fn update_asset_attributes(&mut self) -> Result<()> {
        Ok(())
    }

    pub fn claim(&mut self, proofs: Vec<[u8; 33]>, allocation: u64) -> Result<()> {
        // 1st claim
        if self.asset.data_is_empty() {
            require!(self.asset.is_signer, ErrorCode::AssetMustSign);

            self.verify_proofs(proofs, allocation)?;
            self.mint_asset()?;
        } else {
            self.verify_ownership()?;
        }

        self.compute_and_transfer()?;
        self.update_asset_attributes()?;
        Ok(())
    }
}
