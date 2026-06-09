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
- Transferability toggled at collection level — one CPI freezes or unfreezes all positions instantly
- Fully claimed positions become permanent loyalty badges — frozen on-chain proof of full vest
- Multiple campaigns per token mint — investor round, team, community all independent

---

## Program Architecture

### Programs

| Program            | Description                                |
| ------------------ | ------------------------------------------ |
| `vesting_protocol` | Custom Anchor program — all business logic |
| `mpl-core`         | Asset and Collection lifecycle (CPI)       |
| `SPL Token`        | Fungible token movements (CPI)             |

### Accounts

| Account               | Type          | Seeds                            | Purpose                        |
| --------------------- | ------------- | -------------------------------- | ------------------------------ |
| `Campaign PDA`        | PDA           | `[creator, mint, campaign_name]` | Campaign config and schedule   |
| `Campaign ATA`        | Token account | Owned by Campaign PDA            | Token vault                    |
| `mpl-core Collection` | mpl-core      | Created at init                  | Campaign-wide freeze authority |
| `mpl-core Asset`      | mpl-core      | One per recipient                | Vesting position NFT           |

### Campaign PDA fields

```
merkle_root:         [u8; 32]    // keccak256(pubkey || u64_allocation) per leaf
start:               i64         // unix timestamp vesting window opens
cliff:               i64         // unix timestamp cliff reached
end:                 i64         // unix timestamp full vest
cliff_release_bps:   u16         // basis points released at cliff (0-10000)
mint_to_claim:       Pubkey      // SPL token being distributed
is_transferable:     bool        // controls collection PermanentFreezeDelegate
grace_period:        u64         // seconds after end before clawback allowed
total_deposit:       u64         // total tokens deposited
admin:               Pubkey      // operational key (can equal creator)
collection:          Pubkey      // mpl-core Collection address
bump:                u8
```

### Asset attributes

```
allocation:           u64        // per-recipient amount, from Merkle leaf
claimed_so_far:       u64        // running total claimed
campaign:             Pubkey     // reference to Campaign PDA
original_recipient:   Pubkey     // wallet that was in the Merkle tree
last_claim_timestamp: i64        // updated on every claim
```

---

## Vesting Formula

```
cliff_duration: u64   // seconds after start
cliff_end = start + cliff_duration
if now < cliff_end → claimable = 0
linear_vested uses (now - cliff_end) / (end - cliff_end)
```

**Examples:**

| `cliff_release_bps` | Behavior                               |
| ------------------- | -------------------------------------- |
| `0`                 | Pure linear from cliff to end          |
| `1000`              | 10% at cliff, 90% linear cliff to end  |
| `2500`              | 25% at cliff, 75% linear cliff to end  |
| `10000`             | 100% released at cliff, no linear tail |

---

## Instructions

### Campaign lifecycle

#### `initialize_campaign`

Creates the Campaign PDA, mpl-core Collection, and Campaign ATA. Deposits total token supply upfront.

```typescript
await program.methods
  .initializeCampaign({
    campaignName: "investor-seed-round",
    merkleRoot: [...],               // [u8; 32]
    start: new BN(startTs),
    cliff: new BN(cliffTs),
    end: new BN(endTs),
    cliffReleaseBps: 1000,           // 10% at cliff
    isTransferable: true,
    gracePeriod: new BN(604800),     // 7 days
    totalDeposit: new BN(1_000_000_000),
    admin: adminKeypair.publicKey,
  })
  .accounts({ ... })
  .rpc();
```

#### `update_campaign`

Updates mutable campaign fields. `is_transferable` toggle fires a CPI to freeze or unfreeze the entire collection instantly.

| Field             | Updatable when          |
| ----------------- | ----------------------- |
| `admin`           | Anytime                 |
| `grace_period`    | Before `end`            |
| `is_transferable` | Anytime                 |
| `merkle_root`     | Before first claim only |

#### `withdraw_excess`

