## Full vesting lifecycle — PASS

> demonstrate whole vesting life cycle including position transfers

**actors pubkeys**

| field | value |
|---|---|
| campaign creator | BUTN6L99gZasTEZ8onMJCC1NkoxXkpfoZU7EkcgWFyJw |
| alice | 4wQQJM9LNuhinieNAqmHuPCm8LXDTVfhx84P32nAVE9P |
| bob | ErV63ApqLgh1Je5PdiVj6kzwkKJmLjKV41QoN9U4BNag |

**PDAs**

| field | value |
|---|---|
| campaign | BAdhTbCM1gZzkXUS9BNXhFcJ2GrMp33N4a53pNNbv2Mw |
| campaign vault | h6b4LrA7UDHfLg57TJYgU7mZjqQZYRjovQ7kGLMxZFH |

### Campaign initialized

- [x] campaign creator match: `true`
- [x] campaign schedule match: `true`
- [x] merkle root and deposit match: `true`

**campaign settings**

| field | value |
|---|---|
| creator | campaign creator pubkey |
| start (unix) | 1700086400 |
| end (unix) | 1702678400 |
| grace period (sec) | 604800 |
| cliff duration (sec) | 86400 |
| cliff release (bps) | 1000 |
| total deposit | 10000000000000 |
| transferable | true |

### Alice first claim

**Collection & Asset**

| field | value |
|---|---|
| Position NFT (minted by Alice) | 993tWnLHDL7DHApupk2U5cZbjznbX3udkHFKsGHu5uJ5 |
| NFT Collection for this campaign | 6nUiVzrpjwKJJ99KW4vMwjsGK3SoMQuWXFD3hcMKzQw6 |

| Observation | Before | After | What it means |
|---|---|---|---|
| Alice's token balance, after the cliff claim | `0` | `100000000000` | Alice received 10% of her allocation |

- [x] position nft exists: `true`
- [x] position nft owner is alice: `4wQQJM9LNuhinieNAqmHuPCm8LXDTVfhx84P32nAVE9P`

### Alice subsequent claim without providing any proof

**subsequent claim**

| field | value |
|---|---|
| claimant | Alice pubkey |
| auth | position NFT (no proofs) |
| asset | Position NFT (minted by Alice) |
| linear % | 50 |
| timestamp (unix) | 1701425600 |
| balance before | 100000000000 |
| incremental release | 450000000000 |

| Observation | Before | After | What it means |
|---|---|---|---|
| Alice balance after second claim at 50% elapsed time | `100000000000` | `550000000000` | Alice received the expected amount for a 50% elapsed time |

### NFT transfer to Bob

**transfer**

| field | value |
|---|---|
| from | Alice pubkey |
| to | Bob pubkey |
| recipient whitelisted | false |
| asset | Position NFT (minted by Alice) |

| Observation | Before | After | What it means |
|---|---|---|---|
| Alice's position ownership | `"Alice pubkey"` | `"Bob pubkey"` | Bob is now the owner of alice's vesting position |

### Alice replays merkle proofs after transferring the NFT

The program should reject and prevent minting a second vesting postion for the same provided proofs

**attack**

| field | value |
|---|---|
| vector | first claim with valid merkle proofs after transfer |
| goal | mint a second NFT / reclaim allocation (infinite money trick) |
| alice owns nft | false |
| expected error | AlreadyClaimed |

- [x] alice no longer owns the nft: `true`
- [x] claim receipt still bound to alice: `4wQQJM9LNuhinieNAqmHuPCm8LXDTVfhx84P32nAVE9P`

### Bob claims via NFT ownership

**subsequent claim**

| field | value |
|---|---|
| claimant | Bob pubkey |
| whitelisted | false |
| asset | Position NFT (minted by Alice) |
| auth | NFT ownership only (no merkle proofs) |
| linear % | 75 |
| timestamp (unix) | 1702052000 |
| claimed so far | 550000000000 |
| expected release | 225000000000 |

Bob was never whitelisted; NFT ownership alone authorizes the subsequent claim

| Observation | Before | After | What it means |
|---|---|---|---|
| Bob's token balance after claiming with Alice's position | `0` | `225000000000` | Despite not being whitelisted, bob can claim vested tokens from alice allocation since he owns her position |

