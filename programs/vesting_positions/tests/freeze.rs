mod common;

use anchor_litesvm::Signer;
use vesting_positions::instruction;

use common::{
    fund_keypair, load_whitelist_user, setup, transfer_changes_owner, CampaignConfig, TestCampaign,
    LAMPORTS, WHITELISTED_1, WHITELISTED_2,
};

fn mint_alice_position(
    merkle: &common::MerkleTree,
    world: &mut TestCampaign,
) -> (common::WhitelistUser, anchor_lang::prelude::Pubkey) {
    let alice = load_whitelist_user(merkle, WHITELISTED_1);
    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);
    let asset = world.asset_for(&alice.keypair.pubkey());
    world.first_claim_ok(&alice.keypair, alice.proofs.clone(), alice.allocation);
    (alice, asset)
}

/// Transferable campaign: asset minted unfrozen → transfer succeeds.
#[test]
fn transfer_when_collection_unfrozen_on_transferable_campaign() {
    let (merkle, mut world) = setup(None);
    let bob = load_whitelist_user(&merkle, WHITELISTED_2);
    fund_keypair(&mut world.ctx, &bob.keypair, LAMPORTS);

    let (alice, asset) = mint_alice_position(&merkle, &mut world);

    assert!(
        !world
            .fetch_permanent_freeze_delegate(&world.bundle.collection)
            .frozen
    );
    assert!(
        !world
            .try_fetch_asset_freeze_delegate(&asset)
            .expect("transferable mint has PermanentFreezeDelegate")
            .frozen
    );

    assert!(transfer_changes_owner(
        &mut world,
        &alice.keypair,
        &bob.keypair.pubkey(),
        &asset,
    ));
    assert_eq!(world.asset_owner(&asset), bob.keypair.pubkey());
}

/// Non-transferable campaign: collection frozen, no asset freeze plugin → transfer blocked.
#[test]
fn transfer_blocked_when_collection_frozen() {
    let (merkle, mut world) = setup(Some(CampaignConfig {
        is_transferable: false,
        ..Default::default()
    }));
    let bob = load_whitelist_user(&merkle, WHITELISTED_2);
    fund_keypair(&mut world.ctx, &bob.keypair, LAMPORTS);

    let (alice, asset) = mint_alice_position(&merkle, &mut world);

    assert!(
        world
            .fetch_permanent_freeze_delegate(&world.bundle.collection)
            .frozen
    );
    assert!(!world.asset_has_freeze_delegate(&asset));

    assert!(!transfer_changes_owner(
        &mut world,
        &alice.keypair,
        &bob.keypair.pubkey(),
        &asset,
    ));
    assert_eq!(world.asset_owner(&asset), alice.keypair.pubkey());
}

/// MPL Core precedence: asset `frozen: false` overrides collection freeze on existing positions.
#[test]
fn collection_freeze_does_not_block_existing_transferable_positions() {
    let (merkle, mut world) = setup(None);
    let bob = load_whitelist_user(&merkle, WHITELISTED_2);
    fund_keypair(&mut world.ctx, &bob.keypair, LAMPORTS);

    let (alice, asset) = mint_alice_position(&merkle, &mut world);

    let creator = world.creator.insecure_clone();
    world
        .ctx
        .tx(&[&creator])
        .build(
            world.bundle,
            instruction::FreezeCollection {
                should_freeze: true,
            },
        )
        .send_ok();
    world.after_tx();

    assert!(
        world
            .fetch_permanent_freeze_delegate(&world.bundle.collection)
            .frozen
    );
    assert!(
        !world
            .try_fetch_asset_freeze_delegate(&asset)
            .expect("transferable mint has PermanentFreezeDelegate")
            .frozen
    );

    assert!(transfer_changes_owner(
        &mut world,
        &alice.keypair,
        &bob.keypair.pubkey(),
        &asset,
    ));
}

/// Unfreezing a non-transferable collection restores transfer (no asset plugin to clear).
#[test]
fn unfreeze_collection_restores_transfer_for_non_transferable_campaign() {
    let (merkle, mut world) = setup(Some(CampaignConfig {
        is_transferable: false,
        ..Default::default()
    }));
    let bob = load_whitelist_user(&merkle, WHITELISTED_2);
    fund_keypair(&mut world.ctx, &bob.keypair, LAMPORTS);

    let (alice, asset) = mint_alice_position(&merkle, &mut world);

    assert!(!transfer_changes_owner(
        &mut world,
        &alice.keypair,
        &bob.keypair.pubkey(),
        &asset,
    ));

    let creator = world.creator.insecure_clone();
    world
        .ctx
        .tx(&[&creator])
        .build(
            world.bundle,
            instruction::FreezeCollection {
                should_freeze: false,
            },
        )
        .send_ok();
    world.after_tx();

    assert!(world.campaign().is_transferable);
    assert!(
        !world
            .fetch_permanent_freeze_delegate(&world.bundle.collection)
            .frozen
    );
    assert!(!world.asset_has_freeze_delegate(&asset));

    assert!(transfer_changes_owner(
        &mut world,
        &alice.keypair,
        &bob.keypair.pubkey(),
        &asset,
    ));
    assert_eq!(world.asset_owner(&asset), bob.keypair.pubkey());
}

