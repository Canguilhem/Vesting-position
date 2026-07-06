import {
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import { useForm } from "@tanstack/react-form";
import { useWalletConnection } from "@solana/react-hooks";
import {
  DEFAULT_CAMPAIGN_DEPOSIT_TOKENS,
  DEFAULT_TOKEN_SUPPLY_TOKENS,
} from "../../lib/initialize";
import {
  createDefaultCreateTokenFormValues,
  validateCreateTokenForm,
} from "../../lib/create-token";
import { loadSavedTokens, type SavedToken } from "../../lib/token-registry";
import { tryParseAddress } from "../../lib/utils";
import { formatTokenCount, formatTokens } from "../../lib/vesting";
import { useCreateToken } from "../../hooks/useCreateToken";
import { useWalletTokenBalance } from "../../hooks/useWalletTokenBalance";
import { fieldClassName, labelClassName } from "../form-styles";
import { TruncatedExplorerLink } from "../Common/Common";

export type TokenStepMode = "existing" | "create";

export type LaunchStepTokenHandle = {
  advance: () => Promise<{ ok: true } | { ok: false; error: string }>;
};

export const LaunchStepToken = forwardRef<
  LaunchStepTokenHandle,
  {
    mode: TokenStepMode;
    mint: string;
    onModeChange: (mode: TokenStepMode) => void;
    onMintChange: (mint: string) => void;
  }
>(function LaunchStepToken(
  { mode, mint, onModeChange, onMintChange },
  ref,
) {
  const { status } = useWalletConnection();
  const [savedTokens, setSavedTokens] = useState<SavedToken[]>(() =>
    loadSavedTokens(),
  );
  const { createToken, isSending, error, clearError } = useCreateToken();
  const { balance, loading: balanceLoading } = useWalletTokenBalance(
    mode === "existing" ? mint.trim() || null : null,
  );

  const createForm = useForm({
    defaultValues: createDefaultCreateTokenFormValues(),
    onSubmit: async () => {},
  });

  const mintValid = tryParseAddress(mint.trim()) != null;
  const tokenAlreadyCreated = mode === "create" && mintValid;

  useImperativeHandle(ref, () => ({
    async advance() {
      clearError();
      if (status !== "connected") {
        return { ok: false, error: "Connect a wallet first." };
      }

      if (mode === "existing") {
        if (!tryParseAddress(mint.trim())) {
          return { ok: false, error: "Enter a valid token mint address." };
        }
        return { ok: true };
      }

      if (tokenAlreadyCreated) {
        return { ok: true };
      }

      const values = createForm.state.values;
      const validationError = validateCreateTokenForm(values);
      if (validationError) {
        return { ok: false, error: validationError };
      }

      const result = await createToken(values);
      if (!result) {
        return { ok: false, error: "Token creation failed or was cancelled." };
      }

      setSavedTokens(loadSavedTokens());
      onMintChange(String(result.mint));
      return { ok: true };
    },
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Distribution token</h3>
        <p className="max-w-2xl text-sm text-muted">
          Pick an SPL token mint that holds your campaign deposit, or mint a new
          one now. One token can fund multiple campaigns over time.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["existing", "I have a token"],
            ["create", "Create new token"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onModeChange(id)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition cursor-pointer ${
              mode === id
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-border-low text-muted hover:border-accent/30"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "existing" ? (
        <div className="space-y-4 rounded-xl border border-border-low bg-card/30 p-4">
          {savedTokens.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted">Saved tokens</p>
              <div className="flex flex-wrap gap-2">
                {savedTokens.map((token) => (
                  <button
                    key={token.mint}
                    type="button"
                    onClick={() => onMintChange(token.mint)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-mono transition cursor-pointer ${
                      mint === token.mint
                        ? "border-accent/50 bg-accent/10 text-accent"
                        : "border-border-low text-muted hover:border-accent/30"
                    }`}
                  >
                    {token.label ?? `${token.mint.slice(0, 8)}…`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className={labelClassName()}>
            <span className="font-medium">Token mint address</span>
            <input
              type="text"
              value={mint}
              onChange={(e) => onMintChange(e.target.value)}
              placeholder="SPL token mint address"
              className={`${fieldClassName()} font-mono text-xs`}
              spellCheck={false}
            />
            <span className="text-xs text-muted">
              {balanceLoading
                ? "Checking wallet balance…"
                : balance != null
                  ? `Your balance: ${formatTokens(balance)} tokens`
                  : mint.trim()
                    ? mintValid
                      ? "Valid mint address"
                      : "Invalid mint address"
                    : "Paste a mint or pick a saved token"}
            </span>
          </label>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-border-low bg-card/30 p-4">
          <p className="text-xs text-muted">
            Mints {formatTokenCount(DEFAULT_TOKEN_SUPPLY_TOKENS)} tokens to your
            wallet (devnet). Supports ~
            {Number(
              DEFAULT_TOKEN_SUPPLY_TOKENS / DEFAULT_CAMPAIGN_DEPOSIT_TOKENS,
            )}{" "}
            campaigns at {formatTokenCount(DEFAULT_CAMPAIGN_DEPOSIT_TOKENS)}{" "}
            each.
          </p>

          {tokenAlreadyCreated ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              Token created — mint{" "}
              <TruncatedExplorerLink address={mint} head={10} tail={10} />
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClassName()}>
                <span className="font-medium">Token label (local)</span>
                <createForm.Field name="label">
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
                </createForm.Field>
              </label>

              <label className={labelClassName()}>
                <span className="font-medium">Decimals</span>
                <createForm.Field name="decimals">
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
                </createForm.Field>
              </label>

              <label className={`${labelClassName()} sm:col-span-2`}>
                <span className="font-medium">Total supply (tokens)</span>
                <createForm.Field name="supply">
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
                </createForm.Field>
              </label>
            </div>
          )}
        </div>
      )}

      {status !== "connected" && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Connect a wallet to continue.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {isSending && (
        <p className="text-sm text-muted">Confirm token creation in wallet…</p>
      )}
    </div>
  );
});
