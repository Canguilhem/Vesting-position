import { useState } from "react";
import type { Address } from "@solana/addresses";
import { useWalletConnection } from "@solana/react-hooks";
import {
  DEFAULT_TOKEN_SUPPLY,
  DEFAULT_CAMPAIGN_DEPOSIT,
} from "../lib/initialize";
import { formatTokens } from "../lib/vesting";
import { useCreateToken } from "../hooks/useCreateToken";

function fieldClassName(): string {
  return "w-full rounded-lg border border-border-low bg-background/60 px-3 py-2 text-sm outline-none transition focus:border-accent/40";
}

function labelClassName(): string {
  return "block space-y-1.5 text-sm";
}

export function CreateTokenPanel({
  onLaunchWithMint,
}: {
  onLaunchWithMint?: (mint: Address) => void;
}) {
  const { status } = useWalletConnection();
  const { createToken, isSending, lastResult, error, canCreate, clearResult } =
    useCreateToken();

  const [decimals, setDecimals] = useState(6);
  const [supply, setSupply] = useState(String(DEFAULT_TOKEN_SUPPLY));
  const [label, setLabel] = useState("Vesting token");

  const campaignCount =
    BigInt(supply || "0") > 0n && DEFAULT_CAMPAIGN_DEPOSIT > 0n
      ? Number(BigInt(supply) / DEFAULT_CAMPAIGN_DEPOSIT)
      : 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Create distribution token</h3>
        <p className="max-w-2xl text-sm text-muted">
          Mint a fresh SPL token to your wallet once, then launch multiple
          campaigns that each deposit a slice of the supply. Example: mint{" "}
          {formatTokens(Number(DEFAULT_TOKEN_SUPPLY))} units, then run up to{" "}
          {Number(DEFAULT_TOKEN_SUPPLY / DEFAULT_CAMPAIGN_DEPOSIT)} campaigns at{" "}
          {formatTokens(Number(DEFAULT_CAMPAIGN_DEPOSIT))} each.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClassName()}>
          <span className="font-medium">Token label (local)</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={fieldClassName()}
            placeholder="My project token"
          />
        </label>

        <label className={labelClassName()}>
          <span className="font-medium">Decimals</span>
          <input
            type="number"
            min={0}
            max={9}
            value={decimals}
            onChange={(e) => setDecimals(Number(e.target.value))}
            className={fieldClassName()}
          />
        </label>

        <label className={`${labelClassName()} sm:col-span-2`}>
          <span className="font-medium">Total supply (raw units)</span>
          <input
            type="text"
            inputMode="numeric"
            value={supply}
            onChange={(e) => setSupply(e.target.value)}
            className={fieldClassName()}
          />
          <span className="text-xs text-muted">
            Minted entirely to your wallet ATA. At{" "}
            {formatTokens(Number(DEFAULT_CAMPAIGN_DEPOSIT))} per campaign, that
            supports ~{campaignCount} campaign{campaignCount === 1 ? "" : "s"}.
          </span>
        </label>
      </div>

      {status !== "connected" && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Connect a wallet to create a token.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {lastResult && (
        <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-sm font-medium text-emerald-200">Token created</p>
          <p className="font-mono text-xs break-all">{lastResult.mint}</p>
          <p className="text-xs text-muted">
            Supply: {formatTokens(Number(lastResult.supply))} ·{" "}
            <a
              href={lastResult.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              View transaction
            </a>
          </p>
          <div className="flex flex-wrap gap-2">
            {onLaunchWithMint && (
              <button
                type="button"
                onClick={() => onLaunchWithMint(lastResult.mint)}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg cursor-pointer"
              >
                Launch campaign with this mint
              </button>
            )}
            <button
              type="button"
              onClick={() => clearResult()}
              className="rounded-lg border border-border-low px-3 py-1.5 text-sm cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() =>
          void createToken({ decimals, supply, label })
        }
        disabled={!canCreate || isSending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
      >
        {isSending ? "Confirm in wallet…" : "Create token & mint supply"}
      </button>
    </div>
  );
}
