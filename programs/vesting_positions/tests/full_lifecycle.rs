//! Full life cycle
//!
//! Definitions:
//!   nft_position / asset  — mpl-core position NFT (PDA: `[asset, campaign, user]` on first claim)
//!   vested_tokens         — `compute_claimable()` output per claim
//!
//! Alice is whitelisted and claim right after cliff
//!     then
//! Subsequent:   signers = [user], proofs = None,      allocation = None
//!

mod common;

use anchor_litesvm::{Report, Signer, md_kv};
use mpl_core;
use vesting_positions::{instruction, Campaign};

use common::{
    assert_receipt_set, fund_keypair, load_keypair, load_whitelist_user, setup,
    LAMPORTS, NOT_WHITELISTED, WHITELISTED_1, 
};

use crate::common::{CampaignConfig, TOTAL_DEPOSIT};

#[test]
fn full_lifecycle() {

    let mut md = Report::new(
        "Full vesting lifecycle",
        "demonstrate whole vesting life cycle including position transfers",
    );

    let (merkle, mut world) = setup(None);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);
    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);
    let bob = load_keypair(NOT_WHITELISTED);
    fund_keypair(&mut world.ctx, &bob, LAMPORTS);

    world.ctx.alias(alice.keypair.pubkey(), "Alice pubkey");
    world.ctx.alias(bob.pubkey(), "Bob pubkey");
    world.ctx.alias(world.bundle.creator, "campaign creator pubkey");
    // Name the campaign PDA too: it's the `campaign:` field every decoded event
    // carries, so without this it leaks raw (run-varying) base58 into the report
    // and the snapshot stops being byte-reproducible.
    world.ctx.alias(world.bundle.campaign, "Campaign pubkey");
    world.ctx.alias(vesting_positions::ID, "vesting_positions program");
    world.ctx.alias(mpl_core::ID, "mpl_core");

    md.block(
        "actors pubkeys",
        md_kv! {
            "campaign creator"       => world.bundle.creator,
            "alice"       => alice.keypair.pubkey(),
            "bob"       => bob.pubkey(),
        },
    );

    md.block(
        "PDAs",
        md_kv! {
            "campaign"       => world.bundle.campaign,
            "campaign vault"       => world.bundle.campaign_ata,
        },
    );

    let campaign: Campaign = world.campaign();
    let config = CampaignConfig::default();

    md.step("Campaign initialized");
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

// --- Alice claims her vesting tokens at end of cliff period -------------------------------
    md.step("Alice first claim");
    world.warp_to(world.cliff_end());
    let asset = world.asset_for(&alice.keypair.pubkey());
    world.ctx.alias(asset, "Position NFT (minted by Alice)");
    world.ctx.alias(campaign.collection, "NFT Collection for this campaign");

    md.block("Collection & Asset", md_kv! {
        world.ctx.label(&asset) => asset,
        world.ctx.label(&campaign.collection) => campaign.collection
    });
    
    let first_claim =
        world.first_claim_ok(&alice.keypair, alice.proofs.clone(), alice.allocation);
    world.record_execution("Act 1 — alice first claim", &first_claim);

    let alice_balance_after_cliff = world.claimer_token_balance(&alice.keypair.pubkey());
    let expected_cliff = world.expected_claimable(world.cliff_end(), alice.allocation, 0);
    
    md.transition(
        "Alice's token balance, after the cliff claim",
        0u64,
        expected_cliff,
        alice_balance_after_cliff,
        format!("Alice received {}% of her allocation", campaign.cliff_release_bps/100),
    );


    md.check("position nft exists", true, world.ctx.account_exists(&asset));
    md.check(
        "position nft owner is alice",
        alice.keypair.pubkey(),
        world.asset_owner(&asset),
    );
    assert_receipt_set(&world, &alice.keypair.pubkey());

// --- Alice claims her vesting tokens for the elapsed time (50% of claim window) -------------------------------
    md.step("Alice subsequent claim without providing any proof");
    let mid = world.linear_checkpoint(50);
    world.warp_to(mid);
    // repeating balance fetch just for the sake of clarity
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

    let alice_claim_w_alice_asset_bundle = world
        .bundle
        .for_claimer(alice.keypair.pubkey())
        .with_asset(asset);
    let sub_claim = world
        .ctx
        .tx(&[&alice.keypair])
        .build(
            alice_claim_w_alice_asset_bundle,
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
    
    md.transition(
        "Alice balance after second claim at 50% elapsed time",
        balance_before, 
        balance_before + expected_mid, 
        world.claimer_token_balance(&alice.keypair.pubkey()), 
        "Alice received the expected amount for a 50% elapsed time"
    );

// --- Alice transfer her vesting position to her friend bob -------------------------------
    md.step("NFT transfer to Bob");
    md.block("transfer", md_kv! {
        "from"          => world.ctx.label(&alice.keypair.pubkey()),
        "to"            => world.ctx.label(&bob.pubkey()),
        "recipient whitelisted" => false,
        "asset"         => world.ctx.label(&asset),
    });
    let owner_before_transfer = world.asset_owner(&asset);
    let transfer_ix =
        world.transfer_asset_ix(&alice.keypair.pubkey(), &bob.pubkey(), &asset);
    world.ctx.tx(&[&alice.keypair]).ix(transfer_ix).send_ok();
    world.after_tx();
    let owner_after_transfer = world.asset_owner(&asset);
    
    md.transition(
        "Alice's position ownership",
        owner_before_transfer, 
        bob.pubkey(), 
        owner_after_transfer, 
        "Bob is now the owner of alice's vesting position"
    );

 // --- Alice tries to claim again providing her valid proofs -------------------------------
    md.step("Alice replays merkle proofs after transferring the NFT");
    md.note(
        "The program should reject and prevent minting a second vesting postion for the same provided proofs",
    );
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
// --- Bob claims tokens using alice's position -------------------------------
    md.step("Bob claims via NFT ownership");
    let alice_claimed = world.claimer_token_balance(&alice.keypair.pubkey());
    let later = world.linear_checkpoint(75);
    world.warp_to(later);
    let bob_expected = world.expected_claimable(later, alice.allocation, alice_claimed);
    
    md.block("subsequent claim", md_kv! {
        "claimant"           => world.ctx.label(&bob.pubkey()),
        "whitelisted"        => false,
        "asset"              => world.ctx.label(&asset),
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

    md.transition(
        "Bob's token balance after claiming with Alice's position",
        0u64,
        bob_expected,
        world.claimer_token_balance(&bob.pubkey()),
        "Despite not being whitelisted, bob can claim vested tokens from alice allocation since he owns her position",
    );

    md.check(
        "position nft owner is still bob",
        bob.pubkey(),
        world.asset_owner(&asset),
    );

    world.report_execution(&mut md);
}
