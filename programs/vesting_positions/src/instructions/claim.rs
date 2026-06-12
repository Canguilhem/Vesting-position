use crate::{
    build_position_attributes, compute_claimable, error::ErrorCode, leaf_hash, load_attributes,
    verify, Campaign, ClaimEvent, ClaimReceipt, Position, ASSET, CAMPAIGN, CLAIM, UPDATE_AUTH,
};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};
use mpl_core::{
    accounts::{BaseAssetV1, BaseCollectionV1},
    fetch_plugin,
    instructions::{CreateV2CpiBuilder, UpdatePluginV1CpiBuilder},
    programs::MPL_CORE_ID,
    types::{
        Key as MplKey, PermanentBurnDelegate, PermanentFreezeDelegate, Plugin, PluginAuthority,
        PluginAuthorityPair, PluginType, UpdateAuthority,
    },
};

#[cfg_attr(
    not(target_os = "solana"), //1
    derive(anchor_litesvm::BundledPubkeys), //2
    bundled_with(crate::test_helpers::VestingBundle) //3
)]
#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

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
        constraint= mint.key()== campaign.mint_to_distribute @ ErrorCode::InvalidMint
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint= mint,
        associated_token::authority= campaign,
        associated_token::token_program= token_program
    )]
    pub campaign_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer= user,
        associated_token::mint= mint,
        associated_token::authority= user,
        associated_token::token_program= token_program
    )]
    pub user_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        seeds = [CAMPAIGN, collection.key().as_ref()],
        bump = campaign.campaign_bump,
    )]
    pub campaign: Account<'info, Campaign>,

    /// CHECK: position NFT — PDA `[asset, campaign, original_recipient]` on first claim;
    /// existing mpl-core asset (any owner) on subsequent claims
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer=user,
        space= ClaimReceipt::DISCRIMINATOR.len() + ClaimReceipt::INIT_SPACE,
        seeds=[
            CLAIM,
            campaign.key().as_ref(),
            user.key().as_ref()
        ],
        bump
    )]
    pub claim_receipt: Account<'info, ClaimReceipt>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// CHECK: This is the ID of the MPL Core program
    #[account(address= MPL_CORE_ID)]
    pub mpl_core_program: UncheckedAccount<'info>,
}

// Claim window [start, end + grace_period)
impl<'info> Claim<'info> {
    pub fn claim(&mut self, proofs: Option<Vec<[u8; 33]>>, allocation: Option<u64>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;

        require!(
            now >= self.campaign.start,
            ErrorCode::CampaignNotStarted
        );
        let window_end = self
            .campaign
            .end
            .checked_add(self.campaign.grace_period as i64)
            .ok_or(ErrorCode::MathError)?;
        require!(now < window_end, ErrorCode::ClaimWindowClosed);

        let is_first =
            self.claim_receipt.claimer == Pubkey::default() && self.asset.data_is_empty();

        if proofs.is_some() || allocation.is_some() {
            require!(is_first, ErrorCode::AlreadyClaimed);
        }

        self.authenticate(is_first, proofs, allocation)?;
        let state = self.get_position(is_first, allocation)?;

        if !is_first && state.claimed_so_far >= state.allocation {
            return Err(ErrorCode::AlreadyFullyClaimed.into());
        }

        let claimable =
            compute_claimable(&self.campaign, now, state.allocation, state.claimed_so_far)?;
        let new_claimed = state.claimed_so_far + claimable;

        self.sync_asset(is_first, &state, new_claimed, now)?;

        if claimable > 0 {
            self.transfer_tokens(claimable)?;
        }

        if new_claimed >= state.allocation && self.asset_has_freeze_plugin() {
            self.freeze_asset()?;
        }

        emit!(ClaimEvent {
            campaign: self.campaign.key(),
            asset: self.asset.key(),
            claimant: self.user.key(),
            original_recipient: state.original_recipient,
            amount: claimable,
            claimed_so_far: new_claimed,
            timestamp: now,
        });

        Ok(())
    }

