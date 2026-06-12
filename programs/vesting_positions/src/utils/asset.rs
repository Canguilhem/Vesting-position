use anchor_lang::prelude::*;
use mpl_core::{
    accounts::{BaseAssetV1, BaseCollectionV1},
    fetch_plugin,
    programs::MPL_CORE_ID,
    types::{Attribute, Attributes, Key, PluginType, UpdateAuthority},
};

use crate::{
    constants::{
        ATTR_ALLOCATION, ATTR_CLAIMED, ATTR_ORIGINAL_RECIPIENT, COL_ATTR_CLIFF_DURATION,
        COL_ATTR_CLIFF_RELEASE_BPS, COL_ATTR_END, COL_ATTR_GRACE_PERIOD, COL_ATTR_MINT,
        COL_ATTR_START,
    },
    error::ErrorCode,
    Campaign,
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
    attrs
        .attribute_list
        .iter()
        .find(|a| a.key == key)
        .ok_or(ErrorCode::AttributeMissing)?
        .value
        .parse::<u64>()
        .map_err(|_| ErrorCode::InvalidAttribute.into())
}

pub fn get_attr_pubkey(attrs: &Attributes, key: &str) -> Result<Pubkey> {
    attrs
        .attribute_list
        .iter()
        .find(|a| a.key == key)
        .ok_or(ErrorCode::AttributeMissing)?
        .value
        .parse::<Pubkey>()
        .map_err(|_| ErrorCode::InvalidAttribute.into())
}

pub fn get_attr_i64(attrs: &Attributes, key: &str) -> Result<i64> {
    attrs
        .attribute_list
        .iter()
        .find(|a| a.key == key)
        .ok_or(ErrorCode::AttributeMissing)?
        .value
        .parse::<i64>()
        .map_err(|_| ErrorCode::InvalidAttribute.into())
}

/// Schedule + token metadata stored once on the collection for marketplace indexing.
/// Campaign PDA is not stored here — derive `PDA(["campaign", collection], program_id)`.
pub fn build_collection_attributes(campaign: &Campaign) -> Attributes {
    Attributes {
        attribute_list: vec![
            Attribute {
                key: COL_ATTR_MINT.into(),
                value: campaign.mint_to_distribute.to_string(),
            },
            Attribute {
                key: COL_ATTR_START.into(),
                value: campaign.start.to_string(),
            },
            Attribute {
                key: COL_ATTR_END.into(),
                value: campaign.end.to_string(),
            },
            Attribute {
                key: COL_ATTR_CLIFF_DURATION.into(),
                value: campaign.cliff_duration.to_string(),
            },
            Attribute {
                key: COL_ATTR_CLIFF_RELEASE_BPS.into(),
                value: campaign.cliff_release_bps.to_string(),
            },
            Attribute {
                key: COL_ATTR_GRACE_PERIOD.into(),
                value: campaign.grace_period.to_string(),
            },
        ],
    }
}

/// Per-position state — pair with collection attributes for full vesting picture.
pub fn build_position_attributes(
    allocation: u64,
    claimed_so_far: u64,
    original_recipient: &Pubkey,
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
                key: ATTR_ORIGINAL_RECIPIENT.into(),
                value: original_recipient.to_string(),
            },
        ],
    }
}

pub fn require_asset_in_collection(
    asset: &UncheckedAccount<'_>,
    collection: &Pubkey,
) -> Result<()> {
    require!(asset.owner == &MPL_CORE_ID, ErrorCode::InvalidAsset);
    let asset =
        BaseAssetV1::from_bytes(&asset.try_borrow_data()?).map_err(|_| ErrorCode::InvalidAsset)?;
    require!(asset.key == Key::AssetV1, ErrorCode::InvalidAsset);
    match &asset.update_authority {
        UpdateAuthority::Collection(addr) if addr == collection => Ok(()),
        _ => Err(ErrorCode::InvalidCollection.into()),
    }
}

pub fn require_collection_matches_campaign(
    collection: &Pubkey,
    attrs: &Attributes,
    campaign: &Campaign,
) -> Result<()> {
    require_keys_eq!(
        campaign.collection,
        *collection,
        ErrorCode::InvalidCollection
    );
    require_keys_eq!(
        get_attr_pubkey(attrs, COL_ATTR_MINT)?,
        campaign.mint_to_distribute,
        ErrorCode::InvalidAsset,
    );
    require!(
        get_attr_i64(attrs, COL_ATTR_START)? == campaign.start,
        ErrorCode::InvalidAttribute
    );
    require!(
        get_attr_i64(attrs, COL_ATTR_END)? == campaign.end,
        ErrorCode::InvalidAttribute
    );
    require!(
        get_attr_u64(attrs, COL_ATTR_CLIFF_DURATION)? == campaign.cliff_duration,
        ErrorCode::InvalidAttribute
    );
    require!(
        get_attr_u64(attrs, COL_ATTR_CLIFF_RELEASE_BPS)? == campaign.cliff_release_bps as u64,
        ErrorCode::InvalidAttribute
    );
    require!(
        get_attr_u64(attrs, COL_ATTR_GRACE_PERIOD)? == campaign.grace_period,
        ErrorCode::InvalidAttribute
    );
    Ok(())
}

pub fn require_vesting_position_attributes(attrs: &Attributes) -> Result<()> {
    let allocation = get_attr_u64(attrs, ATTR_ALLOCATION)?;
    let claimed = get_attr_u64(attrs, ATTR_CLAIMED)?;
    require!(allocation > 0, ErrorCode::InvalidAllocation);
    require!(claimed <= allocation, ErrorCode::InvalidAttribute);
    let _ = get_attr_pubkey(attrs, ATTR_ORIGINAL_RECIPIENT)?;
    Ok(())
}

pub fn load_attributes(asset: &AccountInfo) -> Result<Option<Attributes>> {
    Ok(
        fetch_plugin::<BaseAssetV1, Attributes>(asset, PluginType::Attributes)
            .ok()
            .map(|(_, attrs, _)| attrs),
    )
}

pub fn load_collection_attributes(collection: &AccountInfo) -> Result<Option<Attributes>> {
    Ok(
        fetch_plugin::<BaseCollectionV1, Attributes>(collection, PluginType::Attributes)
            .ok()
            .map(|(_, attrs, _)| attrs),
    )
}
