import { address, type Address } from "@solana/addresses";
import { PROGRAM_ID } from "../config";

export const PROGRAM_ADDRESS = address(PROGRAM_ID);

export const MPL_CORE_PROGRAM_ADDRESS = address(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d",
);

export const TOKEN_PROGRAM_ADDRESS = address(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);

export const ASSOCIATED_TOKEN_PROGRAM_ADDRESS = address(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

export const SYSTEM_PROGRAM_ADDRESS = address(
  "11111111111111111111111111111111",
);

/** Headroom applied to simulated units when framework-kit sets the CU limit. */
export const COMPUTE_UNIT_LIMIT_MULTIPLIER = 1.15;

export type { Address };
