import {
  getAddressEncoder,
  getBytesEncoder,
  getProgramDerivedAddress,
  type Address,
} from "@solana/kit";
import { VESTING_POSITIONS_PROGRAM_ADDRESS } from "../generated/vesting-positions/src/generated/programs/vestingPositions";

const enc = getAddressEncoder();

/** Asset PDA: ["asset", campaign, original_recipient] */
export async function findAssetPda(seeds: {
  campaign: Address;
  user: Address;
}): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: VESTING_POSITIONS_PROGRAM_ADDRESS,
    seeds: [
      getBytesEncoder().encode(new TextEncoder().encode("asset")),
      enc.encode(seeds.campaign),
      enc.encode(seeds.user),
    ],
  });
  return pda;
}