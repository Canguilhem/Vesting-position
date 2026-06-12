use anchor_lang::prelude::*;
use mpl_core::{
    accounts::BaseAssetV1,
    fetch_plugin,
    instructions::UpdatePluginV1CpiBuilder,
    programs::MPL_CORE_ID,
    types::{PermanentFreezeDelegate, Plugin, PluginType},
};

use crate::{
    error::ErrorCode, require_asset_in_collection, Campaign, FreezeEvent, CAMPAIGN, UPDATE_AUTH,
};

/// Per-asset transfer pause. mpl-core resolves asset-level plugins over
/// collection-level ones, so on transferable campaigns (where every position
/// is minted with `PermanentFreezeDelegate { frozen: false }`) a collection
/// freeze alone cannot stop transfers — this instruction can, one position at
/// a time, without burning it.
///
/// Positions on non-transferable campaigns are minted without the plugin
/// (the collection-level freeze governs them) and are rejected here.
#[cfg_attr(
    not(target_os = "solana"),
    derive(anchor_litesvm::BundledPubkeys),
    bundled_with(crate::test_helpers::VestingBundle)
)]
#[derive(Accounts)]
pub struct FreezeAsset<'info> {
    #[account(
        mut,
        constraint = creator.key() == campaign.creator @ ErrorCode::Unauthorized
    )]
    pub creator: Signer<'info>,

    #[account(
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

    /// CHECK: update-authority PDA for collection CPI signing
    #[account(
        seeds = [UPDATE_AUTH, collection.key().as_ref()],
        bump = campaign.auth_bump,
    )]
    pub update_authority: UncheckedAccount<'info>,

    /// CHECK: mpl-core asset validated in handler
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: mpl-core program id
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: UncheckedAccount<'info>,
}

impl<'info> FreezeAsset<'info> {
    pub fn toggle_freeze(&self, should_freeze: bool) -> Result<()> {
        require_asset_in_collection(&self.asset, &self.campaign.collection)?;

        // Permanent plugins can only be added at mint, so an asset without the
        // delegate (non-transferable campaign) cannot be frozen individually.
        require!(
            fetch_plugin::<BaseAssetV1, PermanentFreezeDelegate>(
                &self.asset.to_account_info(),
                PluginType::PermanentFreezeDelegate,
            )
            .is_ok(),
            ErrorCode::FreezePluginMissing
        );

        let auth_seeds = self.campaign.update_authority_signer_seeds();
        UpdatePluginV1CpiBuilder::new(&self.mpl_core_program.to_account_info())
            .asset(&self.asset.to_account_info())
            .collection(Some(&self.collection.to_account_info()))
            .payer(&self.creator.to_account_info())
            .authority(Some(&self.update_authority.to_account_info()))
            .system_program(&self.system_program.to_account_info())
            .plugin(Plugin::PermanentFreezeDelegate(PermanentFreezeDelegate {
                frozen: should_freeze,
            }))
            .invoke_signed(&[&auth_seeds])?;

        emit!(FreezeEvent {
            campaign: self.campaign.key(),
            target: self.asset.key(),
            frozen: should_freeze,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