- [x] position nft owner is still bob: `ErV63ApqLgh1Je5PdiVj6kzwkKJmLjKV41QoN9U4BNag`

**Structured logs**

````text
### Act 1 — alice first claim
```console
Transaction  signers=[Alice pubkey]
├── ComputeBudget [1] ✓ (no cu)
└── vesting_positions program::Claim [1] ✓ 180917cu  signer=Alice pubkey
    │ 🔔 ClaimEvent
    │      campaign:           Campaign pubkey,
    │      asset:              Position NFT (minted by Alice),
    │      claimant:           Alice pubkey,
    │      original_recipient: Alice pubkey,
    │      amount:             100000000000,
    │      claimed_so_far:     100000000000,
    │      timestamp:          1700172800
    ├── AssociatedToken::Create [2] ✓ 20389cu
    │   ├── Token::GetAccountDataSize [3] ✓ 1595cu
    │   ├── System::CreateAccount [3] ✓ (no cu)
    │   ├── Token::InitializeImmutableOwner [3] ✓ 1405cu
    │   └── Token::InitializeAccount3 [3] ✓ 4214cu
    ├── System::CreateAccount [2] ✓ (no cu)
    ├── mpl_core::CreateV2 [2] ✓ 29916cu
    │   ├── System::CreateAccount [3] ✓ (no cu)
    │   ├── System::Transfer [3] ✓ (no cu)
    │   ├── System::Transfer [3] ✓ (no cu)
    │   ├── System::Transfer [3] ✓ (no cu)
    │   └── System::Transfer [3] ✓ (no cu)
    └── Token::TransferChecked [2] ✓ 6174cu
Compute Units (this run): 181067
Legend (3):
  Alice pubkey              = 4wQQJM9LNuhinieNAqmHuPCm8LXDTVfhx84P32nAVE9P
  vesting_positions program = 4hAzFNAWaGZ5YpbRkSsfLNnQ3JXenkb3hAQ19nL7vTH3
  mpl_core                  = CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d
```

### Act 2 — alice subsequent claim
```console
── vesting_positions program::Claim ────────────────────────
Transaction  signers=[Alice pubkey]
└── vesting_positions program::Claim [1] ✓ 83989cu  signer=Alice pubkey
    │ 🔔 ClaimEvent
    │      campaign:           Campaign pubkey,
    │      asset:              Position NFT (minted by Alice),
    │      claimant:           Alice pubkey,
    │      original_recipient: Alice pubkey,
    │      amount:             450000000000,
    │      claimed_so_far:     550000000000,
    │      timestamp:          1701425600
    ├── mpl_core::UpdatePlugin [2] ✓ 20791cu
    └── Token::TransferChecked [2] ✓ 6174cu
Compute Units (this run): 83989
Legend (3):
  vesting_positions program = 4hAzFNAWaGZ5YpbRkSsfLNnQ3JXenkb3hAQ19nL7vTH3
  Alice pubkey              = 4wQQJM9LNuhinieNAqmHuPCm8LXDTVfhx84P32nAVE9P
  mpl_core                  = CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d
```

### Act 3 — merkle replay rejected
```console
── vesting_positions program::Claim ────────────────────────
Transaction  signers=[Alice pubkey]
└── vesting_positions program::Claim [1] ✗ 22067cu  signer=Alice pubkey
    └── Error: AlreadyClaimed
Error: InstructionError(0, Custom(6012))
Compute Units (this run): 22067
Legend (2):
  vesting_positions program = 4hAzFNAWaGZ5YpbRkSsfLNnQ3JXenkb3hAQ19nL7vTH3
  Alice pubkey              = 4wQQJM9LNuhinieNAqmHuPCm8LXDTVfhx84P32nAVE9P
```

