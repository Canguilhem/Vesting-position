import { address, type Address } from "@solana/addresses";

/** mpl-core Key::AssetV1 */
const ASSET_V1_KEY = 1;
/** UpdateAuthority::Collection */
const UPDATE_AUTH_COLLECTION = 2;

const ATTR_ALLOCATION = "allocation";
const ATTR_CLAIMED = "claimed_so_far";
const ATTR_ORIGINAL_RECIPIENT = "original_recipient";

export type ParsedPositionAttributes = {
  allocation: bigint;
  claimedSoFar: bigint;
  originalRecipient: Address;
};

function readPubkey(data: Uint8Array, offset: number): Address | null {
  if (offset + 32 > data.length) return null;
  const slice = data.slice(offset, offset + 32);
  try {
    return address(encodeBase58(slice));
  } catch {
    return null;
  }
}

/** Minimal base58 encode for 32-byte pubkeys (no dependency). */
const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function encodeBase58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;

  const digits = [0];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  let result = "";
  for (let i = 0; i < zeros; i++) result += "1";
  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]];
  }
  return result;
}

export function parseAssetOwner(data: Uint8Array): Address | null {
  if (data.length < 33 || data[0] !== ASSET_V1_KEY) return null;
  return readPubkey(data, 1);
}

export function parseAssetCollection(data: Uint8Array): Address | null {
  if (data.length < 66 || data[0] !== ASSET_V1_KEY) return null;
  if (data[33] !== UPDATE_AUTH_COLLECTION) return null;
  return readPubkey(data, 34);
}

/** Scrape vesting attribute strings from mpl-core asset account bytes. */
export function parsePositionAttributes(
  data: Uint8Array,
): ParsedPositionAttributes | null {
  const allocation = scrapeNumericAttribute(data, ATTR_ALLOCATION);
  const claimedSoFar = scrapeNumericAttribute(data, ATTR_CLAIMED);
  const originalRecipient = scrapePubkeyAttribute(data, ATTR_ORIGINAL_RECIPIENT);

  if (
    allocation == null ||
    claimedSoFar == null ||
    originalRecipient == null
  ) {
    return null;
  }

  return { allocation, claimedSoFar, originalRecipient };
}

function scrapeNumericAttribute(data: Uint8Array, key: string): bigint | null {
  const value = scrapeStringAttributeValue(data, key);
  if (value == null || !/^\d+$/.test(value)) return null;
  return BigInt(value);
}

function scrapePubkeyAttribute(data: Uint8Array, key: string): Address | null {
  const value = scrapeStringAttributeValue(data, key);
  if (!value) return null;
  try {
    return address(value);
  } catch {
    return null;
  }
}

/**
 * Find a borsh-encoded string key in account data and read the following string value.
 */
function scrapeStringAttributeValue(
  data: Uint8Array,
  key: string,
): string | null {
  const keyBytes = new TextEncoder().encode(key);

  for (let i = 0; i <= data.length - keyBytes.length - 8; i++) {
    if (!keyBytes.every((b, j) => data[i + j] === b)) continue;

    const afterKey = i + keyBytes.length;
    const valueLen = readU32LE(data, afterKey);
    if (valueLen == null || valueLen <= 0 || valueLen > 128) continue;

    const valueStart = afterKey + 4;
    if (valueStart + valueLen > data.length) continue;

    const value = new TextDecoder().decode(
      data.slice(valueStart, valueStart + valueLen),
    );
    if (value.length > 0) return value;
  }

  return null;
}

function readU32LE(data: Uint8Array, offset: number): number | null {
  if (offset + 4 > data.length) return null;
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  );
}

export function isVestingPositionAsset(data: Uint8Array): boolean {
  return parsePositionAttributes(data) != null;
}
