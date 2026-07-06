import { useForm } from "@tanstack/react-form";
import type { Address } from "@solana/addresses";
import { useWalletConnection } from "@solana/react-hooks";
import {
  DEFAULT_CAMPAIGN_DEPOSIT_TOKENS,
  DEFAULT_TOKEN_SUPPLY_TOKENS,
} from "../lib/initialize";
import { createDefaultCreateTokenFormValues } from "../lib/create-token";
import { formatTokenCount, formatTokens } from "../lib/vesting";
import { useCreateToken } from "../hooks/useCreateToken";
import { fieldClassName, labelClassName } from "./form-styles";
import {
  TruncatedExplorerLink,
  TruncatedTxLink,
} from "./Common/Common";

export function CreateTokenPanel({
  onLaunchWithMint,
}: {
  onLaunchWithMint?: (mint: Address) => void;
}) {
  const { status } = useWalletConnection();
  const {
    createToken,
    isSending,
    lastResult,
    error,
    canCreate,
    clearResult,
    clearError,
  } = useCreateToken();

  const form = useForm({
    defaultValues: createDefaultCreateTokenFormValues(),
    onSubmit: async ({ value }) => {
      await createToken(value);
    },
  });

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        clearError();
        void form.handleSubmit();
      }}
    >
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Create distribution token</h3>
        <p className="max-w-2xl text-sm text-muted">
          Mint a fresh SPL token to your wallet once, then launch campaigns from
          the Launch tab wizard. Example: mint{" "}
          {formatTokenCount(DEFAULT_TOKEN_SUPPLY_TOKENS)} tokens, then run up to{" "}
          {Number(DEFAULT_TOKEN_SUPPLY_TOKENS / DEFAULT_CAMPAIGN_DEPOSIT_TOKENS)}{" "}
          campaigns at {formatTokenCount(DEFAULT_CAMPAIGN_DEPOSIT_TOKENS)} each.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClassName()}>
          <span className="font-medium">Token label (local)</span>
          <form.Field name="label">
            {(field) => (
              <input
                type="text"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className={fieldClassName()}
                placeholder="My project token"
              />
            )}
          </form.Field>
        </label>

        <label className={labelClassName()}>
          <span className="font-medium">Decimals</span>
          <form.Field name="decimals">
            {(field) => (
              <input
                type="number"
                min={0}
                max={9}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) =>
                  field.handleChange(Number(e.target.value) || 0)
                }
                className={fieldClassName()}
              />
            )}
          </form.Field>
        </label>

        <label className={`${labelClassName()} sm:col-span-2`}>
          <span className="font-medium">Total supply (tokens)</span>
          <form.Field name="supply">
            {(field) => (
              <input
                type="text"
                inputMode="numeric"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className={fieldClassName()}
              />
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.values.supply}>
            {(supply) => {
              const campaignCount =
                BigInt(supply || "0") > 0n && DEFAULT_CAMPAIGN_DEPOSIT_TOKENS > 0n
                  ? Number(
                      BigInt(supply) / DEFAULT_CAMPAIGN_DEPOSIT_TOKENS,
                    )
                  : 0;
              return (
                <span className="text-xs text-muted">
                  Minted entirely to your wallet ATA. At{" "}
                  {formatTokenCount(DEFAULT_CAMPAIGN_DEPOSIT_TOKENS)} tokens per
                  campaign, that supports ~{campaignCount} campaign
                  {campaignCount === 1 ? "" : "s"}.
                </span>
              );
            }}
          </form.Subscribe>
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
          <p className="text-xs">
            <TruncatedExplorerLink address={String(lastResult.mint)} />
          </p>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>Supply: {formatTokens(lastResult.supply)} tokens</span>
            <TruncatedTxLink signature={lastResult.signature} head={10} tail={10} />
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
        type="submit"
        disabled={!canCreate || isSending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
      >
        {isSending ? "Confirm in wallet…" : "Create token & mint supply"}
      </button>
    </form>
  );
}
