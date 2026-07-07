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
import { labelClassName } from "./form-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppCard, AppCallout } from "./Common/AppCard";
import {
  SectionHeader,
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
      <SectionHeader
        title="Create distribution token"
        description={
          <>
            Mint a fresh SPL token to your wallet once, then launch campaigns from
            the Launch tab wizard. Example: mint{" "}
            {formatTokenCount(DEFAULT_TOKEN_SUPPLY_TOKENS)} tokens, then run up to{" "}
            {Number(DEFAULT_TOKEN_SUPPLY_TOKENS / DEFAULT_CAMPAIGN_DEPOSIT_TOKENS)}{" "}
            campaigns at {formatTokenCount(DEFAULT_CAMPAIGN_DEPOSIT_TOKENS)} each.
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClassName()}>
          <span className="font-medium">Token label (local)</span>
          <form.Field name="label">
            {(field) => (
              <Input
                type="text"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="My project token"
              />
            )}
          </form.Field>
        </label>

        <label className={labelClassName()}>
          <span className="font-medium">Decimals</span>
          <form.Field name="decimals">
            {(field) => (
              <Input
                type="number"
                min={0}
                max={9}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) =>
                  field.handleChange(Number(e.target.value) || 0)
                }
              />
            )}
          </form.Field>
        </label>

        <label className={`${labelClassName()} sm:col-span-2`}>
          <span className="font-medium">Total supply (tokens)</span>
          <form.Field name="supply">
            {(field) => (
              <Input
                type="text"
                inputMode="numeric"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
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
                <span className="text-xs text-muted-foreground">
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
        <AppCallout tone="warning">Connect a wallet to create a token.</AppCallout>
      )}

      {error && <AppCallout tone="error">{error}</AppCallout>}

      {lastResult && (
        <AppCard variant="success" padding="md" className="gap-3">
          <p className="text-sm font-medium">Token created</p>
          <p className="text-xs">
            <TruncatedExplorerLink address={String(lastResult.mint)} />
          </p>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Supply: {formatTokens(lastResult.supply)} tokens</span>
            <TruncatedTxLink signature={lastResult.signature} head={10} tail={10} />
          </p>
          <div className="flex flex-wrap gap-2">
            {onLaunchWithMint && (
              <Button
                type="button"
                size="sm"
                onClick={() => onLaunchWithMint(lastResult.mint)}
              >
                Launch campaign with this mint
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={() => clearResult()}>
              Dismiss
            </Button>
          </div>
        </AppCard>
      )}

      <Button type="submit" disabled={!canCreate || isSending}>
        {isSending ? "Confirm in wallet…" : "Create token & mint supply"}
      </Button>
    </form>
  );
}
