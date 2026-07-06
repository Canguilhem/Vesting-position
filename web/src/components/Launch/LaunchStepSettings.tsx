import type { ReactFormExtendedApi } from "@tanstack/react-form";
import { useWalletConnection } from "@solana/react-hooks";
import {
  applyDefaultSchedule,
  collectCampaignFormErrors,
  DEFAULT_CAMPAIGN_DEPOSIT_TOKENS,
  formatScheduleLocal,
  fromDatetimeLocal,
  isStartTooSoon,
  type CampaignFormValues,
} from "../../lib/initialize";
import type { AllowListSnapshot } from "../../lib/allow-list";
import { totalAllowlistAllocationRaw } from "../../lib/allow-list";
import { formatTokenCount, formatTokens, rawToTokens } from "../../lib/vesting";
import { useClusterTime } from "../../hooks/useClusterTime";
import { useWalletTokenBalance } from "../../hooks/useWalletTokenBalance";
import { fieldClassName, labelClassName } from "../form-styles";
import { TruncatedExplorerLink } from "../Common/Common";

type CampaignFormInstance = ReactFormExtendedApi<
  CampaignFormValues,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>;

export function LaunchStepSettings({
  campaignForm,
  mint,
  allowlistSnapshot,
  submitError,
  onSubmit,
}: {
  campaignForm: CampaignFormInstance;
  mint: string;
  allowlistSnapshot: AllowListSnapshot | null;
  submitError: string | null;
  onSubmit: () => void;
}) {
  const { status } = useWalletConnection();
  const { clusterNowSec } = useClusterTime();
  const { balance: walletBalance, loading: balanceLoading } =
    useWalletTokenBalance(mint.trim() || null);

  const allowlistTotalRaw = allowlistSnapshot
    ? totalAllowlistAllocationRaw(allowlistSnapshot)
    : null;

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSubmit();
      }}
    >
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Campaign settings</h3>
        <p className="max-w-2xl text-sm text-muted">
          Configure vesting schedule, deposit size, and collection metadata.
          Token and allowlist are locked from earlier steps.
        </p>
      </div>

      <div className="rounded-xl border border-border-low bg-card/30 px-4 py-3 text-sm">
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">Token mint</dt>
            <dd className="text-xs">
              {mint ? (
                <TruncatedExplorerLink address={mint} head={10} tail={10} />
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Allowlist recipients</dt>
            <dd className="font-medium">
              {allowlistSnapshot?.entries.length ?? "—"}
            </dd>
          </div>
          {allowlistTotalRaw != null && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted">Allowlist total allocation</dt>
              <dd className="font-medium font-mono text-xs">
                {formatTokens(allowlistTotalRaw)} tokens
              </dd>
            </div>
          )}
        </dl>
      </div>

      <campaignForm.Subscribe
        selector={(state) => ({
          values: state.values,
          isSubmitting: state.isSubmitting,
        })}
      >
        {({ values, isSubmitting }) => {
          const { blocking, warnings } = collectCampaignFormErrors(values, {
            walletBalance,
            nowSec: clusterNowSec ?? undefined,
          });
          const validationError = blocking[0];
          const startTooSoon = isStartTooSoon(
            values,
            clusterNowSec ?? undefined,
          );

          const schedulePreview = (() => {
            try {
              const start = fromDatetimeLocal(values.start);
              const end = fromDatetimeLocal(values.end);
              return `${formatScheduleLocal(start)} → ${formatScheduleLocal(end)}`;
            } catch {
              return null;
            }
          })();

          return (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className={labelClassName()}>
                  <span className="font-medium">Campaign deposit (tokens)</span>
                  <div className="flex gap-2">
                    <campaignForm.Field name="totalDeposit">
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
                    </campaignForm.Field>
                    {walletBalance != null && walletBalance > 0n && (
                      <button
                        type="button"
                        onClick={() =>
                          campaignForm.setFieldValue(
                            "totalDeposit",
                            allowlistTotalRaw != null
                              ? String(rawToTokens(allowlistTotalRaw))
                              : String(rawToTokens(walletBalance)),
                          )
                        }
                        className="shrink-0 rounded-lg border border-border-low px-3 py-2 text-xs transition hover:border-accent/30 cursor-pointer"
                      >
                        {allowlistTotalRaw != null
                          ? "Use allowlist total"
                          : "Use max"}
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-muted">
                    {allowlistTotalRaw != null
                      ? `Prefilled from CSV total (${formatTokens(allowlistTotalRaw)} tokens). Must not exceed your wallet balance.`
                      : balanceLoading
                        ? "Checking wallet balance…"
                        : walletBalance != null
                          ? `Your balance: ${formatTokens(walletBalance)} tokens`
                          : "Default " +
                            formatTokenCount(DEFAULT_CAMPAIGN_DEPOSIT_TOKENS) +
                            " tokens per campaign"}
                  </span>
                </label>

                <label className={`${labelClassName()} lg:col-span-2`}>
                  <span className="font-medium">Merkle root (hex)</span>
                  <campaignForm.Field name="merkleRootHex">
                    {(field) => (
                      <input
                        type="text"
                        readOnly
                        value={field.state.value}
                        className={`${fieldClassName()} font-mono text-xs opacity-80`}
                        spellCheck={false}
                      />
                    )}
                  </campaignForm.Field>
                </label>

                <label className={labelClassName()}>
                  <span className="font-medium">Start (claims open)</span>
                  <campaignForm.Field name="start">
                    {(field) => (
                      <input
                        type="datetime-local"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className={fieldClassName()}
                      />
                    )}
                  </campaignForm.Field>
                </label>

                <label className={labelClassName()}>
                  <span className="font-medium">End (vesting completes)</span>
                  <campaignForm.Field name="end">
                    {(field) => (
                      <input
                        type="datetime-local"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className={fieldClassName()}
                      />
                    )}
                  </campaignForm.Field>
                </label>

                {schedulePreview && (
                  <p className="text-xs text-muted lg:col-span-2">
                    Schedule (your local time): {schedulePreview}
                  </p>
                )}

                <label className={labelClassName()}>
                  <span className="font-medium">Cliff (days)</span>
                  <campaignForm.Field name="cliffDays">
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
                  </campaignForm.Field>
                </label>

                <label className={labelClassName()}>
                  <span className="font-medium">Cliff release (bps)</span>
                  <campaignForm.Field name="cliffReleaseBps">
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
                  </campaignForm.Field>
                </label>

                <label className={labelClassName()}>
                  <span className="font-medium">Grace period (days)</span>
                  <campaignForm.Field name="graceDays">
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
                  </campaignForm.Field>
                </label>

                <campaignForm.Field name="isTransferable">
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
                </campaignForm.Field>

                <label className={labelClassName()}>
                  <span className="font-medium">Collection name</span>
                  <campaignForm.Field name="name">
                    {(field) => (
                      <input
                        type="text"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className={fieldClassName()}
                      />
                    )}
                  </campaignForm.Field>
                </label>

                <label className={labelClassName()}>
                  <span className="font-medium">Collection URI</span>
                  <campaignForm.Field name="uri">
                    {(field) => (
                      <input
                        type="url"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className={fieldClassName()}
                      />
                    )}
                  </campaignForm.Field>
                </label>
              </div>

              {status !== "connected" && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  Connect a wallet to initialize a campaign.
                </p>
              )}

              {warnings.length > 0 && (
                <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  <ul className="list-disc space-y-1 pl-4">
                    {warnings.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                  {startTooSoon && (
                    <button
                      type="button"
                      onClick={() =>
                        campaignForm.reset(applyDefaultSchedule(values))
                      }
                      className="rounded-md border border-amber-400/40 px-2.5 py-1 text-xs transition hover:bg-amber-500/20 cursor-pointer"
                    >
                      Reset schedule (start tomorrow, 30-day vesting)
                    </button>
                  )}
                </div>
              )}

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
                  blocking.length > 0 ||
                  warnings.length > 0 ||
                  isSubmitting
                }
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? "Confirm in wallet…" : "Initialize campaign"}
              </button>
            </>
          );
        }}
      </campaignForm.Subscribe>
    </form>
  );
}