    fn authenticate(
        &mut self,
        is_first: bool,
        proofs: Option<Vec<[u8; 33]>>,
        allocation: Option<u64>,
    ) -> Result<()> {
        if is_first {
            require!(self.asset.data_is_empty(), ErrorCode::AssetNotFound);
            self.verify_asset_pda()?;
            let proofs = proofs.ok_or(ErrorCode::ProofsMissing)?;
            let allocation = allocation.ok_or(ErrorCode::AllocationsMissing)?;
            self.verify_proofs(proofs, allocation)?;

            self.claim_receipt.set_inner(ClaimReceipt {
                claimer: self.user.key(),
                allocation,
                asset: self.asset.key(),
            });
        } else {
            self.verify_ownership()?;
        }
        Ok(())
    }

    fn get_position(&self, is_first: bool, allocation: Option<u64>) -> Result<Position> {
        if is_first {
            let allocation = allocation.ok_or(ErrorCode::AllocationsMissing)?;
            Ok(Position::new(allocation, self.user.key()))
        } else {
            let attrs = load_attributes(&self.asset)?.ok_or(ErrorCode::AttributesNotFound)?;
            Position::from_attributes(&attrs)
        }
    }

    fn sync_asset(
        &mut self,
        is_first: bool,
        state: &Position,
        new_claimed: u64,
        now: i64,
    ) -> Result<()> {
        if is_first {
            self.mint_asset(state.allocation, new_claimed, now, state.original_recipient)?;
        } else if new_claimed > state.claimed_so_far {
            self.update_asset_attributes(
                state.allocation,
                new_claimed,
                now,
                state.original_recipient,
            )?;
        }
        Ok(())
    }

    fn mint_asset(
        &mut self,
        allocation: u64,
        claimed_so_far: u64,
        now: i64,
        original_recipient: Pubkey,
    ) -> Result<()> {
        let auth_seeds = self.campaign.update_authority_signer_seeds();
        let campaign_key = self.campaign.key();
        let user_key = self.user.key();
        let (_, asset_bump) = Pubkey::find_program_address(
            &[ASSET, campaign_key.as_ref(), user_key.as_ref()],
            &crate::ID,
        );
        let asset_bump_bytes = [asset_bump];
        let asset_seeds = [
            ASSET,
            campaign_key.as_ref(),
            user_key.as_ref(),
            asset_bump_bytes.as_ref(),
        ];
        let mint = self.campaign.mint_to_distribute;

        let mut plugins = vec![PluginAuthorityPair {
            plugin: Plugin::Attributes(build_position_attributes(
                allocation,
                claimed_so_far,
                now,
                &campaign_key,
                &original_recipient,
                &mint,
            )),
            authority: Some(PluginAuthority::UpdateAuthority),
        }];

        if self.campaign.is_transferable {
            plugins.push(PluginAuthorityPair {
                plugin: Plugin::PermanentFreezeDelegate(PermanentFreezeDelegate { frozen: false }),
                authority: Some(PluginAuthority::UpdateAuthority),
            });
        }

        plugins.push(PluginAuthorityPair {
            plugin: Plugin::PermanentBurnDelegate(PermanentBurnDelegate {}),
            authority: Some(PluginAuthority::UpdateAuthority),
        });

        // Position metadata mirrors the collection set at initialize.
        // Scoped so the data borrow is released before the CPI below.
        let (name, uri) = {
            let data = self.collection.try_borrow_data()?;
            let collection = BaseCollectionV1::from_bytes(&data)
                .map_err(|_| ErrorCode::InvalidCollection)?;
            (collection.name, collection.uri)
        };

        CreateV2CpiBuilder::new(&self.mpl_core_program.to_account_info())
            .asset(&self.asset.to_account_info())
            .collection(Some(&self.collection.to_account_info()))
            .authority(Some(&self.update_authority.to_account_info()))
            .payer(&self.user.to_account_info())
            .owner(Some(&self.user.to_account_info()))
            .update_authority(None)
            .system_program(&self.system_program.to_account_info())
            .name(name)
            .uri(uri)
            .plugins(plugins)
            .invoke_signed(&[&asset_seeds, &auth_seeds])?;

        Ok(())
    }

