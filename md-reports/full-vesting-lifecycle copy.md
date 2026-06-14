## Full vesting lifecycle — PASS

> demonstrate whole vesting life cycle include position transfers

**actors pubkeys**

| field | value |
|---|---|
| campaign creator | DQyartxA4BJBYMSJrH5uQiuuP9t1kePwjLtFuKxEzWGY |
| alice | 4wQQJM9LNuhinieNAqmHuPCm8LXDTVfhx84P32nAVE9P |
| bob | ErV63ApqLgh1Je5PdiVj6kzwkKJmLjKV41QoN9U4BNag |

### Campaign initialized

**initialization checks**

| field | value |
|---|---|
| creator match | true |
| schedule match | true |
| merkle root match | true |
| total deposit match | true |

- [x] campaign creator match: `true`
- [x] campaign schedule match: `true`
- [x] merkle root and deposit match: `true`

**campaign settings**

| field | value |
|---|---|
| creator | campaign creator |
| start (unix) | 1700086400 |
| end (unix) | 1702678400 |
| grace period (sec) | 604800 |
| cliff duration (sec) | 86400 |
| cliff release (bps) | 1000 |
| total deposit | 10000000000000 |
| transferable | true |

**campaign schedule**

| field | value |
|---|---|
| start | 1700086400 |
| end | 1702678400 |
| grace | 604800 |

### Alice first claim

**Collection & Asset**

| field | value |
|---|---|
| Position NFT (minted by Alice) | HJBsEvoQVYPwi6kgWxyvTiZ1uqXicJccH8LajqjEF2a |
| NFT Collection for this campaign | EfPzavmdhgKYv4xc2QpTnpvrtYm7ojbXjKMHFqpJdJBk |

**first claim**

| field | value |
|---|---|
| claimant | Alice |
| whitelisted | true |
| auth | merkle proofs + allocation |
| timestamp (unix) | 1700172800 |
| allocation | 1000000000000 |
| expected release | 100000000000 |

- [x] position nft exists: `true`
- [x] position nft owner is alice: `4wQQJM9LNuhinieNAqmHuPCm8LXDTVfhx84P32nAVE9P`
- [x] cliff release credited (10%): `100000000000`

### Alice subsequent claim

**subsequent claim**

| field | value |
|---|---|
| claimant | Alice |
| auth | position NFT (no proofs) |
| asset | Position NFT (minted by Alice) |
| linear % | 50 |
| timestamp (unix) | 1701425600 |
| balance before | 100000000000 |
| incremental release | 450000000000 |

- [x] additional vesting credited: `550000000000`

### NFT transfer to Bob

**transfer**

| field | value |
|---|---|
| from | Alice |
| to | Bob |
| recipient whitelisted | false |
| asset | Position NFT (minted by Alice) |

- [x] position nft owner is bob: `ErV63ApqLgh1Je5PdiVj6kzwkKJmLjKV41QoN9U4BNag`

### Merkle replay rejected

**attack**

| field | value |
|---|---|
| vector | first claim with valid merkle proofs after transfer |
| goal | mint a second NFT / reclaim allocation (infinite money trick) |
| alice owns nft | false |
| expected error | AlreadyClaimed |

- [x] alice no longer owns the nft: `true`

Alice replays merkle proofs after transferring the NFT; the claim receipt blocks a second position

- [x] claim receipt still bound to alice: `4wQQJM9LNuhinieNAqmHuPCm8LXDTVfhx84P32nAVE9P`

### Bob claims via NFT ownership

**subsequent claim**

| field | value |
|---|---|
| claimant | Bob |
| whitelisted | false |
| asset | HJBsEvoQVYPwi6kgWxyvTiZ1uqXicJccH8LajqjEF2a |
| auth | NFT ownership only (no merkle proofs) |
| linear % | 75 |
| timestamp (unix) | 1702052000 |
| claimed so far | 550000000000 |
| expected release | 225000000000 |

Bob was never whitelisted; NFT ownership alone authorizes the subsequent claim

- [x] bob credited without merkle proofs: `225000000000`
- [x] position nft owner is still bob: `ErV63ApqLgh1Je5PdiVj6kzwkKJmLjKV41QoN9U4BNag`
