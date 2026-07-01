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

use anchor_litesvm::{AssertionHelpers, Signer};
use vesting_positions::{instruction, leaf_hash, verify};

use common::{
    assert_receipt_set, fund_keypair, load_keypair, load_whitelist_user, random_proofs, setup,
    LAMPORTS, MOCK_ALLOC, NOT_WHITELISTED, WHITELISTED_1, WHITELISTED_2,
};

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

/// Scenario 1: Alice mints her position, then claims vested tokens again.
#[test]
fn scenario_1_alice_first_and_subsequent_claim() {
    let (merkle, mut world) = setup(None);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);

    assert!(verify(
        leaf_hash(&alice.keypair.pubkey(), alice.allocation),
        &alice.proofs,
        &merkle.root,
    ));

    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);

    let asset = world.asset_for(&alice.keypair.pubkey());
    world.first_claim_ok(&alice.keypair, alice.proofs.clone(), alice.allocation);
    world.ctx.svm.assert_account_exists(&asset);
    assert_receipt_set(&world, &alice.keypair.pubkey());

    let sub_bundle = world
        .bundle
        .for_claimer(alice.keypair.pubkey())
        .with_asset(asset);
    world
        .ctx
        .tx(&[&alice.keypair])
        .build(
            sub_bundle,
            instruction::Claim {
                proofs: None,
                allocation: None,
                name: "Test asset".to_string(),
                uri: "https://example.com".to_string(),
            },
        )
        .send_ok();
    world.after_tx();
}

/// Scenario 2: Alice & Bob each mint; Bob claims both after buying Alice's position.
#[test]
fn scenario_2_two_users_transfer_and_bob_claims_both() {
    let (merkle, mut world) = setup(None);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);
    let bob = load_whitelist_user(&merkle, WHITELISTED_2);

    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);
    fund_keypair(&mut world.ctx, &bob.keypair, LAMPORTS);

    let asset_alice = world.asset_for(&alice.keypair.pubkey());
    let asset_bob = world.asset_for(&bob.keypair.pubkey());

    world.first_claim_ok(&alice.keypair, alice.proofs, alice.allocation);
    world.first_claim_ok(&bob.keypair, bob.proofs, bob.allocation);

    let transfer_ix =
        world.transfer_asset_ix(&alice.keypair.pubkey(), &bob.keypair.pubkey(), &asset_alice);
    world.ctx.tx(&[&alice.keypair]).ix(transfer_ix).send_ok();
    world.after_tx();

    let bob_claim_alice = world
        .bundle
        .for_claimer(bob.keypair.pubkey())
        .with_asset(asset_alice);
    world
        .ctx
        .tx(&[&bob.keypair])
        .build(
            bob_claim_alice,
            instruction::Claim {
                proofs: None,
                allocation: None,
                name: "Test asset".to_string(),
                uri: "https://example.com".to_string(),
            },
        )
        .send_ok();
    world.after_tx();

    let bob_claim_bob = world
        .bundle
        .for_claimer(bob.keypair.pubkey())
        .with_asset(asset_bob);
    world
        .ctx
        .tx(&[&bob.keypair])
        .build(
            bob_claim_bob,
            instruction::Claim {
                proofs: None,
                allocation: None,
                name: "Test asset".to_string(),
                uri: "https://example.com".to_string(),
            },
        )
        .send_ok();
    world.after_tx();
}

