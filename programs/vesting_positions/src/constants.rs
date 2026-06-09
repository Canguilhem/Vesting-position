use anchor_lang::prelude::*;

#[constant]
pub const UPDATE_AUTH: &[u8] = b"update_authority";

#[constant]
pub const COLLECTION: &[u8] = b"collection";

#[constant]
pub const CAMPAIGN: &[u8] = b"campaign";

pub const ATTR_ALLOCATION: &str = "allocation";
pub const ATTR_CLAIMED: &str = "claimed_so_far";
pub const ATTR_LAST_CLAIM: &str = "last_claim_timestamp";
pub const ATTR_CAMPAIGN: &str = "campaign";
pub const ATTR_ORIGINAL_RECIPIENT: &str = "original_recipient";
pub const ATTR_MINT: &str = "mint";
