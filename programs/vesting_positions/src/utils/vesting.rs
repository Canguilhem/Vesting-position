use anchor_lang::prelude::*;

use crate::{error::ErrorCode, state::Campaign};

pub fn compute_claimable(
    campaign: &Campaign,
    now: i64,
    allocation: u64,
    claimed_so_far: u64,
) -> Result<u64> {
    let cliff_end = campaign
        .start
        .checked_add(campaign.cliff_duration as i64)
        .ok_or(ErrorCode::MathError)?;

    if now < cliff_end {
        return Ok(0);
    }

    let cliff_amount = allocation
        .checked_mul(campaign.cliff_release_bps as u64)
        .ok_or(ErrorCode::MathError)?
        / 10_000;

    let linear_amount = allocation.saturating_sub(cliff_amount);
    let vesting_window = (campaign.end - cliff_end) as u64;

    let linear_vested = if vesting_window == 0 {
        linear_amount
    } else {
        linear_amount
            .checked_mul((now - cliff_end) as u64)
            .ok_or(ErrorCode::MathError)?
            / vesting_window
    };

    let total_vested = cliff_amount
        .checked_add(linear_vested)
        .ok_or(ErrorCode::MathError)?
        .min(allocation);

    Ok(total_vested.saturating_sub(claimed_so_far))
}