/// Fully claimed position on transferable campaign is frozen (loyalty badge).
#[test]
fn fully_claimed_loyalty_badge_is_permanently_frozen() {
    let (merkle, mut world) = setup(None);
    let bob = load_whitelist_user(&merkle, WHITELISTED_2);
    fund_keypair(&mut world.ctx, &bob.keypair, LAMPORTS);

    let (alice, asset) = mint_alice_position(&merkle, &mut world);

    world.warp_past_end();
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
    assert!(
        !world
            .fetch_permanent_freeze_delegate(&world.bundle.collection)
            .frozen
    );
    assert!(world.fetch_permanent_freeze_delegate(&asset).frozen);

    assert!(!transfer_changes_owner(
        &mut world,
        &alice.keypair,
        &bob.keypair.pubkey(),
        &asset,
    ));
}

/// Fully claimed position on non-transferable campaign has no asset freeze plugin.
#[test]
fn fully_claimed_non_transferable_has_no_asset_freeze() {
    let (merkle, mut world) = setup(Some(CampaignConfig {
        is_transferable: false,
        ..Default::default()
    }));

    let (alice, asset) = mint_alice_position(&merkle, &mut world);

    world.warp_past_end();
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
    assert!(
        world
            .fetch_permanent_freeze_delegate(&world.bundle.collection)
            .frozen
    );
    assert!(!world.asset_has_freeze_delegate(&asset));
}

// ---------------------------------------------------------------------------
// exclude_asset
// ---------------------------------------------------------------------------

/// Creator can burn a partially-vested position; the unclaimed remainder
/// returns to the creator and subsequent claims fail.
#[test]
fn exclude_asset_blocks_subsequent_claims() {
    let (merkle, mut world) = setup(None);

    let (alice, asset) = mint_alice_position(&merkle, &mut world);

    world.warp_to(world.linear_checkpoint(50));
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

    let balance_after_partial = world.claimer_token_balance(&alice.keypair.pubkey());
    assert!(balance_after_partial > 0);
    assert!(balance_after_partial < alice.allocation);

    let creator_before = world.creator_token_balance();
    let creator = world.creator.insecure_clone();
    world
        .ctx
        .tx(&[&creator])
        .build(world.bundle.with_asset(asset), instruction::ExcludeAsset {})
        .send_ok();
    world.after_tx();

    assert_eq!(
        world.creator_token_balance(),
        creator_before + (alice.allocation - balance_after_partial),
        "unclaimed remainder must return to creator"
    );

    world.warp_past_end();
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
        .send_err_named("InvalidAsset");
    world.after_tx();

    assert_eq!(
        world.claimer_token_balance(&alice.keypair.pubkey()),
        balance_after_partial
    );
}

/// Cannot exclude a fully claimed loyalty badge.
#[test]
fn exclude_asset_fails_when_fully_claimed() {
    let (merkle, mut world) = setup(None);

    let (alice, asset) = mint_alice_position(&merkle, &mut world);

    world.warp_past_end();
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

    let creator = world.creator.insecure_clone();
    world
        .ctx
        .tx(&[&creator])
        .build(world.bundle.with_asset(asset), instruction::ExcludeAsset {})
        .send_err_named("AlreadyFullyClaimed");
    world.after_tx();
}

/// Confirms mpl-core BurnV1: asset invalidated, transfer blocked, creator refunded rent.
#[test]
fn exclude_asset_burns_position() {
    let (merkle, mut world) = setup(None);
    let bob = load_whitelist_user(&merkle, WHITELISTED_2);
    fund_keypair(&mut world.ctx, &bob.keypair, LAMPORTS);

    let (alice, asset) = mint_alice_position(&merkle, &mut world);

    assert!(world.asset_is_valid_mpl_core(&asset));
    assert_eq!(world.asset_owner(&asset), alice.keypair.pubkey());

    let creator = world.creator.pubkey();
    let creator_lamports_before = world.lamports(&creator);

    world
        .ctx
        .tx(&[&world.creator])
        .build(world.bundle.with_asset(asset), instruction::ExcludeAsset {})
        .send_ok();
    world.after_tx();

    assert!(
        !world.asset_is_valid_mpl_core(&asset),
        "burned asset must not deserialize as BaseAssetV1"
    );

    let transfer_ix =
        world.transfer_asset_ix(&alice.keypair.pubkey(), &bob.keypair.pubkey(), &asset);
    world.ctx.tx(&[&alice.keypair]).ix(transfer_ix).send_err();
    world.after_tx();

    assert!(
        world.lamports(&creator) > creator_lamports_before,
        "burn payer should receive rent refund"
    );
}

