# Vesting Position Protocol

A Solana program built with Anchor and mpl-core that transforms token vesting allocations into tradeable on-chain NFT Assets. Each vesting position is a first-class on-chain primitive — transferable, composable with DeFi protocols, and readable by any program without offchain indexing.

Built during the [Turbine Builder Cohort](https://turbin3.com) — Q2 2026.

---

## Overview

Token vesting on Solana today is static. Recipients wait out cliff and linear schedules with no optionality, no secondary market, and no composability with the rest of DeFi. Existing solutions treat vesting positions as administrative liabilities rather than assets.

This protocol flips that model. When a recipient first claims, an **mpl-core Asset** is minted to their wallet encoding the full vesting schedule. That Asset is their position — it can be transferred, used as collateral, and read by any on-chain program. Projects get a programmable loyalty primitive. Recipients get optionality.

**What makes it different:**

- Vesting positions are tradeable mpl-core NFT Assets
- Partial claims before transfer — recipient claims X%, sells the rest
- Per-recipient allocation via Merkle tree — different amounts per wallet in the same campaign
- Cliff release percentage configurable per campaign — `0` for pure linear, `10000` for 100% at cliff
- Transferability set at campaign creation and adjustable per collection or per asset afterwards
- Fully claimed positions become permanent loyalty badges — frozen on-chain proof of full vest
- Multiple campaigns per token mint — investor round, team, community all independent

---

## Program Architecture

### Programs

| Program             | Description                                |
| ------------------- | ------------------------------------------ |
| `vesting_positions` | Custom Anchor program — all business logic |
| `mpl-core`          | Asset and Collection lifecycle (CPI)       |
| `SPL Token`         | Fungible token movements (CPI)             |

### Accounts

| Account           | Type           | Seeds                                        | Purpose                                  |
| ----------------- | -------------- | -------------------------------------------- | ---------------------------------------- |
| `Collection`      | PDA / mpl-core | `["collection", creator, mint, merkle_root]` | mpl-core Collection, campaign identity   |
| `UpdateAuthority` | PDA (no data)  | `["update_authority", collection]`           | Signs all mpl-core CPIs                  |
| `Campaign`        | PDA            | `["campaign", collection]`                   | Campaign config and schedule             |
| `Campaign ATA`    | Token account  | ATA owned by Campaign PDA                    | Token vault                              |
| `ClaimReceipt`    | PDA            | `["claim", campaign, claimer]`               | Blocks double first claims               |
| `Asset`           | PDA / mpl-core | `["asset", campaign, original_recipient]`    | Vesting position NFT (one per recipient) |

The Collection PDA seeds include the merkle root, so each campaign is uniquely identified by `(creator, mint, merkle_root)`.

### Campaign fields

```
creator:             Pubkey      // campaign admin, receives clawbacks
merkle_root:         [u8; 32]    // whitelist commitment (see Merkle Tree)
start:               i64         // unix timestamp vesting window opens
end:                 i64         // unix timestamp full vest
cliff_duration:      u64         // seconds after start
cliff_release_bps:   u16         // basis points released at cliff (0-10000)
mint_to_distribute:  Pubkey      // SPL token being distributed
is_transferable:     bool        // mirrors the collection-level freeze state
grace_period:        u64         // seconds after end while claims stay open
total_deposit:       u64         // tokens deposited at initialize
collection:          Pubkey      // mpl-core Collection address
campaign_bump / collection_bump / auth_bump: u8
```

### Collection attributes

Stored on the mpl-core Collection `Attributes` plugin at `initialize` (shared by every position in the campaign):

```
mint:                 Pubkey     // SPL token being vested
start:                i64        // vesting window opens
end:                  i64        // full vest
cliff_duration:       u64        // seconds after start
cliff_release_bps:    u16        // basis points released at cliff
grace_period:         u64        // claim window extension after end
```

Campaign PDA is **not** stored — derive it from the collection:

```
campaign = PDA(["campaign", collection], vesting_positions_program_id)
```

### Asset attributes

Stored on each position's mpl-core `Attributes` plugin (updated on claim):

```
allocation:           u64        // per-recipient amount, from Merkle leaf
claimed_so_far:       u64        // running total claimed
original_recipient:   Pubkey     // wallet that was in the Merkle tree
```

**Marketplace read path:** fetch asset attrs + collection attrs → compute remaining / claimable with the vesting formula. Derive the Campaign PDA only when calling program instructions (claim, clawback, etc.).

Position `name` / `uri` are set per claim (instruction args), not copied from the collection.

---

## Vesting Formula

```
cliff_end = start + cliff_duration
if now < cliff_end          → claimable = 0
now = min(now, end)          // post-end claims vest exactly 100%

cliff_amount  = allocation * cliff_release_bps / 10_000
linear_vested = (allocation - cliff_amount) * (now - cliff_end) / (end - cliff_end)
claimable     = min(cliff_amount + linear_vested, allocation) - claimed_so_far
```

All intermediate multiplications use `u128`, so allocations up to `u64::MAX` over multi-year windows cannot overflow.

**Examples:**

| `cliff_release_bps` | Behavior                               |
| ------------------- | -------------------------------------- |
| `0`                 | Pure linear from cliff to end          |
| `1000`              | 10% at cliff, 90% linear cliff to end  |
| `2500`              | 25% at cliff, 75% linear cliff to end  |
| `10000`             | 100% released at cliff, no linear tail |

---

## Lifecycle & Claim Window

```
            start                    end         end + grace_period
──────────────┃━━━━━━━━━━━━━━━━━━━━━━┃━━━━━━━━━━━━━━┃──────────────────
   no claims  │      claims open (vesting)  claims  │  clawback opens
              │                              open   │  claims closed
```

- `claim` only succeeds inside `[start, end + grace_period)` — before that `CampaignNotStarted`, after that `ClaimWindowClosed`.
- `clawback` / `clawback_unclaimed` only succeed at or after `end + grace_period`.

---

## Instructions

### Campaign lifecycle (creator-gated)

#### `initialize`

Creates the Collection (mpl-core), Campaign PDA, and Campaign ATA, then deposits `total_deposit` upfront. Args: `merkle_root, start, end, cliff_duration, cliff_release_bps, mint_to_distribute, is_transferable, grace_period, total_deposit, name, uri`.

The collection is created with a `PermanentFreezeDelegate` plugin set to `frozen: !is_transferable`. Emits `InitializeEvent`.

#### `cancel_campaign`

Mistake safeguard. Only callable while **no position has ever been minted** (`num_minted == 0`). Returns the entire vault to the creator, closes the Campaign ATA and PDA, and burns the Collection. Emits `CancelEvent`.

#### `close_campaign`

End-of-life teardown. Requires `campaign_ata.amount == 0` — every allocation must be claimed or clawed back first. Closes the Campaign PDA and ATA, returning rent to the creator. The mpl-core Collection stays alive: outstanding loyalty badges keep it non-burnable. Emits `CloseEvent`.

---

### Recipient instructions

#### `claim`

First claim requires a Merkle proof and the recipient's allocation as instruction arguments (`proofs: Option<Vec<[u8; 33]>>, allocation: Option<u64>`). The program recomputes the leaf, walks the proof against `campaign.merkle_root`, mints the position Asset to the signer's PDA, writes a `ClaimReceipt`, and transfers any vested tokens.

Subsequent claims require only Asset ownership — no proof needed (`proofs: None, allocation: None`). Any current holder (including secondary buyers) can claim.

```
First claim:
  require start <= now < end + grace_period
  verify Merkle proof, asset PDA, and unused receipt
  mint mpl-core Asset with attributes
    + PermanentBurnDelegate (always — enables clawback burn)
    + PermanentFreezeDelegate { frozen: false } (transferable campaigns only)
  transfer claimable tokens (0 if before cliff — Asset still minted)

Subsequent claim:
  verify asset.owner == signer and asset belongs to campaign collection
  compute claimable, transfer, update claimed_so_far + last_claim_timestamp

Fully claimed:
  if the Asset carries the freeze plugin → frozen permanently (loyalty badge)
```

#### `close_receipt`

Reclaims a `ClaimReceipt`'s rent. Only allowed once the Campaign PDA itself was closed (`close_campaign` / `cancel_campaign`) — receipts must outlive the claim and clawback flows.

---

### Admin instructions (creator-gated)

#### `freeze_collection(should_freeze)`

Toggles the collection-level `PermanentFreezeDelegate` and syncs `campaign.is_transferable`. Note the mpl-core precedence rule below: positions minted on a transferable campaign carry their own asset-level plugin and are **not** affected by a later collection freeze — use `freeze_asset` for those. Emits `FreezeEvent`.

#### `freeze_asset(should_freeze)`

Per-asset transfer pause. Toggles the asset-level `PermanentFreezeDelegate` on a single position without burning it — the holder can still claim while frozen. Fails with `FreezePluginMissing` on positions minted without the plugin (non-transferable campaigns), since mpl-core permanent plugins can only be added at mint. Emits `FreezeEvent`.

#### `exclude_asset`

Hard removal of a live position at any time (no grace gate): burns the Asset and returns the unclaimed remainder (`allocation - claimed_so_far`) to the creator. Fails on fully claimed loyalty badges. Emits `ClawbackEvent`.

#### `clawback`

Same burn-and-recover flow as `exclude_asset`, but only callable at or after `end + grace_period`. Targets the position wherever it lives — if a secondary buyer holds it, the burn applies to them. Fails on fully claimed loyalty badges. Emits `ClawbackEvent`.

#### `clawback_unclaimed(original_recipient, allocation, proofs)`

Recovers the full allocation of a recipient who **never minted a position**. Verifies the recipient's Merkle proof, requires the recipient's asset PDA to be empty and their receipt unused, then writes the receipt (permanently blocking a late first claim) and transfers the allocation to the creator. Only callable at or after `end + grace_period`. Emits `ClawbackEvent`.

---

## Freeze Hierarchy

mpl-core resolves the **asset-level** `PermanentFreezeDelegate` over the collection-level one when both exist. The plugin set is fixed at mint:

```
Transferable campaign (at initialize):
  collection frozen = false
  every position minted with asset-level PermanentFreezeDelegate { frozen: false }
  → collection freeze alone CANNOT stop these positions (asset plugin wins)
  → use freeze_asset per position, or exclude_asset to burn

Non-transferable campaign (at initialize):
  collection frozen = true
  positions minted WITHOUT an asset-level freeze plugin
  → collection freeze governs all positions; one CPI (un)freezes everything
  → freeze_asset is not available for these positions

Loyalty badge (claimed_so_far == allocation):
  asset-level plugin (when present) set frozen = true on the final claim
  collection state has no effect on it
  freeze_asset(false) could technically unfreeze it (creator-gated)
```

---

## Token Flow

```
initialize:           creator ATA   ->  Campaign ATA   (total_deposit)
claim:                Campaign ATA  ->  holder ATA     (vested amount)
exclude_asset:        Campaign ATA  ->  creator ATA    (allocation - claimed)
clawback:             Campaign ATA  ->  creator ATA    (allocation - claimed)
clawback_unclaimed:   Campaign ATA  ->  creator ATA    (full allocation)
cancel_campaign:      Campaign ATA  ->  creator ATA    (entire vault)

freeze_collection / freeze_asset / close_receipt: no token movement
transfer (native):    no token movement — mpl-core handles natively
```

**Balance invariant** (maintained by construction, not verified globally):

```
campaign_ata.balance = sum of (allocation - claimed_so_far) across live positions
                     + allocations never minted and not yet clawed back

close_campaign:  hard fails if campaign_ata.amount != 0
```

> **Note — under-funded campaigns:** `total_deposit` is not verified against the
> Merkle tree sum on-chain. If the creator deposits less than the sum of all
> allocations, late claimers hit `InsufficientVaultBalance`. Verify the deposit
> against the whitelist offchain before publishing a campaign.

---

## Merkle Tree

### Leaf encoding (current)

```
keccak256( lowercase(base58(pubkey)) || decimal_string(allocation) )
```

The leaf preimage is a **string**: the lowercased base58 pubkey concatenated with the allocation rendered in decimal. This matches the TS generator (`yarn run generate-merkle-tree`) and the test fixtures.

> Planned before deployment: migrate to raw-byte leaves
> (`keccak256(pubkey_bytes || allocation_le_bytes)`), which is cheaper on-chain
> and not dependent on string formatting. Requires regenerating the generator
> output and fixtures in lockstep.

### Proof format

Each proof step is 33 bytes:

```
byte[0]:      position  (1 = current is left child, 0 = current is right child)
bytes[1-32]:  sibling hash
```

### Generating the tree

```bash
yarn run generate-merkle-tree
```

Input CSV (`utils/data/whitelist.csv`):

```
wallet;amount
<pubkey>;5000000000
<pubkey>;2500000000
```

Proof is required only on first claim. After the Asset is minted, ownership is the sole claim authority.

---

## Multi-Campaign Model

Multiple campaigns can distribute the same token mint independently. Each campaign has its own Collection and authority scope; the Collection PDA is derived from `(creator, mint, merkle_root)`, so each whitelist is one campaign.

```
token_mint (e.g. PROJECT)
  |
  |-- Campaign: investor seed round
  |     cliff_release_bps: 1000 (10% at cliff), is_transferable: true
  |
  |-- Campaign: team 2026
  |     cliff_release_bps: 0 (pure linear), is_transferable: false
  |
  |-- Campaign: community airdrop
        cliff_release_bps: 2500 (25% at cliff), is_transferable: true
```

The UpdateAuthority PDA has burn and freeze authority over its own Collection only. No campaign can affect another campaign's Assets. Campaigns are discovered offchain by filtering on `mint_to_distribute`.

---

## Events

| Event             | Emitted by                                        | Payload highlights                                   |
| ----------------- | ------------------------------------------------- | ---------------------------------------------------- |
| `InitializeEvent` | `initialize`                                      | campaign, collection, merkle_root, timeline, deposit |
| `ClaimEvent`      | `claim`                                           | claimant, original_recipient, amount, claimed_so_far |
| `ClawbackEvent`   | `clawback`, `clawback_unclaimed`, `exclude_asset` | former_owner, original_recipient, amount_recovered   |
| `FreezeEvent`     | `freeze_collection`, `freeze_asset`               | target (collection or asset), frozen                 |
| `CancelEvent`     | `cancel_campaign`                                 | amount_returned                                      |
| `CloseEvent`      | `close_campaign`                                  | campaign, collection, creator                        |

Events replace per-owner claim history storage on-chain. An indexer reconstructs full claim history, per-owner breakdowns, and loyalty scores from these events.

---

## Development

### Prerequisites

- Rust + Solana CLI (`cargo build-sbf`)
- Anchor CLI `>=0.30`
- Node.js `>=18` (Merkle tree generator)

### Build

```bash
cargo build-sbf        # or: anchor build
```

### Test

```bash
anchor build && cargo test
```

---

## Program ID

| Network | Program ID                                     |
| ------- | ---------------------------------------------- |
| Devnet  | `4hAzFNAWaGZ5YpbRkSsfLNnQ3JXenkb3hAQ19nL7vTH3` |
| Mainnet | `TBD`                                          |

---

## Security

| Guard               | Description                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| PDA signing         | All CPIs signed by program PDAs. No external key touches the Campaign ATA directly                 |
| Asset auth          | Every claim verifies `asset.owner == signer` and the asset's attributes bind it to the campaign    |
| Claim window        | Claims gated to `[start, end + grace_period)`; clawbacks gated to `>= end + grace_period`          |
| Receipt one-time    | `ClaimReceipt` PDA blocks double first claims; `clawback_unclaimed` writes it to block late claims |
| Fully claimed guard | `clawback` / `exclude_asset` require `claimed_so_far < allocation` — loyalty badges inviolable     |
| Merkle one-time     | Proof verified only on first claim. No replay possible after Asset mint                            |
| Cancel guard        | `cancel_campaign` requires `num_minted == 0` — irreversible once any position existed              |
| Close guard         | `close_campaign` hard fails if `campaign_ata.amount != 0`                                          |
| Overflow safety     | Vesting math uses `u128` intermediates; timeline additions are checked                             |

---

## License

MIT

---

## Acknowledgements

Built during Turbine Builder Cohort Q2 2026.
Inspired by the operational pain of managing TGE vesting programs manually — this protocol is what I wish had existed then.