Recovers over-deposited tokens before vesting starts. Only callable before `start`.

#### `close_campaign`

Closes the Campaign PDA, Campaign ATA, and Collection. Requires `campaign_ata.balance == 0` — all positions must be claimed or clawed back first.

---

### Recipient instructions

#### `claim`

First claim requires a Merkle proof and the recipient's allocation as instruction arguments. The program recomputes `keccak256(signer_pubkey || allocation_le_bytes)`, walks the proof, and verifies against `campaign.merkle_root`. On success, mints the mpl-core Asset and transfers any vested tokens.

Subsequent claims require only Asset ownership — no proof needed.

```typescript
// First claim
await program.methods
  .claim({
    proofs: merkleProofs,       // Vec<[u8; 33]>
    allocation: new BN(5_000_000_000),
  })
  .accounts({ ... })
  .rpc();

// Subsequent claim
await program.methods
  .claim({ proofs: null, allocation: null })
  .accounts({ ... })
  .rpc();
```

**Claim paths:**

```
First claim:
  verify Merkle proof
  mint mpl-core Asset with attributes
  if is_transferable = false: Asset inherits collection freeze
  if now < cliff: transfer 0 tokens (Asset minted, position tradeable)
  else: transfer claimable tokens

Subsequent claim:
  verify asset.owner == signer
  verify asset.campaign == campaign_pda
  compute claimable via formula
  transfer claimable from Campaign ATA to signer ATA
  update claimed_so_far + last_claim_timestamp on Asset

Fully claimed:
  freeze Asset permanently (loyalty badge)
  cannot be unfrozen by any instruction
```

---

### Admin instructions

#### `freeze_asset`

Freezes an individual Asset. The recipient can still claim vested tokens while frozen — only transfer is blocked. Used to exclude bad actors from a transferable campaign.

#### `unfreeze_asset`

Unfreezes an individual Asset. Requires `campaign.is_transferable == true` and `claimed_so_far < allocation` — loyalty badges cannot be unfrozen.

#### `clawback`

Recovers unclaimed tokens after `end + grace_period`. Burns the Asset. Targets the **current Asset owner** — not the original recipient. If a secondary buyer holds the position at grace period end, the clawback applies to them.

Requires `claimed_so_far < allocation` — cannot clawback a fully claimed loyalty badge.

---

## Freeze Hierarchy

Transferability is controlled at two levels:

```
Collection frozen = true
  All Assets in campaign frozen regardless of asset-level state
  Toggled by update_campaign when is_transferable changes

Collection frozen = false + Asset frozen = true
  This specific Asset excluded (freeze_asset by admin)
  All other Assets transferable

Collection frozen = false + Asset frozen = false
  Asset freely transferable via mpl-core natively
  No custom transfer instruction needed

Loyalty badge (claimed_so_far == allocation)
  Frozen at asset level in claim()
  Inviolable — no instruction can unfreeze it
  Collection unfreeze has no effect on it
```

---

## Token Flow

```
initialize_campaign:   creator ATA      ->  Campaign ATA    (deposit)
withdraw_excess:       Campaign ATA     ->  creator ATA     (before start only)
claim:                 Campaign ATA     ->  holder ATA      (vested amount)
clawback:              Campaign ATA     ->  creator ATA     (remaining unclaimed)
close_campaign:        Campaign ATA     ->  creator ATA     (dust recovery)

freeze_asset:          no token movement
unfreeze_asset:        no token movement
update_campaign:       no token movement
transfer (native):     no token movement — mpl-core handles natively
```

**Balance invariant** (maintained by construction, not verified globally):

```
campaign_ata.balance = sum of (allocation - claimed_so_far) across all live Assets

Every claim:      transfers exactly compute_claimable() derived from Asset
Every clawback:   transfers exactly allocation - claimed_so_far from Asset
close_campaign:   hard fails if campaign_ata.amount != 0
```

---

## Merkle Tree

