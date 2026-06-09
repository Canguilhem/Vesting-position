use anchor_litesvm::{AnchorLiteSVM, AssertionHelpers, Signer, TestHelpers};
use vesting_positions::{instruction, test_helpers::VestingBundle, Campaign};

const PROGRAM_BYTES: &[u8] = include_bytes!("../../../target/deploy/vesting_positions.so");
const MPL_CORE_BYTES: &[u8] = include_bytes!("../../../tests/fixtures/mpl_core.so");

fn setup() -> anchor_litesvm::AnchorContext {
    AnchorLiteSVM::build_with_programs(&[
        (vesting_positions::ID, "vesting_positions", PROGRAM_BYTES),
        (mpl_core::ID, "mpl_core", MPL_CORE_BYTES),
    ])
}

#[test]
fn initialize_campaign_deposits_tokens_and_creates_collection() {
    let mut ctx = setup();

    let now: i64 = 1_700_000_000;
    let start = now - 86_400;
    let end = now + 86_400 * 30;
    let total_deposit: u64 = 5_000_000_000;
    let merkle_root = [7u8; 32];

    ctx.svm.warp_to_timestamp(now);

    let creator = ctx.svm.create_funded_account(10_000_000_000).unwrap();
    let mint = ctx.svm.create_token_mint(&creator, 6).unwrap();
    let bundle = VestingBundle::init(creator.pubkey(), mint.pubkey(), &merkle_root);

    ctx.svm
        .create_associated_token_account(&bundle.mint, &creator)
        .unwrap();
    ctx.svm
        .mint_to(&bundle.mint, &bundle.creator_ata, &creator, total_deposit)
        .unwrap();

    let ix = ctx.program().build_ix(
        bundle,
        instruction::Initialize {
            merkle_root,
            start,
            end,
            cliff_duration: 86_400,
            cliff_release_bps: 1_000,
            mint_to_distribute: bundle.mint,
            is_transferable: true,
            grace_period: 604_800,
            total_deposit,
            name: "Vesting campaign".to_string(),
            uri: "https://example.com/collection.json".to_string(),
        },
    );

    ctx.alias(creator.pubkey(), "creator");
    ctx.send_ok(ix, &[&creator]);

    let campaign_account: Campaign = ctx.get_account(&bundle.campaign).unwrap();
    assert_eq!(campaign_account.creator, bundle.creator);
    assert_eq!(campaign_account.merkle_root, merkle_root);
    assert_eq!(campaign_account.total_deposit, total_deposit);
    assert_eq!(campaign_account.collection, bundle.collection);
    assert_eq!(campaign_account.mint_to_distribute, bundle.mint);
    assert_eq!(campaign_account.start, start);
    assert_eq!(campaign_account.end, end);
    assert!(campaign_account.is_transferable);

    assert_eq!(
        ctx.svm.token_balance(&bundle.campaign_ata),
        Some(total_deposit)
    );
    assert_eq!(ctx.svm.token_balance(&bundle.creator_ata), Some(0));
    ctx.svm.assert_account_exists(&bundle.collection);
}
