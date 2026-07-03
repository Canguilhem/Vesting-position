import { type Address } from "@solana/addresses";
import {
  AccountRole,
  type AccountMeta,
  type AccountSignerMeta,
  type Instruction,
  type TransactionSigner,
} from "@solana/kit";
import {
  MPL_CORE_PROGRAM_ADDRESS,
  SYSTEM_PROGRAM_ADDRESS,
} from "../solana/constants";

/** mpl-core `Instruction::TransferV1` enum variant index. */
const TRANSFER_V1_DISCRIMINATOR = 14;

/** Borsh `None` for `Option<CompressionProof>`. */
const TRANSFER_V1_DATA = new Uint8Array([TRANSFER_V1_DISCRIMINATOR, 0]);

function writableAccount(address: Address): AccountMeta {
  return { address, role: AccountRole.WRITABLE };
}

function readonlyAccount(address: Address): AccountMeta {
  return { address, role: AccountRole.READONLY };
}

function writableSigner(signer: TransactionSigner): AccountSignerMeta {
  return {
    address: signer.address,
    role: AccountRole.WRITABLE_SIGNER,
    signer,
  };
}

function readonlySigner(signer: TransactionSigner): AccountSignerMeta {
  return {
    address: signer.address,
    role: AccountRole.READONLY_SIGNER,
    signer,
  };
}

/**
 * MPL Core TransferV1 — moves a position NFT to a new owner.
 *
 * mpl-core always expects 7 account slots; omitted optional accounts use the
 * program id as a read-only placeholder (same as kinobi `programId` strategy).
 *
 * @see https://github.com/metaplex-foundation/mpl-core/blob/main/programs/mpl-core/src/instruction.rs
 */
export function buildTransferV1Instruction(params: {
  asset: Address;
  collection: Address;
  payer: TransactionSigner;
  authority: TransactionSigner;
  newOwner: Address;
}): Instruction {
  const { asset, collection, payer, authority, newOwner } = params;

  return {
    programAddress: MPL_CORE_PROGRAM_ADDRESS,
    accounts: [
      writableAccount(asset),
      readonlyAccount(collection),
      writableSigner(payer),
      readonlySigner(authority),
      readonlyAccount(newOwner),
      readonlyAccount(SYSTEM_PROGRAM_ADDRESS),
      // log_wrapper — omitted optional, mpl-core placeholder
      readonlyAccount(MPL_CORE_PROGRAM_ADDRESS),
    ],
    data: TRANSFER_V1_DATA,
  };
}
