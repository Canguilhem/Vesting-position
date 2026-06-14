mod common;

use anchor_litesvm::TestHelpers;
use solana_sdk::{compute_budget::ComputeBudgetInstruction, signer::Signer};
use vesting_positions::{instruction, test_helpers::VestingBundle};

use common::{
    build_ctx, default_merkle, fund_keypair, load_whitelist_user, log_tx_cu, DEFAULT_TX_CU,
    FIRST_CLAIM_CU, LAMPORTS, WHITELISTED_1,
};

#[test]
fn compute_units_profile() {
    let merkle = default_merkle();
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);
    let proofs = alice.proofs.clone();
    let allocation = alice.allocation;

    let mut ctx = build_ctx();
    let now: i64 = 1_700_000_000;
    let start = now + 86_400;
    let end = start + 86_400 * 30;
    ctx.svm.warp_to_timestamp(now);

    let creator = ctx.svm.create_funded_account(LAMPORTS).unwrap();
    let mint = ctx.svm.create_token_mint(&creator, 6).unwrap();
    let base = VestingBundle::init(creator.pubkey(), mint.pubkey(), &merkle.root);

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

    let init_ix = ctx.program().build_ix(
        base,
        instruction::Initialize {
            merkle_root: merkle.root,
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

    fund_keypair(&mut ctx, &alice.keypair, LAMPORTS);
    let claim_bundle = base.for_claimer(alice.keypair.pubkey());

    // First claim at start: mints NFT, zero tokens released (before cliff).
    ctx.svm.warp_to_timestamp(start);
    let first_mint_ix = ctx.program().build_ix(
        claim_bundle,
        instruction::Claim {
            proofs: Some(proofs.clone()),
            allocation: Some(allocation),
            name: "Test asset".to_string(),
            uri: "https://example.com".to_string(),
        },
    );
    let first_mint = ctx
        .execute_instructions(vec![first_mint_ix], &[&alice.keypair])
        .expect("first claim (mint only)")
        .assert_success();
    log_tx_cu("first_claim (mint only)", first_mint.compute_units(), DEFAULT_TX_CU);
    ctx.svm.expire_blockhash();

    // First claim at end: full allocation + loyalty-badge freeze (heaviest path).
    let mut ctx2 = build_ctx();
    ctx2.svm.warp_to_timestamp(now);
    let creator2 = ctx2.svm.create_funded_account(LAMPORTS).unwrap();
    let mint2 = ctx2.svm.create_token_mint(&creator2, 6).unwrap();
    let base2 = VestingBundle::init(creator2.pubkey(), mint2.pubkey(), &merkle.root);
    ctx2.svm
        .create_associated_token_account(&base2.mint, &creator2)
        .unwrap();
    ctx2.svm
        .mint_to(
            &base2.mint,
            &base2.creator_ata,
            &creator2,
            common::TOTAL_DEPOSIT,
        )
        .unwrap();
    let init2_ix = ctx2.program().build_ix(
        base2,
        instruction::Initialize {
            merkle_root: merkle.root,
            start,
            end,
            cliff_duration: 86_400,
            cliff_release_bps: 1_000,
            mint_to_distribute: base2.mint,
            is_transferable: true,
            grace_period: 604_800,
            total_deposit: common::TOTAL_DEPOSIT,
            name: "Vesting campaign".to_string(),
            uri: "https://example.com/collection.json".to_string(),
        },
    );
    ctx2.execute_instructions(vec![init2_ix], &[&creator2])
        .expect("initialize 2")
        .assert_success();
    ctx2.svm.expire_blockhash();
    fund_keypair(&mut ctx2, &alice.keypair, LAMPORTS);
    ctx2.svm.warp_to_timestamp(end + 1);
    let full_bundle = base2.for_claimer(alice.keypair.pubkey());
    let full_ix = ctx2.program().build_ix(
        full_bundle,
        instruction::Claim {
            proofs: Some(proofs),
            allocation: Some(allocation),
            name: "Test asset".to_string(),
            uri: "https://example.com".to_string(),
        },
    );
    let budget_ix = ComputeBudgetInstruction::set_compute_unit_limit(FIRST_CLAIM_CU);
    let first_full = ctx2
        .execute_instructions(vec![budget_ix, full_ix], &[&alice.keypair])
        .expect("first claim (full allocation)")
        .assert_success();
    log_tx_cu(
        "first_claim (full allocation)",
        first_full.compute_units(),
        FIRST_CLAIM_CU,
    );
    assert!(
        first_full.compute_units() <= FIRST_CLAIM_CU as u64,
        "first claim (full allocation) exceeds FIRST_CLAIM_CU"
    );

    let sub_ix = ctx.program().build_ix(
        claim_bundle,
        instruction::Claim {
            proofs: None,
            allocation: None,
            name: "Test asset".to_string(),
            uri: "https://example.com".to_string(),
        },
    );
    let sub = ctx
        .execute_instructions(vec![sub_ix], &[&alice.keypair])
        .expect("subsequent claim")
        .assert_success();
    log_tx_cu("subsequent_claim", sub.compute_units(), DEFAULT_TX_CU);

    assert!(
        init.compute_units() <= DEFAULT_TX_CU as u64,
        "initialize exceeds default cap"
    );
    assert!(
        first_mint.compute_units() <= DEFAULT_TX_CU as u64,
        "first claim (mint only) exceeds default cap"
    );
    assert!(
        sub.compute_units() <= DEFAULT_TX_CU as u64,
        "subsequent claim exceeds default cap"
    );
}
