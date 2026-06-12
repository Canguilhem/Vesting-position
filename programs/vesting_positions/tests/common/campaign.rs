#![allow(dead_code)]

use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::{
    account_info::AccountInfo, instruction::Instruction, system_program,
};
use anchor_litesvm::{AnchorLiteSVM, Signer, TestHelpers, TransactionHelpers};
use mpl_core::{
    accounts::{BaseAssetV1, BaseCollectionV1},
    fetch_plugin,
    instructions::TransferV1Builder,
    types::{PermanentFreezeDelegate, PluginType},
};
use solana_sdk::{compute_budget::ComputeBudgetInstruction, signature::Keypair};
use vesting_positions::{
    compute_claimable, instruction, test_helpers::VestingBundle, Campaign, ClaimReceipt,
};

const PROGRAM_BYTES: &[u8] = include_bytes!("../../../../target/deploy/vesting_positions.so");
const MPL_CORE_BYTES: &[u8] = include_bytes!("../../../../tests/fixtures/mpl_core.so");

/// Solana default per-tx compute cap when no `ComputeBudget` ix is present.
pub const DEFAULT_TX_CU: u32 = 200_000;

/// Network max per-tx compute cap.
pub const MAX_TX_CU: u32 = 1_400_000;

/// Log consumed vs requested limit (run with `cargo test compute_units -- --nocapture`).
pub fn log_tx_cu(label: &str, consumed: u64, limit: u32) {
    let over_default = consumed > DEFAULT_TX_CU as u64;
    println!(
        "[CU] {label}: {consumed} consumed / {limit} limit (default cap {DEFAULT_TX_CU}){}",
        if over_default {
            " — exceeds default"
        } else {
            ""
        }
    );
}

use super::merkle::{default_merkle, MerkleTree, TOTAL_DEPOSIT};

pub const LAMPORTS: u64 = 10_000_000_000;

/// All parameters passed to `Initialize`. Override fields for custom timelines.
#[derive(Clone, Copy)]
pub struct CampaignConfig {
    /// Clock timestamp before initialize runs.
    pub now: i64,
    pub start: i64,
    pub end: i64,
    pub cliff_duration: u64,
    pub cliff_release_bps: u16,
    pub is_transferable: bool,
    pub grace_period: u64,
    pub total_deposit: u64,
}

impl Default for CampaignConfig {
    fn default() -> Self {
        let now: i64 = 1_700_000_000;
        let start = now + 86_400;
        Self {
            now,
            start,
            end: start + 86_400 * 30,
            cliff_duration: 86_400,
            cliff_release_bps: 1_000,
            is_transferable: true,
            grace_period: 604_800,
            total_deposit: TOTAL_DEPOSIT,
        }
    }
}

impl CampaignConfig {
    pub fn initialize_args(self, merkle_root: [u8; 32], mint: Pubkey) -> instruction::Initialize {
        instruction::Initialize {
            merkle_root,
            start: self.start,
            end: self.end,
            cliff_duration: self.cliff_duration,
            cliff_release_bps: self.cliff_release_bps,
            mint_to_distribute: mint,
            is_transferable: self.is_transferable,
            grace_period: self.grace_period,
            total_deposit: self.total_deposit,
            name: "Vesting campaign".to_string(),
            uri: "https://example.com/collection.json".to_string(),
        }
    }
}

pub struct TestCampaign {
    pub ctx: anchor_litesvm::AnchorContext,
    pub bundle: VestingBundle,
    pub creator: Keypair,
    pub now: i64,
    pub start: i64,
    pub end: i64,
    pub cliff_duration: u64,
    pub cliff_release_bps: u16,
    pub is_transferable: bool,
    pub grace_period: u64,
    pub total_deposit: u64,
}

impl TestCampaign {
    pub fn cliff_end(&self) -> i64 {
        self.start + self.cliff_duration as i64
    }

    pub fn campaign(&self) -> Campaign {
        self.ctx.get_account(&self.bundle.campaign).unwrap()
    }

    pub fn warp_to(&mut self, timestamp: i64) {
        self.ctx.svm.warp_to_timestamp(timestamp);
    }

    pub fn claimer_token_balance(&self, user: &Pubkey) -> u64 {
        let bundle = self.bundle.for_claimer(*user);
        self.ctx.svm.token_balance(&bundle.user_ata).unwrap_or(0)
    }

