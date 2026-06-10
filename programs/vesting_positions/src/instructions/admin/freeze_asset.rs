use anchor_lang::prelude::*;
use mpl_core::{
    accounts::{BaseAssetV1, BaseCollectionV1},
    programs::MPL_CORE_ID,
};

use crate::{error::ErrorCode, Campaign, CAMPAIGN, COLLECTION, UPDATE_AUTH};

#[derive(Accounts)]
pub struct FreezeAsset<'info> {
    #[account(
        mut,
        constraint = creator.key() == campaign.creator @ ErrorCode::Unauthorized
    )]
    pub creator: Signer<'info>,

    #[account(
        seeds = [CAMPAIGN, collection.key().as_ref()],
        bump= campaign.campaign_bump,
        constraint = collection.key() == campaign.collection @ ErrorCode::InvalidCollection,
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(
        mut,
        seeds = [
            COLLECTION,
            campaign.creator.key().as_ref(),
            campaign.mint_to_distribute.as_ref(),
            campaign.merkle_root.as_ref()
        ],
        bump= campaign.collection_bump,
        constraint = collection.key() == campaign.collection @ ErrorCode::InvalidCollection,
    )]
    pub collection: Account<'info, BaseCollectionV1>,

    /// CHECK: This account isnt initialized and is being used for signing purposed only, we verify that derives from the correct seed
    #[account(
        seeds=[UPDATE_AUTH, collection.key().as_ref()],
        bump= campaign.auth_bump
    )]
    pub update_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = asset.owner == MPL_CORE_ID @ ErrorCode::InvalidAsset,
    )]
    pub asset: Account<'info, BaseAssetV1>,

    pub system_program: Program<'info, System>,

    /// CHECK: mpl-core program id
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,
}

impl<'info> FreezeAsset<'info> {}