// ---------------------------------------------------------------------------
// freeze_asset (per-asset admin pause)
// ---------------------------------------------------------------------------

/// Creator can pause transfers of a single position and later restore them.
#[test]
fn freeze_asset_blocks_transfer_and_unfreeze_restores() {
    let (merkle, mut world) = setup(None);
    let bob = load_whitelist_user(&merkle, WHITELISTED_2);
    fund_keypair(&mut world.ctx, &bob.keypair, LAMPORTS);

    let (alice, asset) = mint_alice_position(&merkle, &mut world);

    let creator = world.creator.insecure_clone();
    world
        .ctx
        .tx(&[&creator])
        .build(
            world.bundle.with_asset(asset),
            instruction::FreezeAsset {
                should_freeze: true,
            },
        )
        .send_ok();
    world.after_tx();

    assert!(world.fetch_permanent_freeze_delegate(&asset).frozen);
    assert!(!transfer_changes_owner(
        &mut world,
        &alice.keypair,
        &bob.keypair.pubkey(),
        &asset,
    ));

    world
        .ctx
        .tx(&[&creator])
        .build(
            world.bundle.with_asset(asset),
            instruction::FreezeAsset {
                should_freeze: false,
            },
        )
        .send_ok();
    world.after_tx();

    assert!(!world.fetch_permanent_freeze_delegate(&asset).frozen);
    assert!(transfer_changes_owner(
        &mut world,
        &alice.keypair,
        &bob.keypair.pubkey(),
        &asset,
    ));
}

/// Positions on non-transferable campaigns carry no freeze plugin and are rejected.
#[test]
fn freeze_asset_fails_without_freeze_plugin() {
    let (merkle, mut world) = setup(Some(CampaignConfig {
        is_transferable: false,
        ..Default::default()
    }));
    let (_alice, asset) = mint_alice_position(&merkle, &mut world);

    let creator = world.creator.insecure_clone();
    world
        .ctx
        .tx(&[&creator])
        .build(
            world.bundle.with_asset(asset),
            instruction::FreezeAsset {
                should_freeze: true,
            },
        )
        .send_err_named("FreezePluginMissing");
    world.after_tx();
}

/// Only the campaign creator can toggle a per-asset freeze.
#[test]
fn freeze_asset_requires_creator() {
    let (merkle, mut world) = setup(None);
    let (alice, asset) = mint_alice_position(&merkle, &mut world);

    let impostor_bundle = world
        .bundle
        .with_asset(asset)
        .with_creator(alice.keypair.pubkey());
    world
        .ctx
        .tx(&[&alice.keypair])
        .build(
            impostor_bundle,
            instruction::FreezeAsset {
                should_freeze: true,
            },
        )
        .send_err_named("Unauthorized");
    world.after_tx();
}

// ---------------------------------------------------------------------------
// freeze_collection toggle vs final claim (regression)
// ---------------------------------------------------------------------------

/// Asset minted on a non-transferable campaign (no freeze plugin); admin later
/// unfreezes the collection (is_transferable becomes true). The final claim
/// must not attempt the loyalty-badge freeze on the missing plugin.
#[test]
fn final_claim_succeeds_after_collection_unfreeze_toggle() {
    let (merkle, mut world) = setup(Some(CampaignConfig {
        is_transferable: false,
        ..Default::default()
    }));
    let (alice, asset) = mint_alice_position(&merkle, &mut world);

    let creator = world.creator.insecure_clone();
    world
        .ctx
        .tx(&[&creator])
        .build(
            world.bundle,
            instruction::FreezeCollection {
                should_freeze: false,
            },
        )
        .send_ok();
    world.after_tx();
    assert!(world.campaign().is_transferable);

    world.warp_past_end();
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
    assert!(!world.asset_has_freeze_delegate(&asset));
}

/// Mirror case: asset minted with the plugin (transferable campaign); admin
/// freezes the collection afterwards. The badge freeze still goes through.
#[test]
fn final_claim_freezes_badge_even_when_collection_frozen() {
    let (merkle, mut world) = setup(None);
    let (alice, asset) = mint_alice_position(&merkle, &mut world);

    let creator = world.creator.insecure_clone();
    world
        .ctx
        .tx(&[&creator])
        .build(
            world.bundle,
            instruction::FreezeCollection {
                should_freeze: true,
            },
        )
        .send_ok();
    world.after_tx();
    assert!(!world.campaign().is_transferable);

    world.warp_past_end();
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
    assert!(world.fetch_permanent_freeze_delegate(&asset).frozen);
}
