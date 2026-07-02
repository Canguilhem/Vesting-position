/**
 * FIXME
 * Browser-safe program error decoding.
 *
 * Do NOT import `generated/errors/vestingPositions.ts` in the web bundle — Codama
 * gates messages behind `process.env.NODE_ENV`, which crashes in the browser.
 * Error codes + messages mirror that file; re-sync after `npm run codegen`.
 *
 * @see web/src/generated/vesting-positions/src/generated/errors/vestingPositions.ts
 */

export const VESTING_POSITIONS_ERROR__INVALID_TIMELINE = 0x1770;
export const VESTING_POSITIONS_ERROR__INVALID_UPDATE_AUTHORITY = 0x1771;
export const VESTING_POSITIONS_ERROR__INVALID_CLIFF_DURATION = 0x1772;
export const VESTING_POSITIONS_ERROR__INVALID_CLIFF_B_P_S = 0x1773;
export const VESTING_POSITIONS_ERROR__MATH_ERROR = 0x1774;
export const VESTING_POSITIONS_ERROR__INVALID_DEPOSIT = 0x1775;
export const VESTING_POSITIONS_ERROR__INVALID_MINT = 0x1776;
export const VESTING_POSITIONS_ERROR__INVALID_COLLECTION = 0x1777;
export const VESTING_POSITIONS_ERROR__UNAUTHORIZED = 0x1778;
export const VESTING_POSITIONS_ERROR__PROOFS_MISSING = 0x1779;
export const VESTING_POSITIONS_ERROR__ALLOCATIONS_MISSING = 0x177a;
export const VESTING_POSITIONS_ERROR__INVALID_ALLOCATION = 0x177b;
export const VESTING_POSITIONS_ERROR__ALREADY_CLAIMED = 0x177c;
export const VESTING_POSITIONS_ERROR__INVALID_PROOFS = 0x177d;
export const VESTING_POSITIONS_ERROR__ASSET_NOT_FOUND = 0x177e;
export const VESTING_POSITIONS_ERROR__INVALID_ASSET = 0x177f;
export const VESTING_POSITIONS_ERROR__NOT_ASSET_OWNER = 0x1780;
export const VESTING_POSITIONS_ERROR__ATTRIBUTE_MISSING = 0x1781;
export const VESTING_POSITIONS_ERROR__ATTRIBUTES_NOT_FOUND = 0x1782;
export const VESTING_POSITIONS_ERROR__INVALID_ATTRIBUTE = 0x1783;
export const VESTING_POSITIONS_ERROR__ALREADY_FULLY_CLAIMED = 0x1784;
export const VESTING_POSITIONS_ERROR__INSUFFICIENT_VAULT_BALANCE = 0x1785;
export const VESTING_POSITIONS_ERROR__GRACE_PERIOD_NOT_OVER = 0x1786;
export const VESTING_POSITIONS_ERROR__VAULT_NOT_EMPTY = 0x1787;
export const VESTING_POSITIONS_ERROR__CAMPAIGN_HAS_POSITIONS = 0x1788;
export const VESTING_POSITIONS_ERROR__CLAIM_WINDOW_CLOSED = 0x1789;
export const VESTING_POSITIONS_ERROR__CAMPAIGN_NOT_STARTED = 0x178a;
export const VESTING_POSITIONS_ERROR__FREEZE_PLUGIN_MISSING = 0x178b;
export const VESTING_POSITIONS_ERROR__CAMPAIGN_STILL_ACTIVE = 0x178c;

export type VestingPositionsErrorCode =
  (typeof VESTING_POSITIONS_ERROR_MESSAGES)[number][0];

const VESTING_POSITIONS_ERROR_MESSAGES = [
  [VESTING_POSITIONS_ERROR__INVALID_TIMELINE, "Invalid timeline"],
  [
    VESTING_POSITIONS_ERROR__INVALID_UPDATE_AUTHORITY,
    "Invalid update authority",
  ],
  [VESTING_POSITIONS_ERROR__INVALID_CLIFF_DURATION, "Invalid cliff duration"],
  [VESTING_POSITIONS_ERROR__INVALID_CLIFF_B_P_S, "Invalid cliff bps"],
  [VESTING_POSITIONS_ERROR__MATH_ERROR, "Maths error"],
  [VESTING_POSITIONS_ERROR__INVALID_DEPOSIT, "Invalid deposit"],
  [VESTING_POSITIONS_ERROR__INVALID_MINT, "Invalid mint"],
  [VESTING_POSITIONS_ERROR__INVALID_COLLECTION, "Invalid collection"],
  [VESTING_POSITIONS_ERROR__UNAUTHORIZED, "Unauthorized"],
  [VESTING_POSITIONS_ERROR__PROOFS_MISSING, "Proofs are missing"],
  [VESTING_POSITIONS_ERROR__ALLOCATIONS_MISSING, "Allocation is missing"],
  [VESTING_POSITIONS_ERROR__INVALID_ALLOCATION, "Invalid allocation"],
  [VESTING_POSITIONS_ERROR__ALREADY_CLAIMED, "Already claimed"],
  [VESTING_POSITIONS_ERROR__INVALID_PROOFS, "Invalid proofs"],
  [VESTING_POSITIONS_ERROR__ASSET_NOT_FOUND, "Asset not found"],
  [VESTING_POSITIONS_ERROR__INVALID_ASSET, "Invalid asset"],
  [VESTING_POSITIONS_ERROR__NOT_ASSET_OWNER, "Not asset owner"],
  [VESTING_POSITIONS_ERROR__ATTRIBUTE_MISSING, "Attribute is missing"],
  [VESTING_POSITIONS_ERROR__ATTRIBUTES_NOT_FOUND, "Attributes not found"],
  [VESTING_POSITIONS_ERROR__INVALID_ATTRIBUTE, "Invalid attribute"],
  [
    VESTING_POSITIONS_ERROR__ALREADY_FULLY_CLAIMED,
    "Position already fully claimed",
  ],
  [
    VESTING_POSITIONS_ERROR__INSUFFICIENT_VAULT_BALANCE,
    "Insufficient vault balance",
  ],
  [VESTING_POSITIONS_ERROR__GRACE_PERIOD_NOT_OVER, "Grace period not over"],
  [VESTING_POSITIONS_ERROR__VAULT_NOT_EMPTY, "Vault is not empty"],
  [
    VESTING_POSITIONS_ERROR__CAMPAIGN_HAS_POSITIONS,
    "Campaign already minted positions",
  ],
  [VESTING_POSITIONS_ERROR__CLAIM_WINDOW_CLOSED, "Claim window closed"],
  [
    VESTING_POSITIONS_ERROR__CAMPAIGN_NOT_STARTED,
    "Campaign has not started yet",
  ],
  [
    VESTING_POSITIONS_ERROR__FREEZE_PLUGIN_MISSING,
    "Asset has no permanent freeze delegate",
  ],
  [VESTING_POSITIONS_ERROR__CAMPAIGN_STILL_ACTIVE, "Campaign is still active"],
] as const;

