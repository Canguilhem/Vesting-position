import { getCreateAccountInstruction } from "@solana-program/system";
import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getInitializeMint2Instruction,
  getMintSize,
  getMintToCheckedInstruction,
} from "@solana-program/token";
import {
  getMinimumBalanceForRentExemption,
  none,
  type Instruction,
  type TransactionSigner,
} from "@solana/kit";
import { type KeyPairSigner } from "@solana/signers";
import {
  SYSTEM_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
} from "./constants";

export type MintSetupParams = {
  /** Connected wallet signer — one instance for payer + mint authority. */
  authority: TransactionSigner;
  mintSigner: KeyPairSigner;
  decimals: number;
  amount: bigint;
};

export async function buildMintSetupInstructions(
  params: MintSetupParams,
): Promise<Instruction[]> {
  const { authority, mintSigner, decimals, amount } = params;
  const owner = authority.address;

  const createMintAccountIx = getCreateAccountInstruction(
    {
      payer: authority,
      newAccount: mintSigner,
      lamports: getMinimumBalanceForRentExemption(BigInt(getMintSize())),
      space: getMintSize(),
      programAddress: TOKEN_PROGRAM_ADDRESS,
    },
    { programAddress: SYSTEM_PROGRAM_ADDRESS },
  );

  const initializeMintIx = getInitializeMint2Instruction(
    {
      mint: mintSigner.address,
      decimals,
      mintAuthority: owner,
      freezeAuthority: none(),
    },
    { programAddress: TOKEN_PROGRAM_ADDRESS },
  );

  const [creatorAta] = await findAssociatedTokenPda({
    owner,
    mint: mintSigner.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  const createAtaIx = getCreateAssociatedTokenIdempotentInstruction(
    {
      payer: authority,
      ata: creatorAta,
      owner,
      mint: mintSigner.address,
      systemProgram: SYSTEM_PROGRAM_ADDRESS,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    },
    { programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS },
  );

  const mintToIx = getMintToCheckedInstruction(
    {
      mint: mintSigner.address,
      token: creatorAta,
      mintAuthority: authority,
      amount,
      decimals,
    },
    { programAddress: TOKEN_PROGRAM_ADDRESS },
  );

  return [createMintAccountIx, initializeMintIx, createAtaIx, mintToIx];
}

export type { KeyPairSigner };
