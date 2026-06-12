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

    // Clamp to the campaign end so post-end claims vest exactly 100%.
    let now = now.min(campaign.end);

    // u128 intermediates: `allocation * bps` and `linear * elapsed` can
    // overflow u64 for large allocations over long vesting windows.
    let cliff_amount = (allocation as u128)
        .checked_mul(campaign.cliff_release_bps as u128)
        .ok_or(ErrorCode::MathError)?
        / 10_000;
    let cliff_amount = cliff_amount as u64;

    let linear_amount = allocation.saturating_sub(cliff_amount);
    let vesting_window = (campaign.end - cliff_end) as u64;

    let linear_vested = if vesting_window == 0 {
        linear_amount
    } else {
        let vested = (linear_amount as u128)
            .checked_mul((now - cliff_end) as u128)
            .ok_or(ErrorCode::MathError)?
            / vesting_window as u128;
        vested as u64
    };

    let total_vested = cliff_amount
        .checked_add(linear_vested)
        .ok_or(ErrorCode::MathError)?
        .min(allocation);

    Ok(total_vested.saturating_sub(claimed_so_far))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn campaign(start: i64, end: i64, cliff_duration: u64, cliff_release_bps: u16) -> Campaign {
        Campaign {
            creator: Pubkey::default(),
            merkle_root: [0; 32],
            start,
            end,
            cliff_duration,
            cliff_release_bps,
            mint_to_distribute: Pubkey::default(),
            is_transferable: true,
            grace_period: 0,
            total_deposit: 0,
            collection: Pubkey::default(),
            campaign_bump: 0,
            collection_bump: 0,
            auth_bump: 0,
        }
    }

    /// `allocation * elapsed` would overflow u64 (~5.8e29); u128 math must not.
    #[test]
    fn huge_allocation_over_long_window_does_not_overflow() {
        // 4-year vesting window in seconds.
        let window: i64 = 4 * 365 * 86_400;
        let c = campaign(0, window, 0, 0);
        let allocation = u64::MAX / 2;

        // Halfway through: exactly half vested (integer division).
        let halfway = compute_claimable(&c, window / 2, allocation, 0).unwrap();
        assert_eq!(halfway, allocation / 2);

        // Fully vested at end.
        assert_eq!(
            compute_claimable(&c, window, allocation, 0).unwrap(),
            allocation
        );
    }

    /// `allocation * bps` would overflow u64 for allocations above ~1.8e15.
    #[test]
    fn huge_allocation_cliff_bps_does_not_overflow() {
        let c = campaign(0, 100, 10, 5_000);
        let allocation = u64::MAX;
        let claimable = compute_claimable(&c, 10, allocation, 0).unwrap();
        assert_eq!(claimable, allocation / 2);
    }

    /// Claims far past `end` vest exactly 100%, never more.
    #[test]
    fn post_end_claim_caps_at_allocation() {
        let c = campaign(0, 100, 0, 1_000);
        let allocation = 1_000_000;
        assert_eq!(
            compute_claimable(&c, i64::MAX, allocation, 0).unwrap(),
            allocation
        );
    }

    #[test]
    fn before_cliff_nothing_vests() {
        let c = campaign(0, 100, 50, 1_000);
        assert_eq!(compute_claimable(&c, 49, 1_000_000, 0).unwrap(), 0);
    }

    #[test]
    fn claimed_so_far_is_subtracted() {
        let c = campaign(0, 100, 0, 0);
        assert_eq!(compute_claimable(&c, 50, 1_000, 400).unwrap(), 100);
    }
}
