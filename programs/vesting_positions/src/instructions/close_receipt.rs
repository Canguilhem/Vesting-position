use anchor_lang::prelude::*;

use crate::{error::ErrorCode, ClaimReceipt, CLAIM};

/// Reclaims the rent of a `ClaimReceipt` once the campaign is over.
///
/// Receipts must outlive the claim/clawback flows (they block double first
/// claims and gate `clawback_unclaimed`), so closing is only allowed after the
/// Campaign PDA itself was closed (`close_campaign` / `cancel_campaign`).
/// The receipt seeds bind it to the campaign key, so an empty `campaign`
/// account proves the campaign no longer exists.
#[cfg_attr(
    not(target_os = "solana"),
    derive(anchor_litesvm::BundledPubkeys),
    bundled_with(crate::test_helpers::VestingBundle)
)]
#[derive(Accounts)]
pub struct CloseReceipt<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: only checked for emptiness — a live campaign always has data
    pub campaign: UncheckedAccount<'info>,

    #[account(
        mut,
        close = user,
        seeds = [CLAIM, campaign.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub claim_receipt: Account<'info, ClaimReceipt>,
}

impl<'info> CloseReceipt<'info> {
    pub fn close(&self) -> Result<()> {
        require!(
            self.campaign.data_is_empty(),
            ErrorCode::CampaignStillActive
        );
        Ok(())
    }
}