    pub fn expected_claimable(&self, now: i64, allocation: u64, claimed_so_far: u64) -> u64 {
        compute_claimable(&self.campaign(), now, allocation, claimed_so_far).unwrap()
    }

    /// Timestamp at `pct`% through the linear window (0 = cliff_end, 100 = end).
    pub fn linear_checkpoint(&self, pct: u64) -> i64 {
        assert!(pct <= 100);
        if pct == 100 {
            return self.end;
        }
        let window = (self.end - self.cliff_end()) as u64;
        self.cliff_end() + (window * pct / 100) as i64
    }

    pub fn asset_owner(&self, asset: &Pubkey) -> Pubkey {
        let account = self.ctx.svm.get_account(asset).expect("asset account");
        BaseAssetV1::from_bytes(&account.data)
            .expect("asset data")
            .owner
    }

    /// True when the account exists and deserializes as a live mpl-core asset.
    pub fn asset_is_valid_mpl_core(&self, asset: &Pubkey) -> bool {
        match self.ctx.svm.get_account(asset) {
            None => false,
            Some(account) if account.owner != mpl_core::ID => false,
            Some(account) => BaseAssetV1::from_bytes(&account.data).is_ok(),
        }
    }

    pub fn lamports(&self, address: &Pubkey) -> u64 {
        self.ctx
            .svm
            .get_account(address)
            .map(|a| a.lamports)
            .unwrap_or(0)
    }

    pub fn asset_has_freeze_delegate(&self, asset: &Pubkey) -> bool {
        self.try_fetch_asset_freeze_delegate(asset).is_some()
    }

    pub fn try_fetch_asset_freeze_delegate(
        &self,
        asset: &Pubkey,
    ) -> Option<PermanentFreezeDelegate> {
        let account = self.ctx.svm.get_account(asset).expect("asset account");
        let mut lamports = account.lamports;
        let mut data = account.data;
        let owner = account.owner;
        let account_info = AccountInfo::new(
            asset,
            false,
            false,
            &mut lamports,
            &mut data,
            &owner,
            false,
            0,
        );
        fetch_plugin::<BaseAssetV1, PermanentFreezeDelegate>(
            &account_info,
            PluginType::PermanentFreezeDelegate,
        )
        .ok()
        .map(|(_, delegate, _)| delegate)
    }

    pub fn fetch_permanent_freeze_delegate(&self, address: &Pubkey) -> PermanentFreezeDelegate {
        let account = self.ctx.svm.get_account(address).expect("account");
        let mut lamports = account.lamports;
        let mut data = account.data;
        let owner = account.owner;
        let account_info = AccountInfo::new(
            address,
            false,
            false,
            &mut lamports,
            &mut data,
            &owner,
            false,
            0,
        );
        if *address == self.bundle.collection {
            let (_, delegate, _) = fetch_plugin::<BaseCollectionV1, PermanentFreezeDelegate>(
                &account_info,
                PluginType::PermanentFreezeDelegate,
            )
            .expect("collection PermanentFreezeDelegate plugin");
            delegate
        } else {
            let (_, delegate, _) = fetch_plugin::<BaseAssetV1, PermanentFreezeDelegate>(
                &account_info,
                PluginType::PermanentFreezeDelegate,
            )
            .expect("asset PermanentFreezeDelegate plugin");
            delegate
        }
    }

    pub fn after_tx(&mut self) {
        self.ctx.svm.expire_blockhash();
    }

    pub fn transfer_asset_ix(&self, from: &Pubkey, to: &Pubkey, asset: &Pubkey) -> Instruction {
        TransferV1Builder::new()
            .asset(*asset)
            .collection(Some(self.bundle.collection))
            .payer(*from)
            .authority(Some(*from))
            .new_owner(*to)
            .system_program(Some(system_program::ID))
            .instruction()
    }

    /// First claim mints the position NFT (mpl-core CreateV2 CPI) and exceeds
    /// the default 200k CU cap. All other test txs use `ctx.tx()` without budget.
    /// Claims are gated to `[start, end + grace)`, so warp to `start` if the
    /// clock is still at campaign-setup time.
    pub fn first_claim_ok(&mut self, user: &Keypair, proofs: Vec<[u8; 33]>, allocation: u64) {
        if self.ctx.svm.get_unix_timestamp() < self.start {
            self.warp_to(self.start);
        }
        let bundle = self.bundle.for_claimer(user.pubkey());
        let budget_ix = ComputeBudgetInstruction::set_compute_unit_limit(MAX_TX_CU);
        let ix = self.ctx.program().build_ix(
            bundle,
            instruction::Claim {
                proofs: Some(proofs),
                allocation: Some(allocation),
            },
        );
        self.ctx
            .svm
            .send_instructions(&[budget_ix, ix], &[user])
            .expect("send_instructions failed")
            .with_aliases(self.ctx.aliases.clone())
            .assert_success();
        self.after_tx();
    }

