mod common;

use anchor_litesvm::{AssertionHelpers, TestHelpers};
use vesting_positions::Campaign;

use common::{default_merkle, CampaignConfig, TestCampaign};

#[test]
fn initialize_campaign_deposits_tokens_and_creates_collection() {
    let merkle = default_merkle();
    let config = CampaignConfig::default();
    let mut world = TestCampaign::uninitialized(&merkle, config);

    assert!(!world.ctx.account_exists(&world.bundle.campaign));
    assert_eq!(
        world.ctx.svm.token_balance(&world.bundle.creator_ata),
        Some(config.total_deposit)
    );
    assert_eq!(
        world.ctx.svm.token_balance(&world.bundle.campaign_ata),
        None
    );

    let bundle = world.bundle;
    world
        .ctx
        .tx(&[&world.creator])
        .build(bundle, config.initialize_args(merkle.root, bundle.mint))
        .send_ok();
    world.after_tx();

    let campaign: Campaign = world.campaign();
    assert_eq!(campaign.creator, world.bundle.creator);
    assert_eq!(campaign.merkle_root, merkle.root);
    assert_eq!(campaign.total_deposit, config.total_deposit);
    assert_eq!(campaign.collection, world.bundle.collection);
    assert_eq!(campaign.mint_to_distribute, world.bundle.mint);
    assert_eq!(campaign.start, config.start);
    assert_eq!(campaign.end, config.end);
    assert!(campaign.is_transferable);
    assert_eq!(campaign.cliff_duration, config.cliff_duration);
    assert_eq!(campaign.cliff_release_bps, config.cliff_release_bps);
    assert_eq!(campaign.grace_period, config.grace_period);

    assert_eq!(
        world.ctx.svm.token_balance(&world.bundle.campaign_ata),
        Some(config.total_deposit)
    );
    assert_eq!(
        world.ctx.svm.token_balance(&world.bundle.creator_ata),
        Some(0)
    );
    world
        .ctx
        .svm
        .assert_account_exists(&world.bundle.collection);
}

#[test]
fn initialize_rejects_start_in_past() {
    let merkle = default_merkle();
    let now = 1_700_000_000_i64;
    let start = now - 86_400;
    let config = CampaignConfig {
        now,
        start,
        end: start + 86_400 * 30,
        ..Default::default()
    };
    let mut world = TestCampaign::uninitialized(&merkle, config);

    let bundle = world.bundle;
    world
        .ctx
        .tx(&[&world.creator])
        .build(bundle, config.initialize_args(merkle.root, bundle.mint))
        .send_err_named("InvalidTimeline");
    world.after_tx();
}

#[test]
fn initialize_rejects_zero_deposit() {
    let merkle = default_merkle();
    let config = CampaignConfig {
        total_deposit: 0,
        ..Default::default()
    };
    let mut world = TestCampaign::uninitialized(&merkle, config);

    let bundle = world.bundle;
    world
        .ctx
        .tx(&[&world.creator])
        .build(bundle, config.initialize_args(merkle.root, bundle.mint))
        .send_err_named("InvalidDeposit");
    world.after_tx();
}

#[test]
fn initialize_rejects_invalid_cliff_duration() {
    let merkle = default_merkle();
    let config = CampaignConfig {
        cliff_duration: 86_400 * 31,
        ..Default::default()
    };
    let mut world = TestCampaign::uninitialized(&merkle, config);

    let bundle = world.bundle;
    world
        .ctx
        .tx(&[&world.creator])
        .build(bundle, config.initialize_args(merkle.root, bundle.mint))
        .send_err_named("InvalidCliffDuration");
    world.after_tx();
}
