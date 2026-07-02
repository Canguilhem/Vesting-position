# Vesting Positions — Web MVP

Marketing site + devnet interaction UI for the Vesting Positions protocol.

| Route | Content |
| ----- | ------- |
| `/` | Marketing — features, lifecycle, vesting simulator |
| `/app` | Devnet app — create token, launch campaigns, browse & claim |
| `/app/profile` | Wallet profile — your campaigns, mints, and position NFTs (paginated) |

Profile loads campaigns/mints first, then scans devnet campaigns in batches of 15 for your claim receipts (no full mpl-core program scan). Positions bought on secondary markets will need Supabase/indexer persistence later.

## Quick start

```bash
cd web
npm install --legacy-peer-deps
npm run dev
```

## Stack

| Layer               | Package                                                             |
| ------------------- | ------------------------------------------------------------------- |
| UI                  | React 19 + Vite + Tailwind 4                                        |
| Data fetching       | TanStack Query (`@tanstack/react-query`) — shared RPC cache           |
| Wallet / RPC / send | `@solana/client` + `@solana/react-hooks` (framework-kit)            |
| Program client      | **Codama-generated** Kit client (`src/generated/vesting-positions`) |
| Built-in programs   | `@solana-program/compute-budget`                                    |

### Kit program plugins

| Plugin type                      | Status in this app                         |
| -------------------------------- | ------------------------------------------ |
| `@solana-program/compute-budget` | CU limit injected by `prepareTransaction` after simulation |
| `@solana-program/token`          | Available; ATAs derived via Kit PDAs       |
| **`vestingPositionsProgram()`**  | Generated — see below                      |

Custom programs get a plugin via [Codama](https://www.solanakit.com/docs/plugins/generating-program-plugins):

```bash
# After anchor build (updates target/idl/vesting_positions.json)
npm run codegen
```

This emits `src/generated/vesting-positions/` with:

- Standalone helpers — `getClaimInstructionAsync`, `getInitializeInstructionAsync`, `fetchCampaign`, `findClaimReceiptPda`, …
- **`vestingPositionsProgram()`** — installs `client.vestingPositions.instructions.claim(...).sendTransaction()`

We use the **standalone helpers** today with framework-kit's `useSendTransaction`, because `@solana/client` (framework-kit) and `@solana/kit`'s `createClient().use()` are related but not identical APIs yet.

### Wallet signing (all transactions)

Kit requires **one signer object per address** in a transaction. Every send path uses `useSendWalletTransaction`:

```ts
await sendWithWallet(async (walletSigner) => [
  await buildClaimInstruction({ user: walletSigner, /* … */ }),
]);
// internally: feePayer is the same walletSigner instance
```

| File | Role |
| ---- | ---- |
| `src/solana/wallet-signer.ts` | `getConnectedWalletSigner()` |
| `src/solana/wallet-transaction.ts` | `requireWalletSigner`, `walletSendPayload` |
| `src/hooks/useSendWalletTransaction.ts` | Shared hook wrapping `useSendTransaction` |

When adding a new instruction builder, pass `TransactionSigner` for wallet-owned accounts — never `createNoopSigner(address)` plus a separate `authority: wallet` on send.

### Compute unit budget

Instruction builders return **program instructions only** (no hardcoded `SetComputeUnitLimit`). On send, framework-kit's `prepareTransaction` simulates the unsigned transaction, reads `unitsConsumed`, applies `COMPUTE_UNIT_LIMIT_MULTIPLIER` (15% headroom), and prepends the compute-budget ix. If simulation fails, the client falls back to a safe upper bound.

### TanStack Query

`QueryClientProvider` wraps the app in `src/providers.tsx`. RPC reads use shared query keys in `src/lib/query-keys.ts`:

| Hook / query | Key | Notes |
| ------------ | --- | ----- |
| `useCampaigns` | `campaigns` | Shared by Browse + Profile |
| `useUserClaimState` | `claimState` + campaign + wallet | |
| `useWalletTokenBalance` | `walletBalance` + wallet + mint | Launch tab deposit check |
| `useMerkleAllowlist` | `merkleProof` + wallet | Static JSON, infinite stale time |
| `useProfile` | `profile` + positions infinite query | Position scan paginated via `useInfiniteQuery` |

After successful claim / initialize / create-token, `invalidateAfterOnChainWrite()` refreshes affected caches.

In dev, open the TanStack Query panel (bottom-left) to inspect cache keys, stale state, and refetches.

## Program interaction

| File                                    | Role                                                      |
| --------------------------------------- | --------------------------------------------------------- |
| `codama.js`                             | Codegen config (Anchor IDL → Kit client)                  |
| `src/generated/vesting-positions/`      | Generated client + `vestingPositionsProgram()`            |
| `src/solana/vesting-positions.ts`       | App wrapper — fetch campaigns, build claim/initialize ixs |
| `src/components/InitializeCampaign.tsx` | Launch tab — creator initialize flow                      |
| `public/merkle_proofs.json`             | Demo allowlist for first claims                           |

### App flows

- **Launch** — creator signs `initialize` (deposits tokens, creates collection + campaign PDA)
- **Browse / Claim** — list campaigns, first claim uses Merkle proof from bundled JSON

---

## Updating the IDL and Kit client

Run this whenever you change the Anchor program (`programs/vesting_positions/`).

### 1. Rebuild the program

From the **repo root**:

```bash
anchor build
```

This writes a fresh IDL to:

```
target/idl/vesting_positions.json
```

### 2. Regenerate the Kit client

From `web/`:

```bash
npm run codegen
```

Codama reads `../target/idl/vesting_positions.json` (see `codama.js`) and overwrites:

```
web/src/generated/vesting-positions/
```

### 3. (Optional) Refresh the checked-in IDL copy

The app does **not** import `src/idl/` at runtime — codegen uses `target/idl/`. Keep the copy in sync for diffs and reference:

```bash
cp target/idl/vesting_positions.json web/src/idl/vesting_positions.json
```

### 4. Fix app wrappers if the API changed

Codegen updates generated types and instruction helpers automatically. If you renamed accounts, args, or PDAs, update hand-written glue:

- `src/solana/vesting-positions.ts`
- `src/solana/pdas.ts` (only if a PDA is not in the generated client)
- `src/hooks/useClaim.ts`, `src/hooks/useInitialize.ts`

### 5. Verify

```bash
cd web
npm run build
```

### One-liner (repo root)

```bash
anchor build && cd web && npm run codegen && cp ../target/idl/vesting_positions.json src/idl/vesting_positions.json && npm run build
```

### Codama dependencies

If `codama init` or `npm run codegen` prompts to install packages, ensure these devDependencies are present (already in `package.json`):

- `codama`
- `@codama/renderers-js`
- `@codama/nodes-from-anchor`

Install non-interactively:

```bash
npm install --save-dev codama @codama/renderers-js @codama/nodes-from-anchor --legacy-peer-deps
```