/// Scenario 3: Alice → Bob → Alice buyback; Alice claims again on the same NFT.
#[test]
fn scenario_3_buyback_alice_claims_again() {
    let (merkle, mut world) = setup(None);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);
    let bob = load_whitelist_user(&merkle, WHITELISTED_2);

    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);
    fund_keypair(&mut world.ctx, &bob.keypair, LAMPORTS);

    let asset = world.asset_for(&alice.keypair.pubkey());
    world.first_claim_ok(&alice.keypair, alice.proofs, alice.allocation);

    let alice_sub = world
        .bundle
        .for_claimer(alice.keypair.pubkey())
        .with_asset(asset);
    world
        .ctx
        .tx(&[&alice.keypair])
        .build(
            alice_sub,
            instruction::Claim {
                proofs: None,
                allocation: None,
                name: "Test asset".to_string(),
                uri: "https://example.com".to_string(),
            },
        )
        .send_ok();
    world.after_tx();

    let alice_to_bob =
        world.transfer_asset_ix(&alice.keypair.pubkey(), &bob.keypair.pubkey(), &asset);
    world.ctx.tx(&[&alice.keypair]).ix(alice_to_bob).send_ok();
    world.after_tx();

    let bob_sub = world
        .bundle
        .for_claimer(bob.keypair.pubkey())
        .with_asset(asset);
    world
        .ctx
        .tx(&[&bob.keypair])
        .build(
            bob_sub,
            instruction::Claim {
                proofs: None,
                allocation: None,
                name: "Test asset".to_string(),
                uri: "https://example.com".to_string(),
            },
        )
        .send_ok();
    world.after_tx();

    let bob_to_alice =
        world.transfer_asset_ix(&bob.keypair.pubkey(), &alice.keypair.pubkey(), &asset);
    world.ctx.tx(&[&bob.keypair]).ix(bob_to_alice).send_ok();
    world.after_tx();

    let alice_sub_2 = world
        .bundle
        .for_claimer(alice.keypair.pubkey())
        .with_asset(asset);
    world
        .ctx
        .tx(&[&alice.keypair])
        .build(
            alice_sub_2,
            instruction::Claim {
                proofs: None,
                allocation: None,
                name: "Test asset".to_string(),
                uri: "https://example.com".to_string(),
            },
        )
        .send_ok();
    world.after_tx();
}

// ---------------------------------------------------------------------------
// Error path
// ---------------------------------------------------------------------------

/// Scenario 4: Replay first claim with same proofs → AlreadyClaimed.
#[test]
fn scenario_4_replay_first_claim_fails() {
    let (merkle, mut world) = setup(None);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);
    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);

    world.first_claim_ok(&alice.keypair, alice.proofs.clone(), alice.allocation);

    let replay = world.bundle.for_claimer(alice.keypair.pubkey());
    world
        .ctx
        .tx(&[&alice.keypair])
        .build(
            replay,
            instruction::Claim {
                proofs: Some(alice.proofs),
                allocation: Some(alice.allocation),
                name: "Test asset".to_string(),
                uri: "https://example.com".to_string(),
            },
        )
        .send_err_named("AlreadyClaimed");
    world.after_tx();
}

/// Scenario 5: Carol (not whitelisted) cannot first-claim.
#[test]
fn scenario_5_unwhitelisted_user_fails() {
    let (_merkle, mut world) = setup(None);
    let carol = load_keypair(NOT_WHITELISTED);
    fund_keypair(&mut world.ctx, &carol, LAMPORTS);
    world.warp_to(world.start);

    let bundle = world.bundle.for_claimer(carol.pubkey());
    world
        .ctx
        .tx(&[&carol])
        .build(
            bundle,
            instruction::Claim {
                proofs: Some(random_proofs()),
                allocation: Some(MOCK_ALLOC),
                name: "Test asset".to_string(),
                uri: "https://example.com".to_string(),
            },
        )
        .send_err_named("InvalidProofs");
    world.after_tx();
}

/// Scenario 6: Alice cannot subsequent-claim on Bob's NFT.
#[test]
fn scenario_6_not_owner_subsequent_claim_fails() {
    let (merkle, mut world) = setup(None);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);
    let bob = load_whitelist_user(&merkle, WHITELISTED_2);

    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);
    fund_keypair(&mut world.ctx, &bob.keypair, LAMPORTS);

    let asset_bob = world.asset_for(&bob.keypair.pubkey());
    world.first_claim_ok(&bob.keypair, bob.proofs, bob.allocation);

    let bundle = world
        .bundle
        .for_claimer(alice.keypair.pubkey())
        .with_asset(asset_bob);
    world
        .ctx
        .tx(&[&alice.keypair])
        .build(
            bundle,
            instruction::Claim {
                proofs: None,
                allocation: None,
                name: "Test asset".to_string(),
                uri: "https://example.com".to_string(),
            },
        )
        .send_err_named("NotAssetOwner");
    world.after_tx();
}

