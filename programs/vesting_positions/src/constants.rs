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

/// TODO: would it be better to have less attributes but with the same data encoded
/// ie: something like 
///     schedule -> (start, end, grace)
///     cliff -> (duration, bps)

// Collection Attributes plugin — shared schedule + token (read once per campaign).
pub const COL_ATTR_MINT: &str = "mint";
pub const COL_ATTR_START: &str = "start";
pub const COL_ATTR_END: &str = "end";
pub const COL_ATTR_CLIFF_DURATION: &str = "cliff_duration";
pub const COL_ATTR_CLIFF_RELEASE_BPS: &str = "cliff_release_bps";
pub const COL_ATTR_GRACE_PERIOD: &str = "grace_period";

// Asset Attributes plugin — per-position state only.
pub const ATTR_ALLOCATION: &str = "allocation";
pub const ATTR_CLAIMED: &str = "claimed_so_far";
pub const ATTR_ORIGINAL_RECIPIENT: &str = "original_recipient";