    pub fn from_merkle(tree: &MerkleTree, config: CampaignConfig) -> Self {
        let mut world = Self::uninitialized(tree, config);
        let bundle = world.bundle;
        world
            .ctx
            .tx(&[&world.creator])
            .build(bundle, config.initialize_args(tree.root, bundle.mint))
            .send_ok();
        world.ctx.svm.expire_blockhash();
        world
    }

    /// Funded creator, mint, and bundle
    pub fn uninitialized(tree: &MerkleTree, config: CampaignConfig) -> Self {
        let mut ctx = build_ctx();

        ctx.svm.warp_to_timestamp(config.now);

        let creator = ctx.svm.create_funded_account(LAMPORTS).unwrap();
        let mint = ctx.svm.create_token_mint(&creator, 6).unwrap();
        let bundle = VestingBundle::init(creator.pubkey(), mint.pubkey(), &tree.root);

        ctx.svm
            .create_associated_token_account(&bundle.mint, &creator)
            .unwrap();
        ctx.svm
            .mint_to(
                &bundle.mint,
                &bundle.creator_ata,
                &creator,
                config.total_deposit,
            )
            .unwrap();

        Self {
            ctx,
            bundle,
            creator,
            now: config.now,
            start: config.start,
            end: config.end,
            cliff_duration: config.cliff_duration,
            cliff_release_bps: config.cliff_release_bps,
            is_transferable: config.is_transferable,
            grace_period: config.grace_period,
            total_deposit: config.total_deposit,
        }
    }

    pub fn warp_past_end(&mut self) {
        self.warp_to(self.end + 1);
    }

    pub fn warp_past_grace(&mut self) {
        self.warp_to(self.end + self.grace_period as i64 + 1);
    }

    pub fn creator_token_balance(&self) -> u64 {
        self.ctx
            .svm
            .token_balance(&self.bundle.creator_ata)
            .unwrap_or(0)
    }

    pub fn vault_balance(&self) -> u64 {
        self.ctx
            .svm
            .token_balance(&self.bundle.campaign_ata)
            .unwrap_or(0)
    }

    pub fn asset_for(&self, user: &Pubkey) -> Pubkey {
        self.bundle.for_claimer(*user).asset
    }
}

pub fn build_ctx() -> anchor_litesvm::AnchorContext {
    AnchorLiteSVM::build_with_programs(&[
        (vesting_positions::ID, "vesting_positions", PROGRAM_BYTES),
        (mpl_core::ID, "mpl_core", MPL_CORE_BYTES),
    ])
}

/// Default merkle fixture + initialized campaign.
/// Pass `None` for default [`CampaignConfig`].
pub fn setup(config: Option<CampaignConfig>) -> (MerkleTree, TestCampaign) {
    let merkle = default_merkle();
    let world = TestCampaign::from_merkle(&merkle, config.unwrap_or_default());
    (merkle, world)
}

pub fn transfer_changes_owner(
    world: &mut TestCampaign,
    from: &Keypair,
    to: &Pubkey,
    asset: &Pubkey,
) -> bool {
    let owner_before = world.asset_owner(asset);
    let ix = world.transfer_asset_ix(&from.pubkey(), to, asset);
    let _ = world
        .ctx
        .svm
        .send_instructions(&[ix], &[from])
        .expect("send_instructions failed")
        .with_aliases(world.ctx.aliases.clone());
    world.after_tx();
    world.asset_owner(asset) != owner_before
}

pub fn assert_receipt_set(world: &TestCampaign, user: &Pubkey, allocation: u64) {
    let bundle = world.bundle.for_claimer(*user);
    let receipt: ClaimReceipt = world.ctx.get_account(&bundle.claim_receipt).unwrap();
    assert_eq!(receipt.claimer, *user);
    assert_eq!(receipt.allocation, allocation);
    assert_eq!(receipt.asset, bundle.asset);
}
