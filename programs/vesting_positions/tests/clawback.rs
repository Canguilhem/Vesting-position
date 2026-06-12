mod common;

use anchor_litesvm::Signer;
use vesting_positions::instruction;

use common::{
    fund_keypair, load_whitelist_user, random_proofs, setup, CampaignConfig, MerkleTree,
    TestCampaign, WhitelistUser, LAMPORTS, WHITELISTED_1, WHITELISTED_2,
};

fn mint_alice_position(
    merkle: &MerkleTree,
    world: &mut TestCampaign,
) -> (WhitelistUser, anchor_lang::prelude::Pubkey) {
    let alice = load_whitelist_user(merkle, WHITELISTED_1);
    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);
    let asset = world.asset_for(&alice.keypair.pubkey());
    world.first_claim_ok(&alice.keypair, alice.proofs.clone(), alice.allocation);
    (alice, asset)
}

/// Claim at ~50% of the linear window so the position is partially vested.
fn partial_claim(world: &mut TestCampaign, user: &WhitelistUser, asset: anchor_lang::prelude::Pubkey) {
    world.warp_to(world.linear_checkpoint(50));
    let sub = world
        .bundle
        .for_claimer(user.keypair.pubkey())
        .with_asset(asset);
    world
        .ctx
        .tx(&[&user.keypair])
        .build(
            sub,
            instruction::Claim {
                proofs: None,
                allocation: None,
            },
        )
        .send_ok();
    world.after_tx();
}


// clawback existing position
/// Burns the asset and returns the unclaimed remainder to the creator.
#[test]
fn clawback_after_grace_burns_asset_and_recovers_remainder() {
    let (merkle, mut world) = setup(None);
    let (alice, asset) = mint_alice_position(&merkle, &mut world);

    partial_claim(&mut world, &alice, asset);
    let claimed = world.claimer_token_balance(&alice.keypair.pubkey());
    assert!(claimed > 0 && claimed < alice.allocation);

    world.warp_past_grace();
    let creator_before = world.creator_token_balance();

    let creator = world.creator.insecure_clone();
    world
        .ctx
        .tx(&[&creator])
        .build(world.bundle.with_asset(asset), instruction::Clawback {})
        .send_ok();
    world.after_tx();

    assert!(!world.asset_is_valid_mpl_core(&asset), "asset must be burned");
    assert_eq!(
        world.creator_token_balance(),
        creator_before + (alice.allocation - claimed)
    );

    // Past the grace window the claim instruction is closed entirely.
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
            },
        )
        .send_err_named("ClaimWindowClosed");
    world.after_tx();
}

/// Cannot clawback before end + grace_period.
#[test]
fn clawback_before_grace_fails() {
    let (merkle, mut world) = setup(None);
    let (_alice, asset) = mint_alice_position(&merkle, &mut world);

    world.warp_past_end(); // past end, but inside the grace window

    let creator = world.creator.insecure_clone();
    world
        .ctx
        .tx(&[&creator])
        .build(world.bundle.with_asset(asset), instruction::Clawback {})
        .send_err_named("GracePeriodNotOver");
    world.after_tx();
}

/// Fully claimed loyalty badges are inviolable.
#[test]
fn clawback_fully_claimed_badge_fails() {
    let (merkle, mut world) = setup(None);
    let (alice, asset) = mint_alice_position(&merkle, &mut world);

    // Fully claim inside the window, then move past grace for the clawback.
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
            },
        )
        .send_ok();
    world.after_tx();

    world.warp_past_grace();
    let creator = world.creator.insecure_clone();
    world
        .ctx
        .tx(&[&creator])
        .build(world.bundle.with_asset(asset), instruction::Clawback {})
        .send_err_named("AlreadyFullyClaimed");
    world.after_tx();
}

/// Only the campaign creator can clawback.
#[test]
fn clawback_requires_creator() {
    let (merkle, mut world) = setup(None);
    let (alice, asset) = mint_alice_position(&merkle, &mut world);

    world.warp_past_grace();

    let impostor_bundle = world
        .bundle
        .with_asset(asset)
        .with_creator(alice.keypair.pubkey());
    world
        .ctx
        .tx(&[&alice.keypair])
        .build(impostor_bundle, instruction::Clawback {})
        .send_err_named("Unauthorized");
    world.after_tx();
}

