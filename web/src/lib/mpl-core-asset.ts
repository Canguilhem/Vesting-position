import { address, type Address } from "@solana/addresses";

/** mpl-core Key::AssetV1 */
const ASSET_V1_KEY = 1;
/** mpl-core Key::PluginHeaderV1 / PluginRegistryV1 */
const PLUGIN_HEADER_V1_KEY = 3;
const PLUGIN_REGISTRY_V1_KEY = 4;
/** mpl-core PluginType::PermanentFreezeDelegate */
const PERMANENT_FREEZE_DELEGATE_TYPE = 5;
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

function readU64LE(data: Uint8Array, offset: number): number | null {
  if (offset + 8 > data.length) return null;
  let value = 0;
  for (let i = 0; i < 8; i++) {
    value += data[offset + i]! * 2 ** (8 * i);
  }
  return value;
}

function skipBorshString(data: Uint8Array, offset: number): number | null {
  const len = readU32LE(data, offset);
  if (len == null || len < 0) return null;
  const end = offset + 4 + len;
  if (end > data.length) return null;
  return end;
}

function skipPluginAuthority(data: Uint8Array, offset: number): number | null {
  const variant = data[offset];
  if (variant == null) return null;
  if (variant === 0 || variant === 1 || variant === 2) return offset + 1;
  if (variant === 3) return offset + 1 + 32;
  return null;
}

function serializedBaseAssetV1Length(data: Uint8Array): number | null {
  if (data[0] !== ASSET_V1_KEY) return null;

  let offset = 1 + 32;
  const updateAuthority = data[offset];
  if (updateAuthority == null) return null;
  offset += 1;
  if (updateAuthority === 1 || updateAuthority === 2) offset += 32;
  else if (updateAuthority !== 0) return null;

  offset = skipBorshString(data, offset) ?? -1;
  if (offset < 0) return null;
  offset = skipBorshString(data, offset) ?? -1;
  if (offset < 0) return null;

  const seqTag = data[offset];
  if (seqTag === 0) return offset + 1;
  if (seqTag === 1) return offset + 1 + 8;
  return null;
}

/** Read asset-level PermanentFreezeDelegate.frozen, if the plugin exists. */
export function parseAssetPermanentFreezeFrozen(
  data: Uint8Array,
): boolean | null {
  const baseLen = serializedBaseAssetV1Length(data);
  if (baseLen == null || baseLen + 9 > data.length) return null;
  if (data[baseLen] !== PLUGIN_HEADER_V1_KEY) return null;

  const registryOffset = readU64LE(data, baseLen + 1);
  if (registryOffset == null || registryOffset >= data.length) return null;
  if (data[registryOffset] !== PLUGIN_REGISTRY_V1_KEY) return null;

  let offset = registryOffset + 1;
  const registrySize = readU32LE(data, offset);
  if (registrySize == null) return null;
  offset += 4;

  for (let i = 0; i < registrySize; i++) {
    const pluginType = data[offset];
    if (pluginType == null) return null;
    offset += 1;

    const afterAuthority = skipPluginAuthority(data, offset);
    if (afterAuthority == null) return null;

    const pluginOffset = readU64LE(data, afterAuthority);
    if (pluginOffset == null) return null;
    offset = afterAuthority + 8;

    if (pluginType !== PERMANENT_FREEZE_DELEGATE_TYPE) continue;
    if (pluginOffset + 2 > data.length) return null;
    if (data[pluginOffset] !== PERMANENT_FREEZE_DELEGATE_TYPE) return null;
    return data[pluginOffset + 1] === 1;
  }

  return null;
}

/** Whether transfers are blocked for this position NFT. */
export function isPositionFrozen(
  data: Uint8Array,
  isTransferableCampaign: boolean,
): boolean {
  const assetFrozen = parseAssetPermanentFreezeFrozen(data);
  if (assetFrozen != null) return assetFrozen;
  return !isTransferableCampaign;
}

export function isVestingPositionAsset(data: Uint8Array): boolean {
  return parsePositionAttributes(data) != null;
}
