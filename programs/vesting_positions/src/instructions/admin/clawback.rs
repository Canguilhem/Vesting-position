use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};
use mpl_core::{accounts::BaseAssetV1, instructions::BurnV1CpiBuilder, programs::MPL_CORE_ID};

use crate::{
    constants::{ATTR_ALLOCATION, ATTR_CLAIMED, ATTR_ORIGINAL_RECIPIENT},
    error::ErrorCode,
    get_attr_pubkey, get_attr_u64, leaf_hash, load_attributes, require_asset_in_collection,
    require_vesting_position_attributes, verify, Campaign, ClaimReceipt, ClawbackEvent, ASSET,
    CAMPAIGN, CLAIM, UPDATE_AUTH,
};

/// Recovers unclaimed tokens from a live position
#[cfg_attr(
    not(target_os = "solana"),
    derive(anchor_litesvm::BundledPubkeys),
    bundled_with(crate::test_helpers::VestingBundle)
)]
#[derive(Accounts)]
pub struct Clawback<'info> {
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

impl<'info> Clawback<'info> {
    pub fn clawback(&mut self) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require_grace_period_over(&self.campaign, now)?;

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

/// Recovers the full allocation of a recipient who never claimed (no asset minted)
#[cfg_attr(
    not(target_os = "solana"),
    derive(anchor_litesvm::BundledPubkeys),
    bundled_with(crate::test_helpers::VestingBundle)
)]
#[derive(Accounts)]
#[instruction(original_recipient: Pubkey)]
pub struct ClawbackUnclaimed<'info> {
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
    #[account(constraint = collection.key() == campaign.collection @ ErrorCode::InvalidCollection)]
    pub collection: UncheckedAccount<'info>,

    /// `init_if_needed` rather than `init`: a buyer's subsequent claim creates
    /// a zeroed receipt for the signer, which would make `init` fail forever
    /// and strand this recipient's allocation. The handler still rejects any
    /// receipt with a non-default claimer (i.e. an actual first claim).
    #[account(
        init_if_needed,
        payer = creator,
        space = ClaimReceipt::DISCRIMINATOR.len() + ClaimReceipt::INIT_SPACE,
        seeds = [
            CLAIM,
            campaign.key().as_ref(),
            original_recipient.as_ref()
        ],
        bump
    )]
    pub claim_receipt: Account<'info, ClaimReceipt>,

    /// CHECK: must be the recipient's (empty) asset PDA — validated in handler
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
}

impl<'info> ClawbackUnclaimed<'info> {
    pub fn clawback_unclaimed(
        &mut self,
        original_recipient: Pubkey,
        allocation: u64,
        proofs: Vec<[u8; 33]>,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require_grace_period_over(&self.campaign, now)?;

        // A receipt with a real claimer means the recipient did a first claim;
        // the live-position `clawback` path applies instead.
        require!(
            self.claim_receipt.claimer == Pubkey::default(),
            ErrorCode::AlreadyClaimed
        );

        require!(!proofs.is_empty(), ErrorCode::ProofsMissing);
        require!(allocation > 0, ErrorCode::InvalidAllocation);
        let leaf = leaf_hash(&original_recipient, allocation);
        require!(
            verify(leaf, &proofs, &self.campaign.merkle_root),
            ErrorCode::InvalidProofs
        );

        // The asset account must be the recipient's PDA and still unminted,
        // otherwise the live-position `clawback` path applies.
        let (expected_asset, _) = Pubkey::find_program_address(
            &[
                ASSET,
                self.campaign.key().as_ref(),
                original_recipient.as_ref(),
            ],
            &crate::ID,
        );
        require_keys_eq!(self.asset.key(), expected_asset, ErrorCode::InvalidAsset);
        require!(self.asset.data_is_empty(), ErrorCode::AlreadyClaimed);

        // Block any future first claim by this recipient.
        self.claim_receipt.set_inner(ClaimReceipt {
            claimer: original_recipient,
            allocation,
            asset: Pubkey::default(),
        });

        transfer_to_creator(
            &self.token_program,
            &self.campaign_ata,
            &self.mint,
            &self.creator_ata,
            &self.campaign,
            allocation,
        )?;

        emit!(ClawbackEvent {
            campaign: self.campaign.key(),
            asset: Pubkey::default(),
            former_owner: original_recipient,
            original_recipient,
            amount_recovered: allocation,
            timestamp: now,
        });

        Ok(())
    }
}

