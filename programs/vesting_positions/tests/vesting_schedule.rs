//! Vesting schedule / claimable-amount integration tests.
//!
//! Asserts on-chain token transfers match `compute_claimable()` for
//! `cliff_duration` and `cliff_release_bps`.

mod common;

use anchor_litesvm::{AssertionHelpers, Signer};

use common::{
    default_merkle, expect_subsequent_claim_fails, first_claim, fund_keypair, load_whitelist_user,
    subsequent_claim, TestCampaign, LAMPORTS, WHITELISTED_1,
};

/// Percentages through the linear vesting window (0 = at cliff_end, 100 = at end).
const LINEAR_CHECKPOINTS: &[u64] = &[
    0, 1, 7, 13, 20, 33, 45, 50, 57, 67, 75, 83, 91, 99, 100,
];

/// Before cliff_end nothing is claimable; the position NFT still mints.
#[test]
fn before_cliff_transfers_zero() {
    let merkle = default_merkle();
    let mut campaign = TestCampaign::from_merkle(&merkle);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);

    campaign.warp_to(campaign.cliff_end() - 1);
    assert_eq!(
        campaign.expected_claimable(campaign.cliff_end() - 1, alice.allocation, 0),
        0
    );

    fund_keypair(&mut campaign.ctx, &alice.keypair, LAMPORTS);
    let asset = campaign.asset_for(&alice.keypair.pubkey());
    first_claim(
        &mut campaign,
        &alice.keypair,
        alice.proofs.clone(),
        alice.allocation,
    );
    campaign.ctx.svm.assert_account_exists(&asset);
    assert_eq!(campaign.claimer_token_balance(&alice.keypair.pubkey()), 0);
}

/// Default campaign: 10% released at cliff, linear tail after.
#[test]
fn at_cliff_releases_cliff_bps() {
    let merkle = default_merkle();
    let mut campaign = TestCampaign::from_merkle(&merkle);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);

    campaign.warp_to(campaign.cliff_end());
    let expected = campaign.expected_claimable(campaign.cliff_end(), alice.allocation, 0);
    assert_eq!(expected, alice.allocation * 1_000 / 10_000);

    fund_keypair(&mut campaign.ctx, &alice.keypair, LAMPORTS);
    first_claim(
        &mut campaign,
        &alice.keypair,
        alice.proofs.clone(),
        alice.allocation,
    );
    assert_eq!(campaign.claimer_token_balance(&alice.keypair.pubkey()), expected);
}

/// Halfway through the linear window: cliff slice + 50% of the linear remainder.
#[test]
fn mid_schedule_cliff_plus_linear() {
    let merkle = default_merkle();
    let mut campaign = TestCampaign::from_merkle(&merkle);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);

    let mid = campaign.linear_checkpoint(50);
    campaign.warp_to(mid);

    let expected = campaign.expected_claimable(mid, alice.allocation, 0);
    let cliff_amount = alice.allocation * campaign.cliff_release_bps as u64 / 10_000;
    let linear_amount = alice.allocation - cliff_amount;
    assert_eq!(expected, cliff_amount + linear_amount / 2);

    fund_keypair(&mut campaign.ctx, &alice.keypair, LAMPORTS);
    first_claim(
        &mut campaign,
        &alice.keypair,
        alice.proofs.clone(),
        alice.allocation,
    );
    assert_eq!(
        campaign.claimer_token_balance(&alice.keypair.pubkey()),
        campaign.expected_claimable(mid, alice.allocation, 0)
    );
}

/// After end, the full allocation is claimable in one shot.
#[test]
fn at_end_releases_full_allocation() {
    let merkle = default_merkle();
    let mut campaign = TestCampaign::from_merkle(&merkle);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);

    campaign.warp_past_end();
    assert_eq!(
        campaign.expected_claimable(campaign.end + 1, alice.allocation, 0),
        alice.allocation
    );

    fund_keypair(&mut campaign.ctx, &alice.keypair, LAMPORTS);
    first_claim(
        &mut campaign,
        &alice.keypair,
        alice.proofs.clone(),
        alice.allocation,
    );
    assert_eq!(
        campaign.claimer_token_balance(&alice.keypair.pubkey()),
        alice.allocation
    );
}

/// cliff_release_bps = 0 → pure linear from cliff_end to end.
#[test]
fn pure_linear_starts_at_cliff_end() {
    let merkle = default_merkle();
    let mut campaign = TestCampaign::from_merkle_with_vesting(&merkle, 86_400, 0);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);

    campaign.warp_to(campaign.cliff_end());
    assert_eq!(
        campaign.expected_claimable(campaign.cliff_end(), alice.allocation, 0),
        0
    );

    fund_keypair(&mut campaign.ctx, &alice.keypair, LAMPORTS);
    let asset = campaign.asset_for(&alice.keypair.pubkey());
    first_claim(
        &mut campaign,
        &alice.keypair,
        alice.proofs.clone(),
        alice.allocation,
    );
    assert_eq!(campaign.claimer_token_balance(&alice.keypair.pubkey()), 0);

    campaign.warp_past_end();
    subsequent_claim(&mut campaign, &alice.keypair, &asset);
    assert_eq!(
        campaign.claimer_token_balance(&alice.keypair.pubkey()),
        alice.allocation
    );
}

/// cliff_release_bps = 10000 → 100% at cliff, no linear tail.
#[test]
fn full_release_at_cliff() {
    let merkle = default_merkle();
    let mut campaign = TestCampaign::from_merkle_with_vesting(&merkle, 86_400, 10_000);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);

    campaign.warp_to(campaign.cliff_end());
    assert_eq!(
        campaign.expected_claimable(campaign.cliff_end(), alice.allocation, 0),
        alice.allocation
    );

    fund_keypair(&mut campaign.ctx, &alice.keypair, LAMPORTS);
    let asset = campaign.asset_for(&alice.keypair.pubkey());
    first_claim(
        &mut campaign,
        &alice.keypair,
        alice.proofs.clone(),
        alice.allocation,
    );
    assert_eq!(
        campaign.claimer_token_balance(&alice.keypair.pubkey()),
        alice.allocation
    );
    assert!(
        campaign.permanent_freeze_delegate(&asset).frozen,
        "loyalty badge must be permanently frozen after full claim"
    );

    campaign.warp_past_end();
    expect_subsequent_claim_fails(
        &mut campaign,
        &alice.keypair,
        &asset,
        "AlreadyFullyClaimed",
    );
}

/// Incremental claims at several points through the linear window.
#[test]
fn claims_at_linear_checkpoints() {
    let merkle = default_merkle();
    let mut campaign = TestCampaign::from_merkle(&merkle);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);

    fund_keypair(&mut campaign.ctx, &alice.keypair, LAMPORTS);
    let asset = campaign.asset_for(&alice.keypair.pubkey());

    for (i, &pct) in LINEAR_CHECKPOINTS.iter().enumerate() {
        let now = campaign.linear_checkpoint(pct);
        campaign.warp_to(now);

        if i == 0 {
            first_claim(
                &mut campaign,
                &alice.keypair,
                alice.proofs.clone(),
                alice.allocation,
            );
        } else {
            subsequent_claim(&mut campaign, &alice.keypair, &asset);
        }

        assert_eq!(
            campaign.claimer_token_balance(&alice.keypair.pubkey()),
            campaign.expected_claimable(now, alice.allocation, 0),
            "balance mismatch at {pct}% through linear window"
        );
    }

    assert_eq!(
        campaign.claimer_token_balance(&alice.keypair.pubkey()),
        alice.allocation
    );
}
