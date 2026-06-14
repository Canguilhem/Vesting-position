import fs from "fs";
import path from "path";

import * as anchor from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

// ── constants ────────────────────────────────────────────────────────────────

export const PROGRAM_ID = new PublicKey(
  "4hAzFNAWaGZ5YpbRkSsfLNnQ3JXenkb3hAQ19nL7vTH3",
);

export const MPL_CORE_PROGRAM_ID = new PublicKey(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d",
);

const SEED_COLLECTION = Buffer.from("collection");
const SEED_UPDATE_AUTH = Buffer.from("update_authority");
const SEED_CAMPAIGN = Buffer.from("campaign");
const SEED_CLAIM = Buffer.from("claim");
const SEED_ASSET = Buffer.from("asset");

export const MOCK_ALLOC = 1_000_000_000_000n;
export const TOTAL_DEPOSIT = 10n * MOCK_ALLOC;
export const FIRST_CLAIM_CU = 250_000;

const MERKLE_FIXTURE =
  "programs/vesting_positions/tests/fixtures/merkle_proofs.json";
export const WHITELISTED_1_KEYPAIR =
  "programs/vesting_positions/tests/fixtures/keypairs/whitelisted_1.json";

export const commitment = "confirmed";

// ── fixtures ─────────────────────────────────────────────────────────────────

export function loadKeypair(filePath: string): Keypair {
  const bytes = JSON.parse(
    fs.readFileSync(path.resolve(filePath), "utf8"),
  ) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

interface MerkleEntry {
  amount: string;
  proofs: string[];
}

interface MerkleFixture {
  merkleRoot: string;
  [pubkey: string]: MerkleEntry[] | string;
}

function parseProofHex(hex: string): number[] {
  const stripped = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes: number[] = [];
  for (let i = 0; i < stripped.length; i += 2) {
    bytes.push(parseInt(stripped.slice(i, i + 2), 16));
  }
  if (bytes.length !== 33) {
    throw new Error(`expected 33-byte proof, got ${bytes.length}`);
  }
  return bytes;
}

export function loadMerkleFixture(fixturePath: string = MERKLE_FIXTURE): {
  root: Buffer;
  getProofs: (user: PublicKey) => { allocation: bigint; proofs: number[][] };
} {
  const raw = JSON.parse(
    fs.readFileSync(path.resolve(fixturePath), "utf8"),
  ) as MerkleFixture;

  const root = Buffer.from(raw.merkleRoot, "hex");
  const data = new Map<string, MerkleEntry[]>();
  for (const [key, value] of Object.entries(raw)) {
    if (key === "merkleRoot") continue;
    data.set(key.toLowerCase(), value as MerkleEntry[]);
  }

  return {
    root,
    getProofs(user: PublicKey) {
      const entries = data.get(user.toBase58().toLowerCase());
      if (!entries?.length) {
        throw new Error(`no merkle entry for ${user.toBase58()}`);
      }
      const entry = entries[0];
      return {
        allocation: BigInt(entry.amount),
        proofs: entry.proofs.map(parseProofHex),
      };
    },
  };
}

// ── PDAs ─────────────────────────────────────────────────────────────────────

function ata(
  owner: PublicKey,
  mint: PublicKey,
  tokenProgram: PublicKey,
): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, true, tokenProgram);
}

export interface VestingAccounts {
  creator: PublicKey;
  mint: PublicKey;
  merkleRoot: Buffer;
  collection: PublicKey;
  updateAuthority: PublicKey;
  campaign: PublicKey;
  campaignAta: PublicKey;
  creatorAta: PublicKey;
  tokenProgram: PublicKey;
}

export function deriveVestingAccounts(
  creator: PublicKey,
  mint: PublicKey,
  merkleRoot: Buffer,
  tokenProgram: PublicKey,
): VestingAccounts {
  const collection = PublicKey.findProgramAddressSync(
    [SEED_COLLECTION, creator.toBuffer(), mint.toBuffer(), merkleRoot],
    PROGRAM_ID,
  )[0];
  const updateAuthority = PublicKey.findProgramAddressSync(
    [SEED_UPDATE_AUTH, collection.toBuffer()],
    PROGRAM_ID,
  )[0];
  const campaign = PublicKey.findProgramAddressSync(
    [SEED_CAMPAIGN, collection.toBuffer()],
    PROGRAM_ID,
  )[0];
  return {
    creator,
    mint,
    merkleRoot,
    collection,
    updateAuthority,
    campaign,
    campaignAta: ata(campaign, mint, tokenProgram),
    creatorAta: ata(creator, mint, tokenProgram),
    tokenProgram,
  };
}

export interface ClaimerAccounts {
  user: PublicKey;
  userAta: PublicKey;
  claimReceipt: PublicKey;
  asset: PublicKey;
}

export function deriveClaimerAccounts(
  base: VestingAccounts,
  user: PublicKey,
): ClaimerAccounts {
  return {
    user,
    userAta: ata(user, base.mint, base.tokenProgram),
    claimReceipt: PublicKey.findProgramAddressSync(
      [SEED_CLAIM, base.campaign.toBuffer(), user.toBuffer()],
      PROGRAM_ID,
    )[0],
    asset: PublicKey.findProgramAddressSync(
      [SEED_ASSET, base.campaign.toBuffer(), user.toBuffer()],
      PROGRAM_ID,
    )[0],
  };
}

// ── token setup ──────────────────────────────────────────────────────────────