// clawback_unclaimed (never-claimed allocation)
/// Recovers the full allocation and permanently blocks a late first claim.
#[test]
fn clawback_unclaimed_recovers_allocation_and_blocks_claim() {
    let (merkle, mut world) = setup(None);
    let bob = load_whitelist_user(&merkle, WHITELISTED_2);
    fund_keypair(&mut world.ctx, &bob.keypair, LAMPORTS);

    world.warp_past_grace();
    let creator_before = world.creator_token_balance();

    let creator = world.creator.insecure_clone();
    let sub = world.bundle.for_claimer(bob.keypair.pubkey());
    world
        .ctx
        .tx(&[&creator])
        .build(
            sub,
            instruction::ClawbackUnclaimed {
                original_recipient: bob.keypair.pubkey(),
                allocation: bob.allocation,
                proofs: bob.proofs.clone(),
            },
        )
        .send_ok();
    world.after_tx();

    assert_eq!(
        world.creator_token_balance(),
        creator_before + bob.allocation
    );

    // Bob's late first claim is blocked: the window is closed (and the
    // receipt created by the clawback blocks it as defense in depth).
    world
        .ctx
        .tx(&[&bob.keypair])
        .build(
            world.bundle.for_claimer(bob.keypair.pubkey()),
            instruction::Claim {
                proofs: Some(bob.proofs.clone()),
                allocation: Some(bob.allocation),
            },
        )
        .send_err_named("ClaimWindowClosed");
    world.after_tx();
}

/// Invalid merkle proof is rejected.
#[test]
fn clawback_unclaimed_rejects_invalid_proof() {
    let (merkle, mut world) = setup(None);
    let bob = load_whitelist_user(&merkle, WHITELISTED_2);

    world.warp_past_grace();

    let creator = world.creator.insecure_clone();
    let sub = world.bundle.for_claimer(bob.keypair.pubkey());
    world
        .ctx
        .tx(&[&creator])
        .build(
            sub,
            instruction::ClawbackUnclaimed {
                original_recipient: bob.keypair.pubkey(),
                allocation: bob.allocation,
                proofs: random_proofs(),
            },
        )
        .send_err_named("InvalidProofs");
    world.after_tx();
}

/// Cannot clawback_unclaimed a recipient who already claimed (receipt exists).
#[test]
fn clawback_unclaimed_fails_if_already_claimed() {
    let (merkle, mut world) = setup(None);
    let (alice, _asset) = mint_alice_position(&merkle, &mut world);

    world.warp_past_grace();

    let creator = world.creator.insecure_clone();
    let sub = world.bundle.for_claimer(alice.keypair.pubkey());
    world
        .ctx
        .tx(&[&creator])
        .build(
            sub,
            instruction::ClawbackUnclaimed {
                original_recipient: alice.keypair.pubkey(),
                allocation: alice.allocation,
                proofs: alice.proofs.clone(),
            },
        )
        .send_err_named("AlreadyClaimed"); // receipt records a real first claim
    world.after_tx();
}

/// A buyer's subsequent claim creates a zeroed receipt at the buyer's PDA.
/// That must not strand the buyer's own never-claimed allocation
/// (regression: `init` on the receipt would fail forever).
#[test]
fn clawback_unclaimed_succeeds_despite_buyers_zeroed_receipt() {
    let (merkle, mut world) = setup(None);
    let (alice, asset) = mint_alice_position(&merkle, &mut world);

    // Bob is whitelisted but never first-claims. He buys Alice's position
    // and does a subsequent claim on it, creating a zeroed receipt for him.
    let bob = load_whitelist_user(&merkle, WHITELISTED_2);
    fund_keypair(&mut world.ctx, &bob.keypair, LAMPORTS);

    let transfer_ix =
        world.transfer_asset_ix(&alice.keypair.pubkey(), &bob.keypair.pubkey(), &asset);
    world.ctx.tx(&[&alice.keypair]).ix(transfer_ix).send_ok();
    world.after_tx();

    world.warp_to(world.linear_checkpoint(50));
    let sub = world
        .bundle
        .for_claimer(bob.keypair.pubkey())
        .with_asset(asset);
    world
        .ctx
        .tx(&[&bob.keypair])
        .build(
            sub,
            instruction::Claim {
                proofs: None,
                allocation: None,
            },
        )
        .send_ok();
    world.after_tx();

    world.warp_past_grace();
    let creator_before = world.creator_token_balance();

    let creator = world.creator.insecure_clone();
    let sub = world.bundle.for_claimer(bob.keypair.pubkey());
    world
        .ctx
        .tx(&[&creator])
        .build(
            sub,
            instruction::ClawbackUnclaimed {
                original_recipient: bob.keypair.pubkey(),
                allocation: bob.allocation,
                proofs: bob.proofs.clone(),
            },
        )
        .send_ok();
    world.after_tx();

    assert_eq!(
        world.creator_token_balance(),
        creator_before + bob.allocation
    );
}

