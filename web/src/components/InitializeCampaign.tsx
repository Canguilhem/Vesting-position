import { useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { type Address } from "@solana/addresses";
import { useWalletConnection } from "@solana/react-hooks";
import {
  applyDefaultSchedule,
  collectCampaignFormErrors,
  createDefaultCampaignFormValues,
  DEFAULT_CAMPAIGN_DEPOSIT_TOKENS,
  formatScheduleLocal,
  fromDatetimeLocal,
  isStartTooSoon,
  type CampaignFormValues,
  type InitializeResult,
} from "../lib/initialize";
import {
  buildAllowListFromCsv,
  type AllowListSnapshot,
} from "../lib/allow-list";
import { isSupabaseConfigured } from "../lib/supabase";
import { loadSavedTokens, type SavedToken } from "../lib/token-registry";
import { formatTokenCount, formatTokens, rawToTokens } from "../lib/vesting";
import { useInitialize } from "../hooks/useInitialize";
import { useClusterTime } from "../hooks/useClusterTime";
import { useWalletTokenBalance } from "../hooks/useWalletTokenBalance";
import { CampaignSuccessModal } from "./CampaignSuccessModal";
import { fieldClassName, labelClassName } from "./form-styles";

export function InitializeCampaign({
  prefilledMint,
  onViewCampaign,
}: {
  prefilledMint?: Address | null;
  onViewCampaign?: (campaign: Address) => void;
}) {
  const { status } = useWalletConnection();
  const [savedTokens] = useState<SavedToken[]>(() => loadSavedTokens());
  const [showModal, setShowModal] = useState(false);
  const [lastResult, setLastResult] = useState<InitializeResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [allowlistSnapshot, setAllowlistSnapshot] =
    useState<AllowListSnapshot | null>(null);
  const [allowlistError, setAllowlistError] = useState<string | null>(null);
  const [allowlistParsing, setAllowlistParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { initialize } = useInitialize();
  const { clusterNowSec } = useClusterTime();

  const form = useForm({
    defaultValues: createDefaultCampaignFormValues(
      prefilledMint ? String(prefilledMint) : null,
    ),
    onSubmit: async ({ value }) => {
      if (!allowlistSnapshot) {
        setSubmitError("Upload an allowlist CSV before launching.");
        return;
      }

      setSubmitError(null);
      try {
        const result = await initialize(value, { allowlistSnapshot });
        setLastResult(result);
        setShowModal(true);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : String(err));
      }
    },
  });

  async function loadAllowlistCsv(csv: string) {
    setAllowlistParsing(true);
    setAllowlistError(null);
    try {
      const { snapshot } = await buildAllowListFromCsv(csv);
      setAllowlistSnapshot(snapshot);
      form.setFieldValue("merkleRootHex", snapshot.merkleRoot);
    } catch (err) {
      setAllowlistSnapshot(null);
      setAllowlistError(err instanceof Error ? err.message : String(err));
    } finally {
      setAllowlistParsing(false);
    }
  }

  async function handleCsvFile(file: File) {
    const csv = await file.text();
    await loadAllowlistCsv(csv);
  }

  async function loadSampleAllowlist() {
    const res = await fetch("/sample-allowlist.csv");
    if (!res.ok) {
      setAllowlistError("Failed to load sample allowlist.");
      return;
    }
    await loadAllowlistCsv(await res.text());
  }

  function CampaignFields({ values }: { values: CampaignFormValues }) {
    const { balance: walletBalance, loading: balanceLoading } =
      useWalletTokenBalance(values.mint.trim() || null);

    const { blocking, warnings } = collectCampaignFormErrors(values, {
      walletBalance,
      nowSec: clusterNowSec ?? undefined,
    });
    const validationError = blocking[0];
    const formWarnings = warnings;
    const startTooSoon = isStartTooSoon(values, clusterNowSec ?? undefined);

    const schedulePreview = (() => {
      try {
        const start = fromDatetimeLocal(values.start);
        const end = fromDatetimeLocal(values.end);
        return `${formatScheduleLocal(start)} → ${formatScheduleLocal(end)}`;
      } catch {
        return null;
      }
    })();

    const totalAllowlistAllocation = allowlistSnapshot?.entries.reduce(
      (sum, entry) => sum + entry.allocation,
      0n,
    );

    return (
      <>
        <div className="rounded-xl border border-border-low bg-card/30 p-4 space-y-3">
          <div className="space-y-1">
            <p className="font-medium">Recipient allowlist</p>
            <p className="text-xs text-muted">
              Upload a semicolon-separated CSV with{" "}
              <code className="font-mono">wallet;amount</code> columns (amount
              in base token units). The merkle root is derived from this file
              and stored per campaign
              {isSupabaseConfigured()
                ? " in Supabase"
                : " when Supabase is configured"}
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleCsvFile(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={allowlistParsing}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-border-low px-3 py-2 text-sm transition hover:border-accent/30 disabled:opacity-50 cursor-pointer"
            >
              {allowlistParsing ? "Parsing…" : "Upload CSV"}
            </button>
            <button
              type="button"
              disabled={allowlistParsing}
              onClick={() => void loadSampleAllowlist()}
              className="rounded-lg border border-border-low px-3 py-2 text-sm text-muted transition hover:border-accent/30 disabled:opacity-50 cursor-pointer"
            >
              Load sample allowlist
            </button>
          </div>

          {allowlistError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {allowlistError}
            </p>
          )}

          {allowlistSnapshot && (
            <dl className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted">Recipients</dt>
                <dd className="font-medium">
                  {allowlistSnapshot.entries.length}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Total allocation</dt>
                <dd className="font-medium font-mono text-xs">
                  {totalAllowlistAllocation != null
                    ? formatTokens(totalAllowlistAllocation)
                    : "—"}
                </dd>
              </div>
              <div className="sm:col-span-3">
                <dt className="text-xs text-muted">Merkle root</dt>
                <dd className="font-mono text-xs break-all">
                  {allowlistSnapshot.merkleRoot}
                </dd>
              </div>
            </dl>
          )}
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
                    onClick={() => form.setFieldValue("mint", token.mint)}
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
            <form.Field name="mint">
              {(field) => (
                <input
                  type="text"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="SPL token mint address"
                  className={`${fieldClassName()} font-mono text-xs`}
                  spellCheck={false}
                />
              )}
            </form.Field>
            <span className="text-xs text-muted">
              {balanceLoading
                ? "Checking wallet balance…"
                : walletBalance != null
                  ? `Your balance: ${formatTokens(walletBalance)} tokens`
                  : "Enter a mint to see your ATA balance"}
            </span>
          </label>

          <label className={labelClassName()}>
            <span className="font-medium">Campaign deposit (tokens)</span>
            <div className="flex gap-2">
              <form.Field name="totalDeposit">
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
              {walletBalance != null && walletBalance > 0n && (
                <button
                  type="button"
                  onClick={() =>
                    form.setFieldValue(
                      "totalDeposit",
                      String(rawToTokens(walletBalance)),
                    )
                  }
                  className="shrink-0 rounded-lg border border-border-low px-3 py-2 text-xs transition hover:border-accent/30 cursor-pointer"
                >
                  Use max
                </button>
              )}
            </div>
            <span className="text-xs text-muted">
              Default {formatTokenCount(DEFAULT_CAMPAIGN_DEPOSIT_TOKENS)} tokens
              per campaign — must not exceed your wallet balance.
            </span>
          </label>

          <label className={`${labelClassName()} lg:col-span-2`}>
            <span className="font-medium">Merkle root (hex)</span>
            <form.Field name="merkleRootHex">
              {(field) => (
                <input
                  type="text"
                  readOnly
                  value={field.state.value}
                  placeholder="Upload an allowlist CSV to compute the root"
                  className={`${fieldClassName()} font-mono text-xs opacity-80`}
                  spellCheck={false}
                />
              )}
            </form.Field>
          </label>

          <label className={labelClassName()}>
            <span className="font-medium">Start (claims open)</span>
            <form.Field name="start">
              {(field) => (
                <input
                  type="datetime-local"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className={fieldClassName()}
                />
              )}
            </form.Field>
          </label>

          <label className={labelClassName()}>
            <span className="font-medium">End (vesting completes)</span>
            <form.Field name="end">
              {(field) => (
                <input
                  type="datetime-local"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className={fieldClassName()}
                />
              )}
            </form.Field>
          </label>

          {schedulePreview && (
            <p className="text-xs text-muted lg:col-span-2">
              Schedule (your local time): {schedulePreview}
            </p>
          )}

          <label className={labelClassName()}>
            <span className="font-medium">Cliff (days)</span>
            <form.Field name="cliffDays">
              {(field) => (
                <input
                  type="number"
                  min={0}
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

          <label className={labelClassName()}>
            <span className="font-medium">Cliff release (bps)</span>
            <form.Field name="cliffReleaseBps">
              {(field) => (
                <input
                  type="number"
                  min={0}
                  max={10_000}
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

          <label className={labelClassName()}>
            <span className="font-medium">Grace period (days)</span>
            <form.Field name="graceDays">
              {(field) => (
                <input
                  type="number"
                  min={1}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) =>
                    field.handleChange(Number(e.target.value) || 1)
                  }
                  className={fieldClassName()}
                />
              )}
            </form.Field>
          </label>

          <form.Field name="isTransferable">
            {(field) => (
              <label
                className={`${labelClassName()} flex items-center gap-2 pt-6`}
              >
                <input
                  type="checkbox"
                  checked={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.checked)}
                  className="h-4 w-4 rounded border-border-low accent-accent"
                />
                <span className="font-medium">
                  Positions transferable at launch
                </span>
              </label>
            )}
          </form.Field>

          <label className={labelClassName()}>
            <span className="font-medium">Collection name</span>
            <form.Field name="name">
              {(field) => (
                <input
                  type="text"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className={fieldClassName()}
                />
              )}
            </form.Field>
          </label>

          <label className={labelClassName()}>
            <span className="font-medium">Collection URI</span>
            <form.Field name="uri">
              {(field) => (
                <input
                  type="url"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className={fieldClassName()}
                />
              )}
            </form.Field>
          </label>
        </div>

        {status !== "connected" && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Connect a wallet to initialize a campaign.
          </p>
        )}

        {formWarnings.length > 0 && (
          <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            <ul className="list-disc space-y-1 pl-4">
              {formWarnings.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
            {startTooSoon && (
              <button
                type="button"
                onClick={() => form.reset(applyDefaultSchedule(values))}
                className="rounded-md border border-amber-400/40 px-2.5 py-1 text-xs transition hover:bg-amber-500/20 cursor-pointer"
              >
                Reset schedule (start tomorrow, 30-day vesting)
              </button>
            )}
          </div>
        )}

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <>
              {validationError && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {validationError}
                </p>
              )}

              {submitError && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={
                  status !== "connected" ||
                  balanceLoading ||
                  !allowlistSnapshot ||
                  blocking.length > 0 ||
                  warnings.length > 0 ||
                  isSubmitting
                }
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? "Confirm in wallet…" : "Initialize campaign"}
              </button>
            </>
          )}
        </form.Subscribe>
      </>
    );
  }

  return (
    <>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Launch a campaign</h3>
          <p className="max-w-2xl text-sm text-muted">
            Deposit a portion of your token supply into a new vesting campaign.
            Create the token first in the Token tab if you have not minted a
            supply yet.
          </p>
        </div>

        <form.Subscribe selector={(state) => state.values}>
          {(values) => <CampaignFields values={values} />}
        </form.Subscribe>
      </form>

      <CampaignSuccessModal
        result={showModal ? lastResult : null}
        onClose={() => {
          setShowModal(false);
          setLastResult(null);
        }}
        onViewCampaign={(campaign) => {
          onViewCampaign?.(campaign);
        }}
      />
    </>
  );
}