### Act 4 — bob claim via nft ownership
```console
── vesting_positions program::Claim ────────────────────────
Transaction  signers=[Bob pubkey]
└── vesting_positions program::Claim [1] ✓ 114771cu  signer=Bob pubkey
    │ 🔔 ClaimEvent
    │      campaign:           Campaign pubkey,
    │      asset:              Position NFT (minted by Alice),
    │      claimant:           Bob pubkey,
    │      original_recipient: Alice pubkey,
    │      amount:             225000000000,
    │      claimed_so_far:     775000000000,
    │      timestamp:          1702052000
    ├── AssociatedToken::Create [2] ✓ 21889cu
    │   ├── Token::GetAccountDataSize [3] ✓ 1595cu
    │   ├── System::CreateAccount [3] ✓ (no cu)
    │   ├── Token::InitializeImmutableOwner [3] ✓ 1405cu
    │   └── Token::InitializeAccount3 [3] ✓ 4214cu
    ├── System::CreateAccount [2] ✓ (no cu)
    ├── mpl_core::UpdatePlugin [2] ✓ 20791cu
    └── Token::TransferChecked [2] ✓ 6174cu
Compute Units (this run): 114771
Legend (3):
  vesting_positions program = 4hAzFNAWaGZ5YpbRkSsfLNnQ3JXenkb3hAQ19nL7vTH3
  Bob pubkey                = ErV63ApqLgh1Je5PdiVj6kzwkKJmLjKV41QoN9U4BNag
  mpl_core                  = CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d
```
````

**Act 1 — alice first claim — CPI sequence**

```mermaid
sequenceDiagram
    autonumber
    participant Alice_pubkey as "Alice pubkey"
    participant ComputeBudget
    participant vesting_positions_program as "vesting_positions program"
    participant AssociatedToken
    participant Token
    participant System
    participant mpl_core
    Alice_pubkey ->> ComputeBudget: unnamed
    Alice_pubkey ->> vesting_positions_program: Claim
    vesting_positions_program ->> AssociatedToken: Create
    AssociatedToken ->> Token: GetAccountDataSize
    AssociatedToken ->> System: CreateAccount
    AssociatedToken ->> Token: InitializeImmutableOwner
    AssociatedToken ->> Token: InitializeAccount3
    vesting_positions_program ->> System: CreateAccount
    vesting_positions_program ->> mpl_core: CreateV2
    mpl_core ->> System: CreateAccount
    mpl_core ->> System: Transfer
    mpl_core ->> System: Transfer
    mpl_core ->> System: Transfer
    mpl_core ->> System: Transfer
    vesting_positions_program ->> Token: TransferChecked
    note over vesting_positions_program: 🔔 ClaimEvent { campaign: Campaign pubkey, asset: Position NF…
```

**Act 2 — alice subsequent claim — CPI sequence**

```mermaid
sequenceDiagram
    autonumber
    participant Alice_pubkey as "Alice pubkey"
    participant vesting_positions_program as "vesting_positions program"
    participant mpl_core
    participant Token
    Alice_pubkey ->> vesting_positions_program: Claim
    vesting_positions_program ->> mpl_core: UpdatePlugin
    vesting_positions_program ->> Token: TransferChecked
    note over vesting_positions_program: 🔔 ClaimEvent { campaign: Campaign pubkey, asset: Position NF…
```

**Act 3 — merkle replay rejected — CPI sequence**

```mermaid
sequenceDiagram
    autonumber
    participant Alice_pubkey as "Alice pubkey"
    participant vesting_positions_program as "vesting_positions program"
    Alice_pubkey ->> vesting_positions_program: Claim
    note over vesting_positions_program: ✗ AlreadyClaimed
```

**Act 4 — bob claim via nft ownership — CPI sequence**

```mermaid
sequenceDiagram
    autonumber
    participant Bob_pubkey as "Bob pubkey"
    participant vesting_positions_program as "vesting_positions program"
    participant AssociatedToken
    participant Token
    participant System
    participant mpl_core
    Bob_pubkey ->> vesting_positions_program: Claim
    vesting_positions_program ->> AssociatedToken: Create
    AssociatedToken ->> Token: GetAccountDataSize
    AssociatedToken ->> System: CreateAccount
    AssociatedToken ->> Token: InitializeImmutableOwner
    AssociatedToken ->> Token: InitializeAccount3
    vesting_positions_program ->> System: CreateAccount
    vesting_positions_program ->> mpl_core: UpdatePlugin
    vesting_positions_program ->> Token: TransferChecked
    note over vesting_positions_program: 🔔 ClaimEvent { campaign: Campaign pubkey, asset: Position NF…
```
