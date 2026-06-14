import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  SystemProgram,
} from "@solana/web3.js";

import { VestingPositions } from "../target/types/vesting_positions";

import {
  advanceTo,
  confirmTx,
  createMintWithDeposit,
  deriveClaimerAccounts,
  deriveVestingAccounts,
  devnetSchedule,
  FIRST_CLAIM_CU,
  fundWalletFromPayer,
  fundWallets,
  isDevnet,
  loadKeypair,
  loadMerkleFixture,
  MPL_CORE_PROGRAM_ID,
  tokenBalance,
  TOTAL_DEPOSIT,
  WHITELISTED_1_KEYPAIR,
} from "./utils";

describe("vesting positions", function () {
  this.timeout(600_000);

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.vestingPositions as Program<VestingPositions>;
  const creator = provider.wallet;
  const alice = loadKeypair(WHITELISTED_1_KEYPAIR);
  const merkle = loadMerkleFixture();

  let mint: anchor.web3.PublicKey;
  let tokenProgram: anchor.web3.PublicKey;
  let accounts: ReturnType<typeof deriveVestingAccounts>;
  let schedule: ReturnType<typeof devnetSchedule>;
  let aliceClaim: ReturnType<typeof deriveClaimerAccounts>;
  let cliffAmount: bigint;

  before(async () => {
    console.log("cluster:", provider.connection.rpcEndpoint);
    console.log("program:", program.programId.toBase58());
    console.log("creator:", creator.publicKey.toBase58());
    console.log("alice:", alice.publicKey.toBase58());

    await fundWallets(provider, [alice.publicKey]);
    if (isDevnet(provider.connection)) {
      await fundWalletFromPayer(
        provider.connection,
        creator.payer,
        alice.publicKey,
        500_000_000,
      );
    }

    const mintSetup = await createMintWithDeposit(
      provider.connection,
      creator.payer,
      6,
      TOTAL_DEPOSIT,
    );
    mint = mintSetup.mint;
    tokenProgram = mintSetup.tokenProgram;

    accounts = deriveVestingAccounts(
      creator.publicKey,
      mint,
      merkle.root,
      tokenProgram,
    );
    aliceClaim = deriveClaimerAccounts(accounts, alice.publicKey);
    schedule = devnetSchedule();

    const { allocation } = merkle.getProofs(alice.publicKey);
    cliffAmount = (allocation * BigInt(schedule.cliffReleaseBps)) / 10_000n;

    console.log("campaign mint:", mint.toBase58());
    console.log("collection:", accounts.collection.toBase58());
    console.log("campaign:", accounts.campaign.toBase58());
    console.log("schedule:", schedule);
    console.log("expected cliff release:", cliffAmount.toString());
  });

  it("initializes a campaign", async () => {
    const sig = await program.methods
      .initialize(
        Array.from(merkle.root),
        new BN(schedule.start),
        new BN(schedule.end),
        new BN(schedule.cliffDuration),
        schedule.cliffReleaseBps,
        mint,
        true,
        new BN(schedule.gracePeriod),
        new BN(TOTAL_DEPOSIT.toString()),
        "Devnet vesting campaign",
        "https://example.com/devnet-collection.json",
      )
      .accountsPartial({
        creator: creator.publicKey,
        collection: accounts.collection,
        updateAuthority: accounts.updateAuthority,
        mint,
        creatorAta: accounts.creatorAta,
        campaign: accounts.campaign,
        campaignAta: accounts.campaignAta,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
      })
      .rpc();

    await confirmTx(provider.connection, sig, "initialize");

    const campaign = await program.account.campaign.fetch(accounts.campaign);
    expect(campaign.creator.equals(creator.publicKey)).to.be.true;
    expect(Buffer.from(campaign.merkleRoot).equals(merkle.root)).to.be.true;
    expect(campaign.totalDeposit.eq(new BN(TOTAL_DEPOSIT.toString()))).to.be
      .true;

    const vault = await tokenBalance(provider.connection, accounts.campaignAta);
    expect(vault).to.equal(TOTAL_DEPOSIT);
  });

  it("alice first claim mints position NFT and releases cliff tokens", async () => {
    await advanceTo(provider.connection, schedule.start, "campaign start");
    await advanceTo(
      provider.connection,
      schedule.start + schedule.cliffDuration,
      "cliff end",
    );

    const { allocation, proofs } = merkle.getProofs(alice.publicKey);
    const balanceBefore = await tokenBalance(
      provider.connection,
      aliceClaim.userAta,
    );

    const sig = await program.methods
      .claim(
        proofs,
        new BN(allocation.toString()),
        "Devnet position",
        "https://example.com/nft.json",
      )
      .accountsPartial({
        user: alice.publicKey,
        collection: accounts.collection,
        updateAuthority: accounts.updateAuthority,
        mint,
        campaignAta: accounts.campaignAta,
        userAta: aliceClaim.userAta,
        campaign: accounts.campaign,
        asset: aliceClaim.asset,
        claimReceipt: aliceClaim.claimReceipt,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: FIRST_CLAIM_CU }),
      ])
      .signers([alice])
      .rpc();

    await confirmTx(provider.connection, sig, "first claim");

    const balanceAfter = await tokenBalance(
      provider.connection,
      aliceClaim.userAta,
    );
    const received = balanceAfter - balanceBefore;
    console.log("alice received:", received.toString());
    expect(received >= cliffAmount).to.be.true;

    const assetAccount = await provider.connection.getAccountInfo(
      aliceClaim.asset,
    );
    expect(assetAccount).to.not.be.null;
    expect(assetAccount!.data.length).to.be.greaterThan(0);

    const receipt = await program.account.claimReceipt.fetch(
      aliceClaim.claimReceipt,
    );
    expect(receipt.claimer.equals(alice.publicKey)).to.be.true;
  });

  it("alice subsequent claim releases more vested tokens", async () => {
    const midpoint =
      schedule.start + Math.floor((schedule.end - schedule.start) / 2);
    await advanceTo(provider.connection, midpoint, "linear midpoint");

    const balanceBefore = await tokenBalance(
      provider.connection,
      aliceClaim.userAta,
    );

    const sig = await program.methods
      .claim(null, null, "Devnet position", "https://example.com/nft.json")
      .accountsPartial({
        user: alice.publicKey,
        collection: accounts.collection,
        updateAuthority: accounts.updateAuthority,
        mint,
        campaignAta: accounts.campaignAta,
        userAta: aliceClaim.userAta,
        campaign: accounts.campaign,
        asset: aliceClaim.asset,
        claimReceipt: aliceClaim.claimReceipt,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: FIRST_CLAIM_CU }),
      ])
      .signers([alice])
      .rpc();

    await confirmTx(provider.connection, sig, "subsequent claim");

    const balanceAfter = await tokenBalance(
      provider.connection,
      aliceClaim.userAta,
    );
    expect(balanceAfter > balanceBefore).to.be.true;
  });
});
