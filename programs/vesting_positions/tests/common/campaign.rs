use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::{instruction::Instruction, system_program};
use anchor_litesvm::{AnchorLiteSVM, Signer, TestHelpers};
use mpl_core::instructions::TransferV1Builder;
use solana_sdk::signature::Keypair;
use vesting_positions::{instruction, test_helpers::VestingBundle, ClaimReceipt};

const PROGRAM_BYTES: &[u8] = include_bytes!("../../../../target/deploy/vesting_positions.so");
const MPL_CORE_BYTES: &[u8] = include_bytes!("../../../../tests/fixtures/mpl_core.so");

/// Solana default per-tx compute cap when no `ComputeBudget` ix is present.
pub const DEFAULT_TX_CU: u32 = 200_000;

/// Network max per-tx compute cap.
pub const MAX_TX_CU: u32 = 1_400_000;

/// First claim CPIs into mpl-core `CreateV2` — default 200k CU is not enough.
const COMPUTE_UNITS: u32 = MAX_TX_CU;

/// Log consumed vs requested limit (run with `cargo test compute_units -- --nocapture`).
pub fn log_tx_cu(label: &str, consumed: u64, limit: u32) {
    let over_default = consumed > DEFAULT_TX_CU as u64;
    println!(
        "[CU] {label}: {consumed} consumed / {limit} limit (default cap {DEFAULT_TX_CU}){}",
        if over_default { " — exceeds default" } else { "" }
    );
}

use super::merkle::{MerkleTree, TOTAL_DEPOSIT};

pub const LAMPORTS: u64 = 10_000_000_000;

pub struct MockCampaign {
    pub ctx: anchor_litesvm::AnchorContext,
    pub base: VestingBundle,
    pub _creator: Keypair,
    pub end: i64,
}

pub fn setup() -> anchor_litesvm::AnchorContext {
    AnchorLiteSVM::build_with_programs(&[
        (vesting_positions::ID, "vesting_positions", PROGRAM_BYTES),
        (mpl_core::ID, "mpl_core", MPL_CORE_BYTES),
    ])
}

fn send_ix(campaign: &mut MockCampaign, ix: Instruction, signers: &[&Keypair]) {
    use solana_sdk::compute_budget::ComputeBudgetInstruction;

    let budget_ix = ComputeBudgetInstruction::set_compute_unit_limit(COMPUTE_UNITS);
    campaign.ctx
        .execute_instructions(vec![budget_ix, ix], signers)
        .expect("execute instructions")
        .assert_success();
    campaign.ctx.svm.expire_blockhash();
}

fn send_ix_expect_err(
    campaign: &mut MockCampaign,
    ix: Instruction,
    signers: &[&Keypair],
    error_name: &str,
) {
    use solana_sdk::compute_budget::ComputeBudgetInstruction;

    let budget_ix = ComputeBudgetInstruction::set_compute_unit_limit(COMPUTE_UNITS);
    campaign.ctx
        .execute_instructions(vec![budget_ix, ix], signers)
        .expect("execute instructions")
        .assert_error(error_name);
    campaign.ctx.svm.expire_blockhash();
}

impl MockCampaign {
    pub fn from_merkle(tree: &MerkleTree) -> Self {
        Self::new(tree.root, TOTAL_DEPOSIT)
    }