### Leaf encoding

```
keccak256(lowercase_base58(pubkey) || decimal_string(allocation))
```

- Pubkey as raw 32-byte representation (not base58)
- Allocation as little-endian `u64` (Solana native layout)
- Leaf size: 40 bytes before hashing

### Proof format

Each proof step is 33 bytes:

```
byte[0]:      position  (0 = current is left child, 1 = current is right child)
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
<pubkey>;1000000000
```

Output (`utils/data/merkle_proofs.json`):

```json
{
  "merkleRoot": "...",
  "proofs": {
    "<pubkey>": {
      "allocation": 5000000000,
      "proof": [...]
    }
  }
}
```

Proof is required only on first claim. After the Asset is minted, ownership is the sole claim authority.

---

## Multi-Campaign Model

Multiple campaigns can distribute the same token mint independently. Each campaign has its own Collection and authority scope.

```
token_mint (e.g. PROJECT)
  |
  |-- Campaign: "investor-seed-round"
  |     Collection authority: Campaign PDA A
  |     cliff_release_bps: 1000 (10% at cliff)
  |     is_transferable: true
  |
  |-- Campaign: "team-2026"
  |     Collection authority: Campaign PDA B
  |     cliff_release_bps: 0 (pure linear)
  |     is_transferable: false
  |
  |-- Campaign: "community-airdrop"
        Collection authority: Campaign PDA C
        cliff_release_bps: 2500 (25% at cliff)
        is_transferable: true
```

Each Campaign PDA has burn and freeze authority over its own Collection only. No campaign can affect another campaign's Assets. Campaigns are discovered offchain by filtering on `mint_to_claim`.

---

## Events

```rust
ClaimEvent {
    campaign:           Pubkey,
    asset:              Pubkey,
    claimant:           Pubkey,    // current holder
    original_recipient: Pubkey,
    amount:             u64,       // tokens transferred this claim
    claimed_so_far:     u64,       // running total after this claim
    timestamp:          i64,
}

ClawbackEvent {
    campaign:           Pubkey,
    asset:              Pubkey,
    former_owner:       Pubkey,
    original_recipient: Pubkey,
    amount_recovered:   u64,
    timestamp:          i64,
}
```

Events replace per-owner claim history storage on-chain. An indexer reconstructs full claim history, per-owner breakdowns, and loyalty scores from these events.

---

## Development

### Prerequisites

- Rust + Solana CLI
- Anchor CLI `>=0.30`
- Node.js `>=18`

### Build

```bash
anchor build
```

### Test

```bash
# Local validator
anchor test

# Against existing validator (e.g. surfpool)
anchor test --skip-local-validator

# Against devnet
yarn run test:capstone:devnet
```

### Deploy

```bash
anchor deploy --provider.cluster devnet --program-name vesting_protocol
```

---

## Program ID

| Network | Program ID      |
| ------- | --------------- |
| Devnet  | `TBD on deploy` |
| Mainnet | `TBD`           |

---

## Security

| Guard               | Description                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------ |
| PDA signing         | All CPIs signed by Campaign PDA using seeds. No external key touches Campaign ATA directly |
| Asset auth          | Every claim verifies `asset.owner == signer` AND `asset.campaign == campaign_pda`          |
| Balance invariant   | `close_campaign` hard fails if `campaign_ata.amount != 0`                                  |
| Fully claimed guard | `clawback` requires `claimed_so_far < allocation` — loyalty badges inviolable              |
| Merkle one-time     | Proof verified only on first claim. No replay possible after Asset mint                    |
| Freeze persistence  | Asset-level freeze on loyalty badges independent of collection state                       |
| Excess guard        | `withdraw_excess` only before `start` — committed allocations are protected                |

---

## License

MIT

---

## Acknowledgements

Built during Turbine Builder Cohort Q2 2026.
Inspired by the operational pain of managing TGE vesting programs manually — this protocol is what I wish had existed then.