export async function createMintWithDeposit(
  connection: Connection,
  payer: Keypair,
  decimals: number,
  depositAmount: bigint,
): Promise<{ mint: PublicKey; creatorAta: PublicKey; tokenProgram: PublicKey }> {
  const tokenProgram = TOKEN_PROGRAM_ID;
  const mintKeypair = Keypair.generate();
  const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

  const createMintTx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports,
      programId: tokenProgram,
    }),
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      decimals,
      payer.publicKey,
      null,
      tokenProgram,
    ),
  );
  await sendAndConfirmTransaction(connection, createMintTx, [payer, mintKeypair]);

  const creatorAta = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    payer.publicKey,
    false,
    tokenProgram,
  );

  const setupAtaTx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      payer.publicKey,
      creatorAta,
      payer.publicKey,
      mintKeypair.publicKey,
      tokenProgram,
    ),
    createMintToInstruction(
      mintKeypair.publicKey,
      creatorAta,
      payer.publicKey,
      depositAmount,
      [],
      tokenProgram,
    ),
  );
  await sendAndConfirmTransaction(connection, setupAtaTx, [payer]);

  return { mint: mintKeypair.publicKey, creatorAta, tokenProgram };
}

export async function tokenBalance(
  connection: Connection,
  ataAddress: PublicKey,
): Promise<bigint> {
  const account = await connection.getAccountInfo(ataAddress);
  if (account === null) return 0n;
  const info = await connection.getTokenAccountBalance(ataAddress);
  return BigInt(info.value.amount);
}

// ── schedule / time ────────────────────────────────────────────────────────────

/** Build a schedule relative to wall clock (`initialize` requires `now < start`). */
export function devnetSchedule(opts?: {
  startDelaySec?: number;
  durationSec?: number;
  cliffSec?: number;
  graceSec?: number;
  cliffReleaseBps?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const startDelaySec = opts?.startDelaySec ?? 20;
  const durationSec = opts?.durationSec ?? 90;
  const start = now + startDelaySec;
  return {
    start,
    end: start + durationSec,
    cliffDuration: opts?.cliffSec ?? 15,
    gracePeriod: opts?.graceSec ?? 3600,
    cliffReleaseBps: opts?.cliffReleaseBps ?? 1000,
  };
}

export const isDevnet = (connection: Connection): boolean =>
  connection.rpcEndpoint.includes("devnet");

export async function advanceTime(params: {
  absoluteEpoch?: number;
  absoluteSlot?: number;
  absoluteTimestamp?: number;
}): Promise<void> {
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const rpcRes = await fetch(provider.connection.rpcEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "surfnet_timeTravel",
      params: [params],
    }),
  });
  const result = (await rpcRes.json()) as { error?: unknown; result?: unknown };
  if (result.error) {
    throw new Error(`Time travel failed: ${JSON.stringify(result.error)}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

export async function waitUntil(
  connection: Connection,
  timestamp: number,
  label = "timestamp",
): Promise<void> {
  const slot = await connection.getSlot("confirmed");
  const now =
    (await connection.getBlockTime(slot)) ?? Math.floor(Date.now() / 1000);
  const deadline =
    Date.now() + Math.max(120_000, (timestamp - now + 30) * 1000);

  while (Date.now() < deadline) {
    const currentSlot = await connection.getSlot("confirmed");
    const blockTime = await connection.getBlockTime(currentSlot);
    if (blockTime !== null && blockTime >= timestamp) {
      console.log(`[wait] reached ${label}=${timestamp} (chain=${blockTime})`);
      return;
    }
    console.log(
      `[wait] ${label}=${timestamp} chain=${blockTime ?? "?"} — sleeping 3s`,
    );
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  throw new Error(`timed out waiting for ${label}=${timestamp}`);
}

export async function advanceTo(
  connection: Connection,
  timestamp: number,
  label: string,
): Promise<void> {
  if (isDevnet(connection)) {
    await waitUntil(connection, timestamp, label);
    return;
  }
  await advanceTime({ absoluteTimestamp: timestamp * 1000 });
}

// ── wallet / RPC helpers ─────────────────────────────────────────────────────

export const fundWallets = async (
  provider: anchor.AnchorProvider,
  wallets: PublicKey[],
) => {
  if (!isDevnet(provider.connection)) {
    await Promise.all(
      wallets.map((walletPk) =>
        provider.connection.requestAirdrop(
          walletPk,
          10 * anchor.web3.LAMPORTS_PER_SOL,
        ),
      ),
    );
  }
  await checkSolBalance(provider, wallets, 9);
};

export const fundWalletFromPayer = async (
  connection: Connection,
  payer: Keypair,
  recipient: PublicKey,
  minLamports: number,
): Promise<void> => {
  const balance = await connection.getBalance(recipient);
  if (balance >= minLamports) return;

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient,
      lamports: minLamports - balance + 500_000,
    }),
  );
  await sendAndConfirmTransaction(connection, tx, [payer], { commitment });
};

export const checkSolBalance = async (
  provider: anchor.AnchorProvider,
  pubKeys: PublicKey[],
  decimals = 9,
) => {
  for (const walletPk of pubKeys) {
    const balance = await provider.connection.getBalance(walletPk);
    console.log(
      `${walletPk.toBase58().slice(0, 6)} balance: ${formatTokens(
        balance.toString(),
        decimals,
      )}`,
    );
  }
};

export const confirmTx = async (
  connection: Connection,
  signature: string,
  operationLabel: string,
) => {
  const latestBlockHash = await connection.getLatestBlockhash();
  await connection.confirmTransaction(
    { signature, ...latestBlockHash },
    commitment,
  );
  console.log(`${operationLabel} signature: ${signature}`);
};

const formatTokens = (amount: string, decimals = 6) =>
  (Number(amount) / 10 ** decimals).toLocaleString();