/// Cannot clawback_unclaimed before end + grace_period.
#[test]
fn clawback_unclaimed_before_grace_fails() {
    let (merkle, mut world) = setup(None);
    let bob = load_whitelist_user(&merkle, WHITELISTED_2);

    world.warp_past_end();

    let creator = world.creator.insecure_clone();
    let sub = world.bundle.for_claimer(bob.keypair.pubkey());
    world
        .ctx
        .tx(&[&creator])
        .build(
            sub,
            instruction::ClawbackUnclaimed {
                original_recipient: bob.keypair.pubkey(),
                allocation: bob.allocation,
                proofs: bob.proofs.clone(),
            },
        )
        .send_err_named("GracePeriodNotOver");
    world.after_tx();
}

/// Vault must be empty before closing.
#[test]
fn close_campaign_fails_when_vault_not_empty() {
    let (_merkle, mut world) = setup(None);
    assert!(world.vault_balance() > 0);

    let creator = world.creator.insecure_clone();
    world
        .ctx
        .tx(&[&creator])
        .build(world.bundle, instruction::CloseCampaign {})
        .send_err_named("VaultNotEmpty");
    world.after_tx();
}

/// Empty vault → Campaign PDA and ATA closed, rent returned to creator.
#[test]
fn close_campaign_succeeds_when_vault_empty() {
    // Fund the campaign with exactly alice's allocation so a full claim
    // drains the vault to zero.
    let merkle = common::default_merkle();
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);
    let mut world = TestCampaign::from_merkle(
        &merkle,
        CampaignConfig {
            total_deposit: alice.allocation,
            ..Default::default()
        },
    );

    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);
    let asset = world.asset_for(&alice.keypair.pubkey());
    world.first_claim_ok(&alice.keypair, alice.proofs.clone(), alice.allocation);

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
            },
        )
        .send_ok();
    world.after_tx();

    assert_eq!(world.vault_balance(), 0);

    let creator = world.creator.insecure_clone();
    let creator_lamports_before = world.lamports(&creator.pubkey());
    world
        .ctx
        .tx(&[&creator])
        .build(world.bundle, instruction::CloseCampaign {})
        .send_ok();
    world.after_tx();

    assert!(
        world.ctx.svm.get_account(&world.bundle.campaign).is_none()
            || world.lamports(&world.bundle.campaign) == 0,
        "campaign PDA must be closed"
    );
    assert!(
        world.ctx.svm.get_account(&world.bundle.campaign_ata).is_none()
            || world.lamports(&world.bundle.campaign_ata) == 0,
        "campaign ATA must be closed"
    );
    assert!(
        world.lamports(&creator.pubkey()) > creator_lamports_before,
        "creator should receive rent refunds"
    );
}

// cancel_campaign
/// Mistake safeguard: full deposit returned, campaign + ATA + collection closed.
#[test]
fn cancel_campaign_returns_deposit_and_closes_accounts() {
    let (_merkle, mut world) = setup(None);
    let deposit = world.vault_balance();
    assert!(deposit > 0);

    let creator = world.creator.insecure_clone();
    let creator_tokens_before = world.creator_token_balance();
    let creator_lamports_before = world.lamports(&creator.pubkey());

    world
        .ctx
        .tx(&[&creator])
        .build(world.bundle, instruction::CancelCampaign {})
        .send_ok();
    world.after_tx();

    assert_eq!(
        world.creator_token_balance(),
        creator_tokens_before + deposit,
        "full deposit must return to creator"
    );
    assert_eq!(
        world.lamports(&world.bundle.campaign),
        0,
        "campaign PDA must be closed"
    );
    assert_eq!(
        world.lamports(&world.bundle.campaign_ata),
        0,
        "campaign ATA must be closed"
    );
    // mpl-core burn leaves a 1-byte uninitialized marker, not a closed account.
    let collection_data = world
        .ctx
        .svm
        .get_account(&world.bundle.collection)
        .map(|a| a.data)
        .unwrap_or_default();
    assert!(
        collection_data.len() <= 1,
        "collection must be burned (got {} bytes)",
        collection_data.len()
    );
    assert!(
        world.lamports(&creator.pubkey()) > creator_lamports_before,
        "creator should receive rent refunds"
    );
}

