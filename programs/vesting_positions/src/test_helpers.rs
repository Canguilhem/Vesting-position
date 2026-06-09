use anchor_lang::prelude::Pubkey;
use anchor_litesvm::AliasMirror;
use anchor_spl::associated_token::get_associated_token_address;


// ---------- PDA + ATA derivation (shared with tests) ----------
//
// Seeds mirror the `#[account(seeds = ...)]` constraints in instructions/*.rs;
// the program spells them as byte literals inline, so these helpers are the
// one test-side place that has to stay in sync with them.

/// `Collection` PDA: `[b"collection", creator, mint, merkle_root]` (initialize.rs).
pub fn collection_pda(creator: &Pubkey, mint: &Pubkey, merkle_root: &[u8; 32]) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"collection", creator.as_ref(), mint.as_ref(), merkle_root.as_ref()], &crate::ID)
}

/// Update-authority PDA: `[b"update_authority", collection]`
/// (create_collection.rs; the program signs mpl-core CPIs with it).
pub fn update_authority_pda(collection: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"update_authority", collection.as_ref()], &crate::ID)
}

/// Campaign PDA: `[b"campaign", collection]` (initialize.rs).
pub fn campaign_pda(collection: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"campaign", collection.as_ref()], &crate::ID)
}

/// Associated token address (the `init_if_needed` rewards ATA in unstake.rs).
pub fn ata(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    get_associated_token_address(owner, mint)
}


#[derive(Copy,Clone,Debug,AliasMirror)]
pub struct VestingBundle {
    // Signer roles 
    pub creator:Pubkey,
    pub user:Pubkey,

    // External
    pub mint:Pubkey,

    // Program PDAs
    pub update_authority: Pubkey,
    pub campaign: Pubkey,
    pub collection: Pubkey, // also becomes MPL Core Collection after init

    // MPL Core Accounts
    pub asset: Pubkey,

    // Token Accounts
    pub campaign_ata:Pubkey,
    pub user_ata:Pubkey,
    pub creator_ata: Pubkey,
    
    // Programs not auto-injected by the derive (it recognises only
    // Program<System>, Program<AssociatedToken>, Interface<TokenInterface>).
    pub mpl_core_program: Pubkey,

}

impl Default for VestingBundle{
    fn default()-> Self{
        Self { 
            creator: Pubkey::new_unique(),
            user: Pubkey::new_unique(),
            update_authority: Pubkey::new_unique(),
            campaign: Pubkey::new_unique(),
            mint: Pubkey::new_unique(),
            collection: Pubkey::new_unique(),
            asset: Pubkey::new_unique(),
            campaign_ata: Pubkey::new_unique(),
            user_ata:Pubkey::new_unique(),
            creator_ata: Pubkey::new_unique(),
            mpl_core_program: mpl_core::ID,
        }
    }
}

impl VestingBundle {
    pub fn init(creator:Pubkey, mint: Pubkey , merkle_root: &[u8; 32])-> Self {  
        
        let (collection,_)= collection_pda(&creator, &mint, merkle_root);
        let (update_authority,_)= update_authority_pda(&collection);
        let (campaign,_)= campaign_pda(&collection);
        
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


}