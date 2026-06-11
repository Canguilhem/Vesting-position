//! Claim integration tests.
//!
//! Definitions:
//!   nft_position / asset  — mpl-core position NFT (PDA: `[asset, campaign, user]` on first claim)
//!   vested_tokens         — `compute_claimable()` output per claim
//!
//! First claim:  signers = [user], proofs = Some(...), allocation = Some(...)
//! Subsequent:   signers = [user], proofs = None,      allocation = None
//!

mod common;

use anchor_litesvm::AssertionHelpers;
use solana_sdk::signer::Signer;
use vesting_positions::{leaf_hash, verify};

use common::{
    assert_receipt_set, expect_first_claim_fails, expect_subsequent_claim_fails, first_claim,
    fund_keypair, load_keypair, load_whitelist_user, random_proofs, subsequent_claim,
    transfer_position, TestCampaign, MOCK_ALLOC, LAMPORTS, NOT_WHITELISTED, WHITELISTED_1,
    WHITELISTED_2, default_merkle,
};

fn setup() -> (common::MerkleTree, TestCampaign) {
    let merkle = default_merkle();
    let f = TestCampaign::from_merkle(&merkle);
    (merkle, f)
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

/// Scenario 1: Alice mints her position, then claims vested tokens again.
#[test]
fn scenario_1_alice_first_and_subsequent_claim() {
    let (merkle, mut f) = setup();
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);

    assert!(verify(
        leaf_hash(&alice.keypair.pubkey(), alice.allocation),
        &alice.proofs,
        &merkle.root,
    ));

    fund_keypair(&mut f.ctx, &alice.keypair, LAMPORTS);

    let asset = f.asset_for(&alice.keypair.pubkey());
    first_claim(
        &mut f,
        &alice.keypair,
        alice.proofs.clone(),
        alice.allocation,
    );
    f.ctx.svm.assert_account_exists(&asset);
    assert_receipt_set(&f, &alice.keypair.pubkey(), alice.allocation);

    subsequent_claim(&mut f, &alice.keypair, &asset);
}

/// Scenario 2: Alice & Bob each mint; Bob claims both after buying Alice's position.
#[test]
fn scenario_2_two_users_transfer_and_bob_claims_both() {
    let (merkle, mut f) = setup();
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);
    let bob = load_whitelist_user(&merkle, WHITELISTED_2);

    fund_keypair(&mut f.ctx, &alice.keypair, LAMPORTS);
    fund_keypair(&mut f.ctx, &bob.keypair, LAMPORTS);

    let asset_alice = f.asset_for(&alice.keypair.pubkey());
    let asset_bob = f.asset_for(&bob.keypair.pubkey());

    first_claim(&mut f, &alice.keypair, alice.proofs, alice.allocation);
    first_claim(&mut f, &bob.keypair, bob.proofs, bob.allocation);

    transfer_position(&mut f, &alice.keypair, &bob.keypair.pubkey(), &asset_alice);

    subsequent_claim(&mut f, &bob.keypair, &asset_alice);
    subsequent_claim(&mut f, &bob.keypair, &asset_bob);
}

/// Scenario 3: Alice → Bob → Alice buyback; Alice claims again on the same NFT.
#[test]
fn scenario_3_buyback_alice_claims_again() {
    let (merkle, mut f) = setup();
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);
    let bob = load_whitelist_user(&merkle, WHITELISTED_2);

    fund_keypair(&mut f.ctx, &alice.keypair, LAMPORTS);
    fund_keypair(&mut f.ctx, &bob.keypair, LAMPORTS);

    let asset = f.asset_for(&alice.keypair.pubkey());
    first_claim(
        &mut f,
        &alice.keypair,
        alice.proofs,
        alice.allocation,
    );
    subsequent_claim(&mut f, &alice.keypair, &asset);

    transfer_position(&mut f, &alice.keypair, &bob.keypair.pubkey(), &asset);
    subsequent_claim(&mut f, &bob.keypair, &asset);

    transfer_position(&mut f, &bob.keypair, &alice.keypair.pubkey(), &asset);
    subsequent_claim(&mut f, &alice.keypair, &asset);
}

// ---------------------------------------------------------------------------
// Error path
// ---------------------------------------------------------------------------

/// Scenario 4: Replay first claim with same proofs → AlreadyClaimed.
#[test]
fn scenario_4_replay_first_claim_fails() {
    let (merkle, mut f) = setup();
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);
    fund_keypair(&mut f.ctx, &alice.keypair, LAMPORTS);

    first_claim(
        &mut f,
        &alice.keypair,
        alice.proofs.clone(),
        alice.allocation,
    );

    expect_first_claim_fails(
        &mut f,
        &alice.keypair,
        alice.proofs,
        alice.allocation,
        "AlreadyClaimed",
    );
}

/// Scenario 5: Carol (not whitelisted) cannot first-claim.
#[test]
fn scenario_5_unwhitelisted_user_fails() {
    let (_merkle, mut f) = setup();
    let carol = load_keypair(NOT_WHITELISTED);
    fund_keypair(&mut f.ctx, &carol, LAMPORTS);

    expect_first_claim_fails(
        &mut f,
        &carol,
        random_proofs(),
        MOCK_ALLOC,
        "InvalidProofs",
    );
}

/// Scenario 6: Alice cannot subsequent-claim on Bob's NFT.
#[test]
fn scenario_6_not_owner_subsequent_claim_fails() {
    let (merkle, mut f) = setup();
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);
    let bob = load_whitelist_user(&merkle, WHITELISTED_2);

    fund_keypair(&mut f.ctx, &alice.keypair, LAMPORTS);
    fund_keypair(&mut f.ctx, &bob.keypair, LAMPORTS);

    let asset_bob = f.asset_for(&bob.keypair.pubkey());
    first_claim(
        &mut f,
        &bob.keypair,
        bob.proofs,
        bob.allocation,
    );

    expect_subsequent_claim_fails(
        &mut f,
        &alice.keypair,
        &asset_bob,
        "NotAssetOwner",
    );
}

/// Scenario 7: Fully claimed position → AlreadyFullyClaimed.
#[test]
fn scenario_7_fully_claimed_position_frozen() {
    let (merkle, mut f) = setup();
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);
    fund_keypair(&mut f.ctx, &alice.keypair, LAMPORTS);

    let asset = f.asset_for(&alice.keypair.pubkey());
    first_claim(
        &mut f,
        &alice.keypair,
        alice.proofs,
        alice.allocation,
    );
    assert!(
        !f.permanent_freeze_delegate(&asset).frozen,
        "position must stay transferable until fully claimed"
    );

    f.warp_past_end();
    subsequent_claim(&mut f, &alice.keypair, &asset);

    assert_eq!(f.claimer_token_balance(&alice.keypair.pubkey()), alice.allocation);
    assert!(
        f.permanent_freeze_delegate(&asset).frozen,
        "loyalty badge must be permanently frozen after full claim"
    );

    expect_subsequent_claim_fails(
        &mut f,
        &alice.keypair,
        &asset,
        "AlreadyFullyClaimed",
    );
}

/// Scenario 8: Subsequent claim with wrong asset address → InvalidAsset.
#[test]
fn scenario_8_wrong_asset_subsequent_claim_fails() {
    use anchor_lang::prelude::Pubkey;

    let (_merkle, mut f) = setup();
    let bob = load_keypair(NOT_WHITELISTED);
    fund_keypair(&mut f.ctx, &bob, LAMPORTS);

    let ghost_asset = Pubkey::new_unique();
    expect_subsequent_claim_fails(&mut f, &bob, &ghost_asset, "InvalidAsset");
}