const ERROR_MESSAGE_BY_CODE = new Map<number, string>(
  VESTING_POSITIONS_ERROR_MESSAGES.map(([code, message]) => [code, message])
);

const ANCHOR_ERROR_OFFSET = 6000;

const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

function decodeVestingProgramErrorToken(token: string): string | null {
  const hexMatch = token.match(/^0x([0-9a-f]+)$/i);
  if (hexMatch) {
    const raw = Number.parseInt(hexMatch[1], 16);
    if (raw >= ANCHOR_ERROR_OFFSET) {
      return getProgramErrorMessage(raw);
    }
    return null;
  }

  const indexMatch = token.match(/^#(\d+)$/);
  if (indexMatch) {
    return decodeProgramErrorCode(Number(indexMatch[1]));
  }

  return null;
}

function normalizeToProgramErrorCode(raw: number): number | null {
  const code = raw >= ANCHOR_ERROR_OFFSET ? raw : ANCHOR_ERROR_OFFSET + raw;
  return ERROR_MESSAGE_BY_CODE.has(code) ? code : null;
}

export function getProgramErrorMessage(code: number): string | null {
  return ERROR_MESSAGE_BY_CODE.get(code) ?? null;
}

export function decodeProgramErrorCode(raw: number): string | null {
  const code = normalizeToProgramErrorCode(raw);
  return code != null ? getProgramErrorMessage(code) : null;
}

export function decodeCustomProgramErrorMessage(text: string): string | null {
  const hashMatch = text.match(/custom program error: #(\d+)/i);
  if (hashMatch) {
    const raw = Number(hashMatch[1]);
    if (raw >= ANCHOR_ERROR_OFFSET) {
      return getProgramErrorMessage(raw);
    }
    return null;
  }

  const hexMatch = text.match(/custom program error: 0x([0-9a-f]+)/i);
  if (hexMatch) {
    const raw = Number.parseInt(hexMatch[1], 16);
    if (raw >= ANCHOR_ERROR_OFFSET) {
      return getProgramErrorMessage(raw);
    }
    return null;
  }

  const codeMatch = text.match(/Error Code: (\w+)/);
  if (codeMatch) {
    return codeMatch[1].replace(/([A-Z])/g, " $1").trim();
  }

  return null;
}

function extractAlreadyInUseAddress(logs: string[]): string | null {
  for (const line of logs) {
    const match = line.match(
      /already in use[\s\S]*?address:\s*([1-9A-HJ-NP-Za-km-z]{32,44})/i,
    );
    if (match) return match[1];
    const alt = line.match(
      /Allocate: account Address \{ address: ([1-9A-HJ-NP-Za-km-z]{32,44})/,
    );
    if (alt) return alt[1];
  }
  return null;
}

/** Prefer simulation logs — avoids mapping SPL Token #1 to vesting error #1. */
export function parseSimulationLogs(
  logs: string[],
  vestingProgramId: string,
): string | null {
  if (logs.length === 0) return null;

  const joined = logs.join("\n");

  if (/already in use/i.test(joined)) {
    const addr = extractAlreadyInUseAddress(logs);
    return (
      "Campaign already exists for this token + merkle root combination" +
      (addr ? ` (account ${addr})` : "") +
      ". Each unique merkle root can only be initialized once per mint. " +
      "Open the Campaigns tab to view it, or change the merkle root to launch a new one."
    );
  }

  if (/insufficient funds/i.test(joined)) {
    return "Insufficient token balance — campaign deposit exceeds your wallet balance for this mint. Click “Use max”.";
  }

  const vestingFail = [...logs]
    .reverse()
    .find(
      (line) =>
        line.includes(vestingProgramId) &&
        /failed: custom program error/i.test(line),
    );
  if (vestingFail) {
    const tokenMatch = vestingFail.match(
      /custom program error: (0x[0-9a-f]+|#\d+)/i,
    );
    if (tokenMatch) {
      const decoded = decodeVestingProgramErrorToken(tokenMatch[1]);
      if (decoded) return decoded;
    }
  }

  const tokenFail = [...logs]
    .reverse()
    .find(
      (line) =>
        line.includes(TOKEN_PROGRAM_ID) &&
        /failed: custom program error: 0x1/i.test(line),
    );
  if (tokenFail) {
    return "Insufficient token balance — campaign deposit exceeds your wallet balance for this mint. Click “Use max”.";
  }

  return null;
}
