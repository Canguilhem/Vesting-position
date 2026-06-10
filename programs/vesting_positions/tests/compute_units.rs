//! Rough compute-unit profile for SDK budget hints.
//!
//! Run: `cargo test -p vesting_positions compute_units -- --nocapture`

mod common;

use anchor_litesvm::TestHelpers;
use solana_sdk::compute_budget::ComputeBudgetInstruction;
use solana_sdk::signer::Signer;
use vesting_positions::{instruction, test_helpers::VestingBundle};

use common::{
    default_fixture, fund_keypair, load_whitelist_user, log_tx_cu, DEFAULT_TX_CU, LAMPORTS,
    MAX_TX_CU, WHITELISTED_1, setup,
};

#[test]
fn compute_units_profile() {
    let fixture = default_fixture();
    let alice = load_whitelist_user(&fixture, WHITELISTED_1);
    let proofs = alice.proofs.clone();
    let allocation = alice.allocation;

    let mut ctx = setup();
    let now: i64 = 1_700_000_000;
    let start = now - 86_400;
    let end = now + 86_400 * 30;
    ctx.svm.warp_to_timestamp(now);

    let creator = ctx.svm.create_funded_account(LAMPORTS).unwrap();
    let mint = ctx.svm.create_token_mint(&creator, 6).unwrap();
    let base = VestingBundle::init(creator.pubkey(), mint.pubkey(), &fixture.root);

    ctx.svm
        .create_associated_token_account(&base.mint, &creator)
        .unwrap();
    ctx.svm
        .mint_to(
            &base.mint,
            &base.creator_ata,
            &creator,
            common::TOTAL_DEPOSIT,
        )
        .unwrap();

    // --- initialize (no compute budget ix) ---
    let init_ix = ctx.program().build_ix(
        base,
        instruction::Initialize {
            merkle_root: fixture.root,
            start,
            end,
            cliff_duration: 86_400,
            cliff_release_bps: 1_000,
            mint_to_distribute: base.mint,
            is_transferable: true,
            grace_period: 604_800,
            total_deposit: common::TOTAL_DEPOSIT,
            name: "Vesting campaign".to_string(),
            uri: "https://example.com/collection.json".to_string(),
        },
    );
    let init = ctx
        .execute_instructions(vec![init_ix], &[&creator])
        .expect("initialize")
        .assert_success();
    log_tx_cu("initialize", init.compute_units(), DEFAULT_TX_CU);
    ctx.svm.expire_blockhash();

    // --- first claim ---
    fund_keypair(&mut ctx, &alice.keypair, LAMPORTS);
    let claim_bundle = base.for_claimer(alice.keypair.pubkey());
    let first_ix = ctx.program().build_ix(
        claim_bundle,
        instruction::Claim {
            proofs: Some(proofs),
            allocation: Some(allocation),
        },
    );
    let budget_ix = ComputeBudgetInstruction::set_compute_unit_limit(MAX_TX_CU);
    let first = ctx
        .execute_instructions(vec![budget_ix, first_ix], &[&alice.keypair])
        .expect("first claim")
        .assert_success();
    log_tx_cu("first_claim", first.compute_units(), MAX_TX_CU);
    ctx.svm.expire_blockhash();

    // --- subsequent claim at default 200k cap ---
    let sub_ix = ctx.program().build_ix(
        claim_bundle,
        instruction::Claim {
            proofs: None,
            allocation: None,
        },
    );
    match ctx.execute_instructions(vec![sub_ix], &[&alice.keypair]) {
        Ok(result) => {
            log_tx_cu("subsequent_claim (default cap)", result.compute_units(), DEFAULT_TX_CU);
            result.assert_success();
        }
        Err(err) => println!("[CU] subsequent_claim (default cap): tx failed — {err}"),
    }
    ctx.svm.expire_blockhash();

    // --- subsequent claim with explicit max cap (same path, fresh blockhash) ---
    let sub_ix = ctx.program().build_ix(
        claim_bundle,
        instruction::Claim {
            proofs: None,
            allocation: None,
        },
    );
    let budget_ix = ComputeBudgetInstruction::set_compute_unit_limit(MAX_TX_CU);
    let sub = ctx
        .execute_instructions(vec![budget_ix, sub_ix], &[&alice.keypair])
        .expect("subsequent claim")
        .assert_success();
    log_tx_cu("subsequent_claim (max cap)", sub.compute_units(), MAX_TX_CU);

    println!(
        "\nSDK hint: setComputeUnitLimit({}) for first claim; subsequent likely fits in {}",
        first.compute_units() * 110 / 100,
        DEFAULT_TX_CU,
    );
}
