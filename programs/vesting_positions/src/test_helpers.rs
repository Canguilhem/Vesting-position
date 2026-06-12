use anchor_lang::prelude::Pubkey;
use anchor_litesvm::AliasMirror;
use anchor_spl::associated_token::get_associated_token_address;

use crate::{ASSET, CAMPAIGN, CLAIM, COLLECTION, UPDATE_AUTH};

// ---------- PDA + ATA derivation (shared with tests) ----------
/// `Collection` PDA: `[COLLECTION, creator, mint, merkle_root]` (initialize.rs).
pub fn collection_pda(creator: &Pubkey, mint: &Pubkey, merkle_root: &[u8; 32]) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            COLLECTION,
            creator.as_ref(),
            mint.as_ref(),
            merkle_root.as_ref(),
        ],
        &crate::ID,
    )
}

/// Update-authority PDA: `[UPDATE_AUTH, collection]` (initialize.rs).
pub fn update_authority_pda(collection: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[UPDATE_AUTH, collection.as_ref()], &crate::ID)
}

/// Campaign PDA: `[CAMPAIGN, collection]` (initialize.rs).
pub fn campaign_pda(collection: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[CAMPAIGN, collection.as_ref()], &crate::ID)
}

/// Claim receipt PDA: `[CLAIM, campaign, user]` (claim.rs).
pub fn receipt_pda(campaign: &Pubkey, user: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[CLAIM, campaign.as_ref(), user.as_ref()], &crate::ID)
}

/// Position asset PDA: `[ASSET, campaign, user]` (claim.rs).
pub fn asset_pda(campaign: &Pubkey, user: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[ASSET, campaign.as_ref(), user.as_ref()], &crate::ID)
}

/// Associated token address (the `init_if_needed` rewards ATA in unstake.rs).
pub fn ata(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    get_associated_token_address(owner, mint)
}

#[derive(Copy, Clone, Debug, AliasMirror)]
pub struct VestingBundle {
    // Signer roles
    pub creator: Pubkey,
    pub user: Pubkey,

    // External
    pub mint: Pubkey,

    // Program PDAs
    pub update_authority: Pubkey,
    pub campaign: Pubkey,
    pub collection: Pubkey, // also becomes MPL Core Collection after init
    pub claim_receipt: Pubkey,

    // MPL Core Accounts
    pub asset: Pubkey,

    // Token Accounts
    pub campaign_ata: Pubkey,
    pub user_ata: Pubkey,
    pub creator_ata: Pubkey,

    // Programs not auto-injected by the derive (it recognises only
    // Program<System>, Program<AssociatedToken>, Interface<TokenInterface>).
    pub mpl_core_program: Pubkey,
}

impl Default for VestingBundle {
    fn default() -> Self {
        Self {
            creator: Pubkey::new_unique(),
            user: Pubkey::new_unique(),
            claim_receipt: Pubkey::new_unique(),
            update_authority: Pubkey::new_unique(),
            campaign: Pubkey::new_unique(),
            mint: Pubkey::new_unique(),
            collection: Pubkey::new_unique(),
            asset: Pubkey::new_unique(),
            campaign_ata: Pubkey::new_unique(),
            user_ata: Pubkey::new_unique(),
            creator_ata: Pubkey::new_unique(),
            mpl_core_program: mpl_core::ID,
        }
    }
}

impl VestingBundle {
    pub fn init(creator: Pubkey, mint: Pubkey, merkle_root: &[u8; 32]) -> Self {
        let (collection, _) = collection_pda(&creator, &mint, merkle_root);
        let (update_authority, _) = update_authority_pda(&collection);
        let (campaign, _) = campaign_pda(&collection);

        Self {
            creator,
            mint,
            update_authority,
            campaign,
            collection,
            campaign_ata: ata(&campaign, &mint),
            creator_ata: ata(&creator, &mint),

            ..Self::default()
        }
    }

    pub fn for_claimer(self, user: Pubkey) -> Self {
        let (claim_receipt, _) = receipt_pda(&self.campaign, &user);
        let (asset, _) = asset_pda(&self.campaign, &user);
        Self {
            user,
            claim_receipt,
            user_ata: ata(&user, &self.mint),
            asset,
            ..self
        }
    }

    pub fn with_asset(self, asset: Pubkey) -> Self {
        Self { asset, ..self }
    }

    /// Swap in a different creator (for unauthorized-signer tests).
    pub fn with_creator(self, creator: Pubkey) -> Self {
        Self {
            creator,
            creator_ata: ata(&creator, &self.mint),
            ..self
        }
    }
}

impl anchor_litesvm::Resolvable for VestingBundle {
    fn resolve_all(&mut self, _ctx: &anchor_litesvm::AnchorContext) {}
}
