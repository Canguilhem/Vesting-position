import { useEffect, useState } from "react";
import { address, type Address } from "@solana/addresses";
import { useSolanaClient, useWalletConnection } from "@solana/react-hooks";
import {
  DEFAULT_CAMPAIGN_DEPOSIT,
  defaultScheduleTimestamps,
  toDatetimeLocal,
  type CampaignFormValues,
} from "../lib/initialize";
import { loadMerkleFixture } from "../lib/merkle";
import { loadSavedTokens, type SavedToken } from "../lib/token-registry";
import { formatTokens } from "../lib/vesting";
import { fetchWalletTokenBalance } from "../solana/token-balance";
import { useInitialize } from "../hooks/useInitialize";
import { CampaignSuccessModal } from "./CampaignSuccessModal";

function fieldClassName(): string {
  return "w-full rounded-lg border border-border-low bg-background/60 px-3 py-2 text-sm outline-none transition focus:border-accent/40";
}

function labelClassName(): string {
  return "block space-y-1.5 text-sm";
}

export function InitializeCampaign({
  prefilledMint,
  onViewCampaign,
}: {
  prefilledMint?: Address | null;
  onViewCampaign?: (campaign: Address) => void;
}) {
  const client = useSolanaClient();
  const { wallet, status } = useWalletConnection();
  const schedule = defaultScheduleTimestamps();

  const [savedTokens, setSavedTokens] = useState<SavedToken[]>([]);
  const [walletBalance, setWalletBalance] = useState<bigint | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [values, setValues] = useState<CampaignFormValues>(() => ({
    mint: prefilledMint ? String(prefilledMint) : "",
    totalDeposit: String(DEFAULT_CAMPAIGN_DEPOSIT),
    merkleRootHex: "",
    start: toDatetimeLocal(schedule.start),
    end: toDatetimeLocal(schedule.end),
    cliffDays: 1,
    cliffReleaseBps: 1000,
    graceDays: 7,
    isTransferable: true,
    name: "Vesting campaign",
    uri: "https://example.com/collection.json",
  }));

  const {
    initialize,
    isSending,
    progress,
    lastResult,
    clearResult,
    error,
    canInitialize,
  } = useInitialize();

  useEffect(() => {
    setSavedTokens(loadSavedTokens());
  }, [lastResult]);

  useEffect(() => {
    if (prefilledMint) {
      setValues((prev) => ({ ...prev, mint: String(prefilledMint) }));
    }
  }, [prefilledMint]);

  useEffect(() => {
    void loadMerkleFixture().then((fixture) => {
      setValues((prev) =>
        prev.merkleRootHex ? prev : { ...prev, merkleRootHex: fixture.merkleRoot },
      );
    });
  }, []);

  useEffect(() => {
    const mintStr = values.mint.trim();
    const owner = wallet?.account.address;
    if (!mintStr || !owner || status !== "connected") {
      setWalletBalance(null);
      return;
    }

    let cancelled = false;
    setBalanceLoading(true);
    void fetchWalletTokenBalance(
      client.runtime.rpc,
      owner,
      address(mintStr),
    )
      .then(({ balance }) => {
        if (!cancelled) setWalletBalance(balance);
      })
      .catch(() => {
        if (!cancelled) setWalletBalance(null);
      })
      .finally(() => {
        if (!cancelled) setBalanceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [values.mint, wallet, status, client, lastResult]);

  useEffect(() => {
    if (lastResult) setShowModal(true);
  }, [lastResult]);

  const setField = <K extends keyof CampaignFormValues>(
    key: K,
    value: CampaignFormValues[K],
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  let depositAmount = 0n;
  try {
    depositAmount = BigInt(values.totalDeposit);
  } catch {
    depositAmount = 0n;
  }

  const insufficientBalance =
    walletBalance != null && depositAmount > 0n && walletBalance < depositAmount;

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Launch a campaign</h3>
          <p className="max-w-2xl text-sm text-muted">
            Deposit a portion of your token supply into a new vesting campaign.
            Create the token first in the Token tab if you have not minted a
            supply yet.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className={`${labelClassName()} lg:col-span-2`}>
            <span className="font-medium">Distribution token</span>
            {savedTokens.length > 0 && (
              <div className="flex flex-wrap gap-2 pb-1">
                {savedTokens.map((token) => (
                  <button
                    key={token.mint}
                    type="button"
                    onClick={() => setField("mint", token.mint)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-mono transition cursor-pointer ${
                      values.mint === token.mint
                        ? "border-accent/50 bg-accent/10 text-accent"
                        : "border-border-low text-muted hover:border-accent/30"
                    }`}
                  >
                    {token.label ?? `${token.mint.slice(0, 8)}…`}
                  </button>
                ))}
              </div>
            )}
            <input
              type="text"
              value={values.mint}
              onChange={(e) => setField("mint", e.target.value)}
              placeholder="SPL token mint address"
              className={`${fieldClassName()} font-mono text-xs`}
              spellCheck={false}
            />
            <span className="text-xs text-muted">
              {balanceLoading
                ? "Checking wallet balance…"
                : walletBalance != null
                  ? `Your balance: ${formatTokens(Number(walletBalance))} raw units`
                  : "Enter a mint to see your ATA balance"}
            </span>
          </label>

          <label className={labelClassName()}>
            <span className="font-medium">Campaign deposit (raw units)</span>
            <input
              type="text"
              inputMode="numeric"
              value={values.totalDeposit}
              onChange={(e) => setField("totalDeposit", e.target.value)}
              className={fieldClassName()}
            />
            <span className="text-xs text-muted">
              Default {formatTokens(Number(DEFAULT_CAMPAIGN_DEPOSIT))} per
              campaign.
            </span>
          </label>

          <label className={`${labelClassName()} lg:col-span-2`}>
            <span className="font-medium">Merkle root (hex)</span>
            <input
              type="text"
              value={values.merkleRootHex}
              onChange={(e) => setField("merkleRootHex", e.target.value)}
              className={`${fieldClassName()} font-mono text-xs`}
              spellCheck={false}
            />
          </label>

          <label className={labelClassName()}>
            <span className="font-medium">Start (claims open)</span>
            <input
              type="datetime-local"
              value={values.start}
              onChange={(e) => setField("start", e.target.value)}
              className={fieldClassName()}
            />
          </label>

          <label className={labelClassName()}>
            <span className="font-medium">End (vesting completes)</span>
            <input
              type="datetime-local"
              value={values.end}
              onChange={(e) => setField("end", e.target.value)}
              className={fieldClassName()}
            />
          </label>

          <label className={labelClassName()}>
            <span className="font-medium">Cliff (days)</span>
            <input
              type="number"
              min={0}
              value={values.cliffDays}
              onChange={(e) => setField("cliffDays", Number(e.target.value))}
              className={fieldClassName()}
            />
          </label>

          <label className={labelClassName()}>
            <span className="font-medium">Cliff release (bps)</span>
            <input
              type="number"
              min={0}
              max={10_000}
              value={values.cliffReleaseBps}
              onChange={(e) =>
                setField("cliffReleaseBps", Number(e.target.value))
              }
              className={fieldClassName()}
            />
          </label>

          <label className={labelClassName()}>
            <span className="font-medium">Grace period (days)</span>
            <input
              type="number"
              min={1}
              value={values.graceDays}
              onChange={(e) => setField("graceDays", Number(e.target.value))}
              className={fieldClassName()}
            />
          </label>

          <label className={`${labelClassName()} flex items-center gap-2 pt-6`}>
            <input
              type="checkbox"
              checked={values.isTransferable}
              onChange={(e) => setField("isTransferable", e.target.checked)}
              className="h-4 w-4 rounded border-border-low accent-accent"
            />
            <span className="font-medium">Positions transferable at launch</span>
          </label>

          <label className={labelClassName()}>
            <span className="font-medium">Collection name</span>
            <input
              type="text"
              value={values.name}
              onChange={(e) => setField("name", e.target.value)}
              className={fieldClassName()}
            />
          </label>

          <label className={labelClassName()}>
            <span className="font-medium">Collection URI</span>
            <input
              type="url"
              value={values.uri}
              onChange={(e) => setField("uri", e.target.value)}
              className={fieldClassName()}
            />
          </label>
        </div>

        {status !== "connected" && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Connect a wallet to initialize a campaign.
          </p>
        )}

        {insufficientBalance && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Deposit exceeds your wallet balance. Mint more tokens or lower the
            campaign deposit.
          </p>
        )}

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void initialize(values)}
          disabled={!canInitialize || isSending || insufficientBalance}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          {isSending ? progress ?? "Confirm in wallet…" : "Initialize campaign"}
        </button>
      </div>

      <CampaignSuccessModal
        result={showModal ? lastResult : null}
        onClose={() => {
          setShowModal(false);
          clearResult();
        }}
        onViewCampaign={(campaign) => {
          onViewCampaign?.(campaign);
        }}
      />
    </>
  );
}
