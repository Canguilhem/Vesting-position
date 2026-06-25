//! A narrative demonstration, not a defect.
//!
//! The program forfeits a recipient's *vested but unclaimed* tokens to the
//! creator once the grace window past `end` lapses. This test reproduces that
//! exactly and passes: the behaviour is the design, working as written. It
//! exists to put the behaviour under the report vocabulary so it is legible
//! enough to question, and to hand the maintainer a single artifact that asks:
//! should a fully-vested entitlement be forfeitable at all?

mod common;

use anchor_litesvm::{Report, Signer};
use vesting_positions::instruction;

use common::{fund_keypair, load_whitelist_user, setup, LAMPORTS, WHITELISTED_1};

#[test]
fn vested_tokens_are_forfeited_past_the_grace_window() {
    let mut md = Report::new(
        "Vested tokens forfeited past the grace window",
        "a fully-vested recipient who is slow to claim keeps nothing of the unclaimed remainder",
    );

    let (merkle, mut world) = setup(None);
    let alice = load_whitelist_user(&merkle, WHITELISTED_1);
    fund_keypair(&mut world.ctx, &alice.keypair, LAMPORTS);
    world.ctx.alias(alice.keypair.pubkey(), "Alice");
    world.ctx.alias(world.bundle.campaign, "Campaign");

    // --- Alice claims her cliff, then walks away -------------------------------
    md.step("Alice claims her cliff, then stops");
    world.warp_to(world.cliff_end());
    let asset = world.asset_for(&alice.keypair.pubkey());
    world.ctx.alias(asset, "Alice's position NFT");
    let first = world.first_claim_ok(&alice.keypair, alice.proofs.clone(), alice.allocation);
    world.record_execution("Act 1 — Alice claims the cliff", &first);
    let cliff = world.claimer_token_balance(&alice.keypair.pubkey());
    let expected_cliff = world.expected_claimable(world.cliff_end(), alice.allocation, 0);
    md.transition(
        "Alice's token balance, after the cliff claim",
        0u64,
        expected_cliff,
        cliff,
        "the cliff unlock reached her",
    );

    // --- Campaign end: Alice is 100% vested -----------------------------------
    md.step("Campaign end: Alice is fully vested");
    world.warp_past_end();
    let owed = world.expected_claimable(world.end, alice.allocation, cliff);
    md.note(
        "By campaign end every token has vested. Alice is *entitled* to the whole \
         remaining allocation; the only thing standing between her and it is one \
         more claim instruction she has not yet sent.",
    );
    md.check(
        "Alice's vested-but-unclaimed remainder (tokens)",
        alice.allocation - cliff,
        owed,
    );

    // --- The grace window lapses; the creator claws back ----------------------
    md.step("The grace window lapses, and the creator claws back");
    world.warp_past_grace();
    let creator_before = world.creator_token_balance();
    let creator = world.creator.insecure_clone();
    let clawback = world
        .ctx
        .tx(&[&creator])
        .build(world.bundle.with_asset(asset), instruction::Clawback {})
        .send_ok();
    world.record_execution("Act 2 — the creator claws back Alice's vested remainder", &clawback);
    world.after_tx();
    let recovered = world.creator_token_balance() - creator_before;

    // Alice's own claim is now refused outright.
    let sub = world
        .bundle
        .for_claimer(alice.keypair.pubkey())
        .with_asset(asset);
    let refused = world
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
        .send_err_named("ClaimWindowClosed");
    world.record_execution("Act 3 — Alice's late claim is refused", &refused);
    world.after_tx();

    // --- The forfeiture, told as two state changes ----------------------------
    let alice_final = world.claimer_token_balance(&alice.keypair.pubkey());
    md.transition(
        "Alice's token balance, across the clawback",
        cliff,
        cliff,
        alice_final,
        "her vested remainder was forfeited, never delivered",
    );
    md.transition(
        "tokens the creator recovered",
        0u64,
        owed,
        recovered,
        "the grace window let the creator reclaim fully-vested tokens",
    );
    md.note(
        "This test passes: the grace window is the program's design, working as \
         written. The question for review is whether a *vested* entitlement \
         should be forfeitable at all. Alice met every vesting condition; she lost \
         the remainder to a calendar deadline, not to an unmet cliff or an early \
         exit. Many vesting designs make vested tokens claimable indefinitely, so \
         two questions follow: is the forfeiture intended, and is a grace window \
         measured in days long enough to be fair to a recipient who is simply slow?",
    );

    world.report_execution(&mut md);
}