/// Once any position was minted, cancel is no longer possible.
#[test]
fn cancel_campaign_fails_after_first_claim() {
    let (merkle, mut world) = setup(None);
    let (_alice, _asset) = mint_alice_position(&merkle, &mut world);

    let creator = world.creator.insecure_clone();
    world
        .ctx
        .tx(&[&creator])
        .build(world.bundle, instruction::CancelCampaign {})
        .send_err_named("CampaignHasPositions");
    world.after_tx();
}

/// Cancel remains blocked even after the minted position was burned
/// (num_minted, not current_size, is the guard).
#[test]
fn cancel_campaign_fails_after_position_burned() {
    let (merkle, mut world) = setup(None);
    let (_alice, asset) = mint_alice_position(&merkle, &mut world);

    let creator = world.creator.insecure_clone();
    world
        .ctx
        .tx(&[&creator])
        .build(world.bundle.with_asset(asset), instruction::ExcludeAsset {})
        .send_ok();
    world.after_tx();

    world
        .ctx
        .tx(&[&creator])
        .build(world.bundle, instruction::CancelCampaign {})
        .send_err_named("CampaignHasPositions");
    world.after_tx();
}

// close_receipt
/// Receipts must persist while the campaign exists.
#[test]
fn close_receipt_fails_while_campaign_active() {
    let (merkle, mut world) = setup(None);
    let (alice, _asset) = mint_alice_position(&merkle, &mut world);

    world
        .ctx
        .tx(&[&alice.keypair])
        .build(
            world.bundle.for_claimer(alice.keypair.pubkey()),
            instruction::CloseReceipt {},
        )
        .send_err_named("CampaignStillActive");
    world.after_tx();
}

/// Once the campaign PDA is closed, claimers reclaim their receipt rent.
#[test]
fn close_receipt_returns_rent_after_close_campaign() {
    // Exact-funded campaign so a full claim empties the vault.
    let merkle = common::default_merkle();
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);
    let mut world = TestCampaign::from_merkle(
        &merkle,
        CampaignConfig {
            total_deposit: alice.allocation,
            ..Default::default()
        },
    );

    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);
    let asset = world.asset_for(&alice.keypair.pubkey());
    world.first_claim_ok(&alice.keypair, alice.proofs.clone(), alice.allocation);

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
            },
        )
        .send_ok();
    world.after_tx();

    let creator = world.creator.insecure_clone();
    world
        .ctx
        .tx(&[&creator])
        .build(world.bundle, instruction::CloseCampaign {})
        .send_ok();
    world.after_tx();

    let receipt = world
        .bundle
        .for_claimer(alice.keypair.pubkey())
        .claim_receipt;
    let alice_lamports_before = world.lamports(&alice.keypair.pubkey());
    assert!(world.lamports(&receipt) > 0);

    world
        .ctx
        .tx(&[&alice.keypair])
        .build(
            world.bundle.for_claimer(alice.keypair.pubkey()),
            instruction::CloseReceipt {},
        )
        .send_ok();
    world.after_tx();

    assert_eq!(world.lamports(&receipt), 0, "receipt must be closed");
    assert!(
        world.lamports(&alice.keypair.pubkey()) > alice_lamports_before,
        "claimer should receive the receipt rent"
    );
}

/// Only the campaign creator can cancel.
#[test]
fn cancel_campaign_requires_creator() {
    let (merkle, mut world) = setup(None);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);
    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);

    let impostor_bundle = world.bundle.with_creator(alice.keypair.pubkey());
    world
        .ctx
        .tx(&[&alice.keypair])
        .build(impostor_bundle, instruction::CancelCampaign {})
        .send_err_named("Unauthorized");
    world.after_tx();
}