    fn verify_asset_pda(&self) -> Result<()> {
        let (expected, _) = Pubkey::find_program_address(
            &[
                ASSET,
                self.campaign.key().as_ref(),
                self.user.key().as_ref(),
            ],
            &crate::ID,
        );
        require_keys_eq!(self.asset.key(), expected, ErrorCode::InvalidAsset);
        Ok(())
    }

    fn verify_proofs(&self, proof: Vec<[u8; 33]>, allocation: u64) -> Result<()> {
        require!(!proof.is_empty(), ErrorCode::ProofsMissing);
        require!(allocation > 0, ErrorCode::InvalidAllocation);
        let leaf = leaf_hash(&self.user.key(), allocation);
        require!(
            verify(leaf, &proof, &self.campaign.merkle_root),
            ErrorCode::InvalidProofs
        );
        Ok(())
    }

    fn verify_ownership(&self) -> Result<()> {
        require!(!self.asset.data_is_empty(), ErrorCode::AssetNotFound);
        require!(self.asset.owner == &MPL_CORE_ID, ErrorCode::InvalidAsset);

        let asset = BaseAssetV1::from_bytes(&self.asset.try_borrow_data()?)
            .map_err(|_| ErrorCode::InvalidAsset)?;

        require!(asset.key == MplKey::AssetV1, ErrorCode::InvalidAsset);
        require!(asset.owner == self.user.key(), ErrorCode::NotAssetOwner);

        match asset.update_authority {
            UpdateAuthority::Collection(addr) => {
                require!(
                    addr == self.campaign.collection,
                    ErrorCode::InvalidCollection
                );
            }
            _ => return Err(ErrorCode::InvalidCollection.into()),
        }

        Ok(())
    }

    fn transfer_tokens(&self, amount: u64) -> Result<()> {
        require!(
            self.campaign_ata.amount >= amount,
            ErrorCode::InsufficientVaultBalance
        );

        let seeds = self.campaign.signer_seeds();
        transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                TransferChecked {
                    from: self.campaign_ata.to_account_info(),
                    mint: self.mint.to_account_info(),
                    to: self.user_ata.to_account_info(),
                    authority: self.campaign.to_account_info(),
                },
                &[&seeds],
            ),
            amount,
            self.mint.decimals,
        )?;
        Ok(())
    }

    fn update_asset_attributes(
        &mut self,
        allocation: u64,
        claimed_so_far: u64,
        now: i64,
        original_recipient: Pubkey,
    ) -> Result<()> {
        let auth_seeds = self.campaign.update_authority_signer_seeds();
        let campaign_key = self.campaign.key();
        let mint = self.campaign.mint_to_distribute;

        UpdatePluginV1CpiBuilder::new(&self.mpl_core_program.to_account_info())
            .asset(&self.asset.to_account_info())
            .collection(Some(&self.collection.to_account_info()))
            .payer(&self.user.to_account_info())
            .authority(Some(&self.update_authority.to_account_info()))
            .system_program(&self.system_program.to_account_info())
            .plugin(Plugin::Attributes(build_position_attributes(
                allocation,
                claimed_so_far,
                now,
                &campaign_key,
                &original_recipient,
                &mint,
            )))
            .invoke_signed(&[&auth_seeds])?;
        Ok(())
    }

    fn asset_has_freeze_plugin(&self) -> bool {
        fetch_plugin::<BaseAssetV1, PermanentFreezeDelegate>(
            &self.asset.to_account_info(),
            PluginType::PermanentFreezeDelegate,
        )
        .is_ok()
    }

    fn freeze_asset(&mut self) -> Result<()> {
        let auth_seeds = self.campaign.update_authority_signer_seeds();
        UpdatePluginV1CpiBuilder::new(&self.mpl_core_program.to_account_info())
            .asset(&self.asset.to_account_info())
            .collection(Some(&self.collection.to_account_info()))
            .payer(&self.user.to_account_info())
            .authority(Some(&self.update_authority.to_account_info()))
            .system_program(&self.system_program.to_account_info())
            .plugin(Plugin::PermanentFreezeDelegate(PermanentFreezeDelegate {
                frozen: true,
            }))
            .invoke_signed(&[&auth_seeds])?;
        Ok(())
    }
}