    pub fn new(merkle_root: [u8; 32], total_deposit: u64) -> Self {
        let mut ctx = setup();

        let now: i64 = 1_700_000_000;
        let start = now - 86_400;
        let end = now + 86_400 * 30;
        ctx.svm.warp_to_timestamp(now);

        let creator = ctx.svm.create_funded_account(LAMPORTS).unwrap();
        let mint = ctx.svm.create_token_mint(&creator, 6).unwrap();
        let base = VestingBundle::init(creator.pubkey(), mint.pubkey(), &merkle_root);

        ctx.svm
            .create_associated_token_account(&base.mint, &creator)
            .unwrap();
        ctx.svm
            .mint_to(&base.mint, &base.creator_ata, &creator, total_deposit)
            .unwrap();

        let ix = ctx.program().build_ix(
            base,
            instruction::Initialize {
                merkle_root,
                start,
                end,
                cliff_duration: 86_400,
                cliff_release_bps: 1_000,
                mint_to_distribute: base.mint,
                is_transferable: true,
                grace_period: 604_800,
                total_deposit,
                name: "Vesting campaign".to_string(),
                uri: "https://example.com/collection.json".to_string(),
            },
        );
        ctx
            .execute_instructions(vec![ix], &[&creator])
            .expect("initialize")
            .assert_success();
        ctx.svm.expire_blockhash();

        Self {
            ctx,
            base,
            _creator: creator,
            end,
        }
    }

    pub fn warp_past_end(&mut self) {
        self.ctx.svm.warp_to_timestamp(self.end + 1);
    }

    pub fn asset_for(&self, user: &Pubkey) -> Pubkey {
        self.base.for_claimer(*user).asset
    }
}

fn build_first_claim_ix(
    campaign: &MockCampaign,
    user: &Keypair,
    proofs: Vec<[u8; 33]>,
    allocation: u64,
) -> Instruction {
    let bundle = campaign.base.for_claimer(user.pubkey());
    campaign.ctx.program().build_ix(
        bundle,
        instruction::Claim {
            proofs: Some(proofs),
            allocation: Some(allocation),
        },
    )
}

pub fn first_claim(
    campaign: &mut MockCampaign,
    user: &Keypair,
    proofs: Vec<[u8; 33]>,
    allocation: u64,
) {
    let ix = build_first_claim_ix(campaign, user, proofs, allocation);
    send_ix(campaign, ix, &[user]);
}

pub fn subsequent_claim(f: &mut MockCampaign, user: &Keypair, asset: &Pubkey) {
    let bundle = f.base.for_claimer(user.pubkey()).with_asset(*asset);
    let ix = f.ctx.program().build_ix(
        bundle,
        instruction::Claim {
            proofs: None,
            allocation: None,
        },
    );
    send_ix(f, ix, &[user]);
}

pub fn transfer_position(
    f: &mut MockCampaign,
    from: &Keypair,
    to: &Pubkey,
    asset: &Pubkey,
) {
    let ix = TransferV1Builder::new()
        .asset(*asset)
        .collection(Some(f.base.collection))
        .payer(from.pubkey())
        .authority(Some(from.pubkey()))
        .new_owner(*to)
        .system_program(Some(system_program::ID))
        .instruction();
    send_ix(f, ix, &[from]);
}

pub fn expect_first_claim_fails(
    f: &mut MockCampaign,
    user: &Keypair,
    proofs: Vec<[u8; 33]>,
    allocation: u64,
    error_name: &str,
) {
    let ix = build_first_claim_ix(f, user, proofs, allocation);
    send_ix_expect_err(f, ix, &[user], error_name);
}

pub fn expect_subsequent_claim_fails(
    f: &mut MockCampaign,
    user: &Keypair,
    asset: &Pubkey,
    error_name: &str,
) {
    let bundle = f.base.for_claimer(user.pubkey()).with_asset(*asset);
    let ix = f.ctx.program().build_ix(
        bundle,
        instruction::Claim {
            proofs: None,
            allocation: None,
        },
    );
    send_ix_expect_err(f, ix, &[user], error_name);
}

pub fn assert_receipt_set(f: &MockCampaign, user: &Pubkey, allocation: u64) {
    let bundle = f.base.for_claimer(*user);
    let receipt: ClaimReceipt = f.ctx.get_account(&bundle.claim_receipt).unwrap();
    assert_eq!(receipt.claimer, *user);
    assert_eq!(receipt.allocation, allocation);
    assert_eq!(receipt.asset, bundle.asset);
}
