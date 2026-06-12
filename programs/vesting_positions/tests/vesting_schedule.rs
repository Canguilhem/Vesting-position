mod common;

use anchor_litesvm::{AssertionHelpers, Signer};
use vesting_positions::instruction;

use common::{fund_keypair, load_whitelist_user, setup, CampaignConfig, LAMPORTS, WHITELISTED_1};

/// Percentages through the linear vesting window (0 = at cliff_end, 100 = at end).
const LINEAR_CHECKPOINTS: &[u64] = &[0, 1, 7, 13, 20, 33, 45, 50, 57, 67, 75, 83, 91, 99, 100];

/// Before cliff_end nothing is claimable; the position NFT still mints.
#[test]
fn before_cliff_transfers_zero() {
    let (merkle, mut world) = setup(None);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);

    world.warp_to(world.cliff_end() - 1);
    assert_eq!(
        world.expected_claimable(world.cliff_end() - 1, alice.allocation, 0),
        0
    );

    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);
    let asset = world.asset_for(&alice.keypair.pubkey());
    world.first_claim_ok(&alice.keypair, alice.proofs.clone(), alice.allocation);
    world.ctx.svm.assert_account_exists(&asset);
    assert_eq!(world.claimer_token_balance(&alice.keypair.pubkey()), 0);
}

/// Default campaign: 10% released at cliff, linear tail after.
#[test]
fn at_cliff_releases_cliff_bps() {
    let (merkle, mut world) = setup(None);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);

    world.warp_to(world.cliff_end());
    let expected = world.expected_claimable(world.cliff_end(), alice.allocation, 0);
    assert_eq!(expected, alice.allocation * 1_000 / 10_000);

    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);
    world.first_claim_ok(&alice.keypair, alice.proofs.clone(), alice.allocation);
    assert_eq!(
        world.claimer_token_balance(&alice.keypair.pubkey()),
        expected
    );
}

/// Halfway through the linear window: cliff slice + 50% of the linear remainder.
#[test]
fn mid_schedule_cliff_plus_linear() {
    let (merkle, mut world) = setup(None);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);

    let mid = world.linear_checkpoint(50);
    world.warp_to(mid);

    let expected = world.expected_claimable(mid, alice.allocation, 0);
    let cliff_amount = alice.allocation * world.cliff_release_bps as u64 / 10_000;
    let linear_amount = alice.allocation - cliff_amount;
    assert_eq!(expected, cliff_amount + linear_amount / 2);

    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);
    world.first_claim_ok(&alice.keypair, alice.proofs.clone(), alice.allocation);
    assert_eq!(
        world.claimer_token_balance(&alice.keypair.pubkey()),
        world.expected_claimable(mid, alice.allocation, 0)
    );
}

/// After end, the full allocation is claimable in one shot.
#[test]
fn at_end_releases_full_allocation() {
    let (merkle, mut world) = setup(None);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);

    world.warp_past_end();
    assert_eq!(
        world.expected_claimable(world.end + 1, alice.allocation, 0),
        alice.allocation
    );

    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);
    world.first_claim_ok(&alice.keypair, alice.proofs.clone(), alice.allocation);
    assert_eq!(
        world.claimer_token_balance(&alice.keypair.pubkey()),
        alice.allocation
    );
}

/// cliff_release_bps = 0 → pure linear from cliff_end to end.
#[test]
fn pure_linear_starts_at_cliff_end() {
    let (merkle, mut world) = setup(Some(CampaignConfig {
        cliff_release_bps: 0,
        ..Default::default()
    }));
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);

    world.warp_to(world.cliff_end());
    assert_eq!(
        world.expected_claimable(world.cliff_end(), alice.allocation, 0),
        0
    );

    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);
    let asset = world.asset_for(&alice.keypair.pubkey());
    world.first_claim_ok(&alice.keypair, alice.proofs.clone(), alice.allocation);
    assert_eq!(world.claimer_token_balance(&alice.keypair.pubkey()), 0);

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
    assert_eq!(
        world.claimer_token_balance(&alice.keypair.pubkey()),
        alice.allocation
    );
}

/// cliff_release_bps = 10000 → 100% at cliff, no linear tail.
#[test]
fn full_release_at_cliff() {
    let (merkle, mut world) = setup(Some(CampaignConfig {
        cliff_release_bps: 10_000,
        ..Default::default()
    }));
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);

    world.warp_to(world.cliff_end());
    assert_eq!(
        world.expected_claimable(world.cliff_end(), alice.allocation, 0),
        alice.allocation
    );

    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);
    let asset = world.asset_for(&alice.keypair.pubkey());
    world.first_claim_ok(&alice.keypair, alice.proofs.clone(), alice.allocation);
    assert_eq!(
        world.claimer_token_balance(&alice.keypair.pubkey()),
        alice.allocation
    );
    assert!(
        world.fetch_permanent_freeze_delegate(&asset).frozen,
        "loyalty badge must be permanently frozen after full claim"
    );

    world.warp_past_end();
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
            },
        )
        .send_err_named("AlreadyFullyClaimed");
    world.after_tx();
}

/// Incremental claims at several points through the linear window.
#[test]
fn claims_at_linear_checkpoints() {
    let (merkle, mut world) = setup(None);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);

    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);
    let asset = world.asset_for(&alice.keypair.pubkey());

    for (i, &pct) in LINEAR_CHECKPOINTS.iter().enumerate() {
        let now = world.linear_checkpoint(pct);
        world.warp_to(now);

        if i == 0 {
            world.first_claim_ok(&alice.keypair, alice.proofs.clone(), alice.allocation);
        } else {
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
        }

        assert_eq!(
            world.claimer_token_balance(&alice.keypair.pubkey()),
            world.expected_claimable(now, alice.allocation, 0),
            "balance mismatch at {pct}% through linear window"
        );
    }

    assert_eq!(
        world.claimer_token_balance(&alice.keypair.pubkey()),
        alice.allocation
    );
}