/// Accounts shared by every "burn a live position and recover the unclaimed
/// remainder" flow (`clawback`, `exclude_asset`).
pub(crate) struct BurnPositionAccounts<'a, 'info> {
    pub campaign: &'a Account<'info, Campaign>,
    pub collection: &'a UncheckedAccount<'info>,
    pub update_authority: &'a UncheckedAccount<'info>,
    pub asset: &'a UncheckedAccount<'info>,
    pub mint: &'a InterfaceAccount<'info, Mint>,
    pub campaign_ata: &'a InterfaceAccount<'info, TokenAccount>,
    pub creator_ata: &'a InterfaceAccount<'info, TokenAccount>,
    pub payer: &'a Signer<'info>,
    pub token_program: &'a Interface<'info, TokenInterface>,
    pub system_program: &'a Program<'info, System>,
    pub mpl_core_program: &'a UncheckedAccount<'info>,
}

/// Validates a live vesting position, burns it, transfers the unclaimed
/// remainder to the creator and emits a `ClawbackEvent`.
pub(crate) fn burn_position_and_recover(accounts: BurnPositionAccounts) -> Result<()> {
    let BurnPositionAccounts {
        campaign,
        collection,
        update_authority,
        asset,
        mint,
        campaign_ata,
        creator_ata,
        payer,
        token_program,
        system_program,
        mpl_core_program,
    } = accounts;

    require_asset_in_collection(asset, &campaign.collection)?;
    let attrs = load_attributes(&asset.to_account_info())?.ok_or(ErrorCode::AttributesNotFound)?;
    require_vesting_position_attributes(&attrs, &campaign.key(), campaign)?;

    let claimed = get_attr_u64(&attrs, ATTR_CLAIMED)?;
    let allocation = get_attr_u64(&attrs, ATTR_ALLOCATION)?;
    require!(claimed < allocation, ErrorCode::AlreadyFullyClaimed);

    let original_recipient = get_attr_pubkey(&attrs, ATTR_ORIGINAL_RECIPIENT)?;
    let (expected_asset, _) = Pubkey::find_program_address(
        &[ASSET, campaign.key().as_ref(), original_recipient.as_ref()],
        &crate::ID,
    );
    require_keys_eq!(asset.key(), expected_asset, ErrorCode::InvalidAsset);

    let former_owner = BaseAssetV1::from_bytes(&asset.try_borrow_data()?)
        .map_err(|_| ErrorCode::InvalidAsset)?
        .owner;

    let auth_seeds = campaign.update_authority_signer_seeds();
    BurnV1CpiBuilder::new(&mpl_core_program.to_account_info())
        .asset(&asset.to_account_info())
        .collection(Some(&collection.to_account_info()))
        .payer(&payer.to_account_info())
        .authority(Some(&update_authority.to_account_info()))
        .system_program(Some(&system_program.to_account_info()))
        .invoke_signed(&[&auth_seeds])?;

    let amount = allocation - claimed;
    transfer_to_creator(
        token_program,
        campaign_ata,
        mint,
        creator_ata,
        campaign,
        amount,
    )?;

    emit!(ClawbackEvent {
        campaign: campaign.key(),
        asset: asset.key(),
        former_owner,
        original_recipient,
        amount_recovered: amount,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

fn require_grace_period_over(campaign: &Campaign, now: i64) -> Result<()> {
    let clawback_at = campaign
        .end
        .checked_add(campaign.grace_period as i64)
        .ok_or(ErrorCode::MathError)?;
    require!(now >= clawback_at, ErrorCode::GracePeriodNotOver);
    Ok(())
}

pub(crate) fn transfer_to_creator<'info>(
    token_program: &Interface<'info, TokenInterface>,
    campaign_ata: &InterfaceAccount<'info, TokenAccount>,
    mint: &InterfaceAccount<'info, Mint>,
    creator_ata: &InterfaceAccount<'info, TokenAccount>,
    campaign: &Account<'info, Campaign>,
    amount: u64,
) -> Result<()> {
    require!(
        campaign_ata.amount >= amount,
        ErrorCode::InsufficientVaultBalance
    );

    let seeds = campaign.signer_seeds();
    transfer_checked(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            TransferChecked {
                from: campaign_ata.to_account_info(),
                mint: mint.to_account_info(),
                to: creator_ata.to_account_info(),
                authority: campaign.to_account_info(),
            },
            &[&seeds],
        ),
        amount,
        mint.decimals,
    )?;
    Ok(())
}
