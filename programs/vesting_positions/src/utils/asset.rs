use anchor_lang::prelude::*;
use mpl_core::types::{Attribute, Attributes};

use crate::{
    constants::{
        ATTR_ALLOCATION, ATTR_CAMPAIGN, ATTR_CLAIMED, ATTR_LAST_CLAIM, ATTR_MINT,
        ATTR_ORIGINAL_RECIPIENT,
    },
    error::ErrorCode,
};

#[derive(Clone, Copy, Debug)]
pub struct Position {
    pub allocation: u64,
    pub claimed_so_far: u64,
    pub original_recipient: Pubkey,
}

impl Position {
    pub fn new(allocation: u64, original_recipient: Pubkey) -> Self {
        Self {
            allocation,
            claimed_so_far: 0,
            original_recipient,
        }
    }

    pub fn from_attributes(attrs: &Attributes) -> Result<Self> {
        Ok(Self {
            allocation: get_attr_u64(attrs, ATTR_ALLOCATION)?,
            claimed_so_far: get_attr_u64(attrs, ATTR_CLAIMED)?,
            original_recipient: get_attr_pubkey(attrs, ATTR_ORIGINAL_RECIPIENT)?,
        })
    }
}

pub fn get_attr_u64(attrs: &Attributes, key: &str) -> Result<u64> {
    let value = attrs
        .attribute_list
        .iter()
        .find(|a| a.key == key)
        .ok_or(ErrorCode::AttributeMissing)?
        .value
        .parse::<u64>()
        .map_err(|_| ErrorCode::InvalidAttribute)?;
    Ok(value)
}

pub fn get_attr_pubkey(attrs: &Attributes, key: &str) -> Result<Pubkey> {
    let value = attrs
        .attribute_list
        .iter()
        .find(|a| a.key == key)
        .ok_or(ErrorCode::AttributeMissing)?
        .value
        .parse::<Pubkey>()
        .map_err(|_| ErrorCode::InvalidAttribute)?;
    Ok(value)
}

pub fn build_position_attributes(
    allocation: u64,
    claimed_so_far: u64,
    now: i64,
    campaign: &Pubkey,
    original_recipient: &Pubkey,
    mint: &Pubkey,
) -> Attributes {
    Attributes {
        attribute_list: vec![
            Attribute {
                key: ATTR_ALLOCATION.into(),
                value: allocation.to_string(),
            },
            Attribute {
                key: ATTR_CLAIMED.into(),
                value: claimed_so_far.to_string(),
            },
            Attribute {
                key: ATTR_LAST_CLAIM.into(),
                value: now.to_string(),
            },
            Attribute {
                key: ATTR_CAMPAIGN.into(),
                value: campaign.to_string(),
            },
            Attribute {
                key: ATTR_ORIGINAL_RECIPIENT.into(),
                value: original_recipient.to_string(),
            },
            Attribute {
                key: ATTR_MINT.into(),
                value: mint.to_string(),
            },
        ],
    }
}
