use anchor_lang::prelude::*;

#[constant]
pub const UPDATE_AUTH: &[u8] = b"update_authority";

#[constant]
pub const COLLECTION: &[u8] = b"collection";

#[constant]
pub const CAMPAIGN: &[u8] = b"campaign";

#[constant]
pub const CLAIM: &[u8] = b"claim";

#[constant]
pub const ASSET: &[u8] = b"asset";

pub const ATTR_ALLOCATION: &str = "allocation";
pub const ATTR_CLAIMED: &str = "claimed_so_far";
pub const ATTR_LAST_CLAIM: &str = "last_claim_timestamp";
pub const ATTR_CAMPAIGN: &str = "campaign";
pub const ATTR_ORIGINAL_RECIPIENT: &str = "original_recipient";
pub const ATTR_MINT: &str = "mint";
