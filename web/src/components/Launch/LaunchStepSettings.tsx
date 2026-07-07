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
import { labelClassName } from "../form-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppCard, AppCallout } from "../Common/AppCard";
import { SectionHeader, TruncatedExplorerLink } from "../Common/Common";

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
      <SectionHeader
        title="Campaign settings"
        description="Configure vesting schedule, deposit size, and collection metadata. Token and allowlist are locked from earlier steps."
      />

      <AppCard variant="section" padding="sm" className="text-sm">
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Token mint</dt>
            <dd className="text-xs">
              {mint ? (
                <TruncatedExplorerLink address={mint} head={10} tail={10} />
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Allowlist recipients</dt>
            <dd className="font-medium">
              {allowlistSnapshot?.entries.length ?? "—"}
            </dd>
          </div>
          {allowlistTotalRaw != null && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Allowlist total allocation</dt>
              <dd className="font-medium font-mono text-xs">
                {formatTokens(allowlistTotalRaw)} tokens
              </dd>
            </div>
          )}
        </dl>
      </AppCard>

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
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                      )}
                    </campaignForm.Field>
                    {walletBalance != null && walletBalance > 0n && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() =>
                          campaignForm.setFieldValue(
                            "totalDeposit",
                            allowlistTotalRaw != null
                              ? String(rawToTokens(allowlistTotalRaw))
                              : String(rawToTokens(walletBalance)),
                          )
                        }
                      >
                        {allowlistTotalRaw != null
                          ? "Use allowlist total"
                          : "Use max"}
                      </Button>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
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
                      <Input
                        type="text"
                        readOnly
                        value={field.state.value}
                        className="font-mono text-xs opacity-80"
                        spellCheck={false}
                      />
                    )}
                  </campaignForm.Field>
                </label>

                <label className={labelClassName()}>
                  <span className="font-medium">Start (claims open)</span>
                  <campaignForm.Field name="start">
                    {(field) => (
                      <Input
                        type="datetime-local"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    )}
                  </campaignForm.Field>
                </label>

                <label className={labelClassName()}>
                  <span className="font-medium">End (vesting completes)</span>
                  <campaignForm.Field name="end">
                    {(field) => (
                      <Input
                        type="datetime-local"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    )}
                  </campaignForm.Field>
                </label>

                {schedulePreview && (
                  <p className="text-xs text-muted-foreground lg:col-span-2">
                    Schedule (your local time): {schedulePreview}
                  </p>
                )}

                <label className={labelClassName()}>
                  <span className="font-medium">Cliff (days)</span>
                  <campaignForm.Field name="cliffDays">
                    {(field) => (
                      <Input
                        type="number"
                        min={0}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) =>
                          field.handleChange(Number(e.target.value) || 0)
                        }
                      />
                    )}
                  </campaignForm.Field>
                </label>

                <label className={labelClassName()}>
                  <span className="font-medium">Cliff release (bps)</span>
                  <campaignForm.Field name="cliffReleaseBps">
                    {(field) => (
                      <Input
                        type="number"
                        min={0}
                        max={10_000}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) =>
                          field.handleChange(Number(e.target.value) || 0)
                        }
                      />
                    )}
                  </campaignForm.Field>
                </label>

                <label className={labelClassName()}>
                  <span className="font-medium">Grace period (days)</span>
                  <campaignForm.Field name="graceDays">
                    {(field) => (
                      <Input
                        type="number"
                        min={1}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) =>
                          field.handleChange(Number(e.target.value) || 1)
                        }
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
                      <Input
                        type="text"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    )}
                  </campaignForm.Field>
                </label>

                <label className={labelClassName()}>
                  <span className="font-medium">Collection URI</span>
                  <campaignForm.Field name="uri">
                    {(field) => (
                      <Input
                        type="url"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    )}
                  </campaignForm.Field>
                </label>
              </div>

              {status !== "connected" && (
                <AppCallout tone="warning">
                  Connect a wallet to initialize a campaign.
                </AppCallout>
              )}

              {warnings.length > 0 && (
                <AppCallout tone="warning" className="space-y-2">
                  <ul className="list-disc space-y-1 pl-4">
                    {warnings.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                  {startTooSoon && (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="border-amber-400/40 hover:bg-amber-500/20"
                      onClick={() =>
                        campaignForm.reset(applyDefaultSchedule(values))
                      }
                    >
                      Reset schedule (start tomorrow, 30-day vesting)
                    </Button>
                  )}
                </AppCallout>
              )}

              {validationError && (
                <AppCallout tone="error">{validationError}</AppCallout>
              )}

              {submitError && (
                <AppCallout tone="error">{submitError}</AppCallout>
              )}

              <Button
                type="submit"
                disabled={
                  status !== "connected" ||
                  balanceLoading ||
                  blocking.length > 0 ||
                  warnings.length > 0 ||
                  isSubmitting
                }
              >
                {isSubmitting ? "Confirm in wallet…" : "Initialize campaign"}
              </Button>
            </>
          );
        }}
      </campaignForm.Subscribe>
    </form>
  );
}