/// Scenario 7: Fully claimed position → AlreadyFullyClaimed.
#[test]
fn scenario_7_fully_claimed_position_frozen() {
    let (merkle, mut world) = setup(None);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);
    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);

    let asset = world.asset_for(&alice.keypair.pubkey());
    world.first_claim_ok(&alice.keypair, alice.proofs, alice.allocation);
    assert!(
        !world.fetch_permanent_freeze_delegate(&asset).frozen,
        "position must stay transferable until fully claimed"
    );

    world.warp_past_end();
    let sub_bundle = world
        .bundle
        .for_claimer(alice.keypair.pubkey())
        .with_asset(asset);
    world
        .ctx
        .tx(&[&alice.keypair])
        .build(
            sub_bundle,
            instruction::Claim {
                proofs: None,
                allocation: None,
                name: "Test asset".to_string(),
                uri: "https://example.com".to_string(),
            },
        )
        .send_ok();
    world.after_tx();

    assert_eq!(
        world.claimer_token_balance(&alice.keypair.pubkey()),
        alice.allocation
    );
    assert!(
        world.fetch_permanent_freeze_delegate(&asset).frozen,
        "loyalty badge must be permanently frozen after full claim"
    );

    let replay = world
        .bundle
        .for_claimer(alice.keypair.pubkey())
        .with_asset(asset);
    world
        .ctx
        .tx(&[&alice.keypair])
        .build(
            replay,
            instruction::Claim {
                proofs: None,
                allocation: None,
                name: "Test asset".to_string(),
                uri: "https://example.com".to_string(),
            },
        )
        .send_err_named("AlreadyFullyClaimed");
    world.after_tx();
}

/// Scenario 8: Subsequent claim with wrong asset address → InvalidAsset.
#[test]
fn scenario_8_wrong_asset_subsequent_claim_fails() {
    use anchor_lang::prelude::Pubkey;

    let (_merkle, mut world) = setup(None);
    let bob = load_keypair(NOT_WHITELISTED);
    fund_keypair(&mut world.ctx, &bob, LAMPORTS);
    world.warp_to(world.start);

    let ghost_asset = Pubkey::new_unique();
    let bundle = world
        .bundle
        .for_claimer(bob.pubkey())
        .with_asset(ghost_asset);
    world
        .ctx
        .tx(&[&bob])
        .build(
            bundle,
            instruction::Claim {
                proofs: None,
                allocation: None,
                name: "Test asset".to_string(),
                uri: "https://example.com".to_string(),
            },
        )
        .send_err_named("InvalidAsset");
    world.after_tx();
}

/// Scenario 10: No claims before `start`, even with valid proofs.
#[test]
fn scenario_10_claim_before_start_fails() {
    let (merkle, mut world) = setup(None);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);
    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);

    // Clock is still at campaign-setup time (before start).
    world
        .ctx
        .tx(&[&alice.keypair])
        .build(
            world.bundle.for_claimer(alice.keypair.pubkey()),
            instruction::Claim {
                proofs: Some(alice.proofs.clone()),
                allocation: Some(alice.allocation),
                name: "Test asset".to_string(),
                uri: "https://example.com".to_string(),
            },
        )
        .send_err_named("CampaignNotStarted");
    world.after_tx();
}

/// Scenario 9: Claim works until the last second of the grace window, then
/// closes with ClaimWindowClosed (clawback takes over from there).
#[test]
fn scenario_9_claim_window_closes_after_grace() {
    let (merkle, mut world) = setup(None);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);
    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);

    let asset = world.asset_for(&alice.keypair.pubkey());
    world.first_claim_ok(&alice.keypair, alice.proofs.clone(), alice.allocation);

    // Last moment inside the window → full allocation still claimable.
    world.warp_to(world.end + world.grace_period as i64 - 1);
    let sub = world
        .bundle
        .for_claimer(alice.keypair.pubkey())
        .with_asset(asset);
    world
        .ctx
        .tx(&[&alice.keypair])
        .build(
            sub,
            instruction::Claim {
                proofs: None,
                allocation: None,
                name: "Test asset".to_string(),
                uri: "https://example.com".to_string(),
            },
        )
        .send_ok();
    world.after_tx();
    assert_eq!(
        world.claimer_token_balance(&alice.keypair.pubkey()),
        alice.allocation
    );

    // At end + grace_period the window is closed, even for a first claim.
    let bob = load_whitelist_user(&merkle, WHITELISTED_2);
    fund_keypair(&mut world.ctx, &bob.keypair, LAMPORTS);
    world.warp_to(world.end + world.grace_period as i64);
    world
        .ctx
        .tx(&[&bob.keypair])
        .build(
            world.bundle.for_claimer(bob.keypair.pubkey()),
            instruction::Claim {
                proofs: Some(bob.proofs.clone()),
                allocation: Some(bob.allocation),
                name: "Test asset".to_string(),
                uri: "https://example.com".to_string(),
            },
        )
        .send_err_named("ClaimWindowClosed");
    world.after_tx();
}