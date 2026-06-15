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

use anchor_litesvm::{AssertionHelpers, Report, Signer, md_kv, md_table};
use mpl_core;
use vesting_positions::{instruction, leaf_hash, verify, Campaign};

use common::{
    assert_receipt_set, fund_keypair, load_keypair, load_whitelist_user, random_proofs, setup,
    LAMPORTS, MOCK_ALLOC, NOT_WHITELISTED, WHITELISTED_1, WHITELISTED_2,
};

use crate::common::{CampaignConfig, TOTAL_DEPOSIT};

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

#[test]
fn full_lifecycle() {

    let mut md = Report::new(
        "Full vesting lifecycle",
        "demonstrate whole vesting life cycle include position transfers",
    );

    let (merkle, mut world) = setup(None);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);
    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);
    let bob = load_keypair(NOT_WHITELISTED);
    fund_keypair(&mut world.ctx, &bob, LAMPORTS);

    world.ctx.alias(alice.keypair.pubkey(), "Alice");
    world.ctx.alias(bob.pubkey(), "Bob");
    world.ctx.alias(world.bundle.creator, "campaign creator");
    // Name the campaign PDA too: it's the `campaign:` field every decoded event
    // carries, so without this it leaks raw (run-varying) base58 into the report
    // and the snapshot stops being byte-reproducible.
    world.ctx.alias(world.bundle.campaign, "Campaign");
    world.ctx.alias(vesting_positions::ID, "vesting_positions");
    world.ctx.alias(mpl_core::ID, "mpl_core");

    md.block(
        "actors pubkeys",
        md_kv! {
            "campaign creator"       => world.bundle.creator,
            "alice"       => alice.keypair.pubkey(),
            "bob"       => bob.pubkey(),
        },
    );

    let campaign: Campaign = world.campaign();
    let config = CampaignConfig::default();

    md.step("Campaign initialized");
    md.block(
        "initialization checks",
        md_kv! {
            "creator match"       => campaign.creator == world.bundle.creator,
            "schedule match"      => campaign.start == config.start
                && campaign.end == config.end
                && campaign.cliff_duration == config.cliff_duration
                && campaign.cliff_release_bps == config.cliff_release_bps
                && campaign.grace_period == config.grace_period,
            "merkle root match"   => campaign.merkle_root == merkle.root,
            "total deposit match" => campaign.total_deposit == TOTAL_DEPOSIT,
        },
    );
    md.check(
        "campaign creator match",
        campaign.creator == world.bundle.creator,
        true,
    );
    md.check(
        "campaign schedule match",
        campaign.start == config.start
            && campaign.end == config.end
            && campaign.cliff_duration == config.cliff_duration
            && campaign.cliff_release_bps == config.cliff_release_bps
            && campaign.grace_period == config.grace_period,
        true,
    );
    md.check(
        "merkle root and deposit match",
        campaign.merkle_root == merkle.root && campaign.total_deposit == TOTAL_DEPOSIT,
        true,
    );
    md.block("campaign settings", md_kv! {
        "creator"              => world.ctx.label(&campaign.creator),
        "start (unix)"         => campaign.start,
        "end (unix)"           => campaign.end,
        "grace period (sec)"   => campaign.grace_period,
        "cliff duration (sec)" => campaign.cliff_duration,
        "cliff release (bps)"  => campaign.cliff_release_bps,
        "total deposit"        => campaign.total_deposit,
        "transferable"         => campaign.is_transferable,
    });
    md.block("campaign schedule", md_table! {
        "field", "value";
        "start", campaign.start;
        "end",   campaign.end;
        "grace", campaign.grace_period;
    });

    md.step("Alice first claim");
    world.warp_to(world.cliff_end());
    let asset = world.asset_for(&alice.keypair.pubkey());
    world.ctx.alias(asset, "Position NFT (minted by Alice)");
    world.ctx.alias(campaign.collection, "NFT Collection for this campaign");

    md.block("Collection & Asset", md_kv! {
        world.ctx.label(&asset) => asset,
        world.ctx.label(&campaign.collection) => campaign.collection
    });

    let cliff_amount = world.expected_claimable(world.cliff_end(), alice.allocation, 0);
    md.block("first claim", md_kv! {
        "claimant"         => world.ctx.label(&alice.keypair.pubkey()),
        "whitelisted"      => true,
        "auth"             => "merkle proofs + allocation",
        "timestamp (unix)" => world.cliff_end(),
        "allocation"       => alice.allocation,
        "expected release" => cliff_amount,
    });
    let first_claim =
        world.first_claim_ok(&alice.keypair, alice.proofs.clone(), alice.allocation);
    world.record_execution("Act 1 — alice first claim", &first_claim);
    md.check("position nft exists", true, world.ctx.account_exists(&asset));
    md.check(
        "position nft owner is alice",
        alice.keypair.pubkey(),
        world.asset_owner(&asset),
    );
    assert_receipt_set(&world, &alice.keypair.pubkey());
    md.check(
        format!("cliff release credited ({}%)", campaign.cliff_release_bps / 100),
        cliff_amount,
        world.claimer_token_balance(&alice.keypair.pubkey()),
    );

    md.step("Alice subsequent claim");
    let mid = world.linear_checkpoint(50);
    world.warp_to(mid);
    let balance_before = world.claimer_token_balance(&alice.keypair.pubkey());
    let expected_mid = world.expected_claimable(mid, alice.allocation, balance_before);
    md.block("subsequent claim", md_kv! {
        "claimant"           => world.ctx.label(&alice.keypair.pubkey()),
        "auth"               => "position NFT (no proofs)",
        "asset" => world.ctx.label(&asset),
        "linear %"           => 50,
        "timestamp (unix)"   => mid,
        "balance before"     => balance_before,
        "incremental release"=> expected_mid,
    });
    let sub_bundle = world
        .bundle
        .for_claimer(alice.keypair.pubkey())
        .with_asset(asset);
    let sub_claim = world
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
    world.record_execution("Act 2 — alice subsequent claim", &sub_claim);
    world.after_tx();
    md.check(
        "additional vesting credited",
        balance_before + expected_mid,
        world.claimer_token_balance(&alice.keypair.pubkey()),
    );

    md.step("NFT transfer to Bob");
    md.block("transfer", md_kv! {
        "from"          => world.ctx.label(&alice.keypair.pubkey()),
        "to"            => world.ctx.label(&bob.pubkey()),
        "recipient whitelisted" => false,
        "asset"         => world.ctx.label(&asset),
    });
    let transfer_ix =
        world.transfer_asset_ix(&alice.keypair.pubkey(), &bob.pubkey(), &asset);
    world.ctx.tx(&[&alice.keypair]).ix(transfer_ix).send_ok();
    world.after_tx();
    md.check(
        "position nft owner is bob",
        bob.pubkey(),
        world.asset_owner(&asset),
    );

    md.step("Merkle replay rejected");
    md.block("attack", md_kv! {
        "vector"         => "first claim with valid merkle proofs after transfer",
        "goal"           => "mint a second NFT / reclaim allocation (infinite money trick)",
        "alice owns nft" => false,
        "expected error" => "AlreadyClaimed",
    });
    md.check(
        "alice no longer owns the nft",
        alice.keypair.pubkey() != world.asset_owner(&asset),
        true,
    );
    md.note(
        "Alice replays merkle proofs after transferring the NFT; the claim receipt blocks a second position",
    );
    let merkle_replay = world.bundle.for_claimer(alice.keypair.pubkey());
    let replay = world
        .ctx
        .tx(&[&alice.keypair])
        .build(
            merkle_replay,
            instruction::Claim {
                proofs: Some(alice.proofs.clone()),
                allocation: Some(alice.allocation),
                name: "Test asset".to_string(),
                uri: "https://example.com".to_string(),
            },
        )
        .send_err_named("AlreadyClaimed");
    world.record_execution("Act 3 — merkle replay rejected", &replay);
    world.after_tx();
    md.check(
        "claim receipt still bound to alice",
        alice.keypair.pubkey(),
        world
            .ctx
            .load::<vesting_positions::ClaimReceipt>(
                &world.bundle.for_claimer(alice.keypair.pubkey()).claim_receipt,
            )
            .claimer,
    );

    md.step("Bob claims via NFT ownership");
    let alice_claimed = world.claimer_token_balance(&alice.keypair.pubkey());
    let later = world.linear_checkpoint(75);
    world.warp_to(later);
    let bob_expected = world.expected_claimable(later, alice.allocation, alice_claimed);
    
    md.block("subsequent claim", md_kv! {
        "claimant"           => world.ctx.label(&bob.pubkey()),
        "whitelisted"        => false,
        "asset" =>  asset,
        "auth"               => "NFT ownership only (no merkle proofs)",
        "linear %"           => 75,
        "timestamp (unix)"   => later,
        "claimed so far"     => alice_claimed,
        "expected release"   => bob_expected,
    });
    md.note(
        "Bob was never whitelisted; NFT ownership alone authorizes the subsequent claim",
    );
    let bob_claim = world
        .bundle
        .for_claimer(bob.pubkey())
        .with_asset(asset);
    let bob_claim = world
        .ctx
        .tx(&[&bob])
        .build(
            bob_claim,
            instruction::Claim {
                proofs: None,
                allocation: None,
                name: "Test asset".to_string(),
                uri: "https://example.com".to_string(),
            },
        )
        .send_ok();
    world.record_execution("Act 4 — bob claim via nft ownership", &bob_claim);
    world.after_tx();
    md.check(
        "bob credited without merkle proofs",
        bob_expected,
        world.claimer_token_balance(&bob.pubkey()),
    );
    md.check(
        "position nft owner is still bob",
        bob.pubkey(),
        world.asset_owner(&asset),
    );

    world.report_execution(&mut md);
}
