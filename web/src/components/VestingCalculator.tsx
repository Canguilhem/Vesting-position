import { useMemo } from "react";
import { useForm } from "@tanstack/react-form";
import {
  computeVesting,
  formatPercent,
  formatTokens,
} from "../lib/vesting";
import { fieldClassName, labelClassName } from "./form-styles";

const DAY = 86_400;
const MONTH = 30 * DAY;

type CalculatorFormValues = {
  allocation: number;
  claimedSoFar: number;
  start: number;
  end: number;
  cliffDays: number;
  cliffReleaseBps: number;
  simulatedNow: number;
};

function toInputDate(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromInputDate(value: string): number {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) {
    return Math.floor(new Date(value).getTime() / 1000);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? 0);
  return Math.floor(
    new Date(year, month - 1, day, hour, minute, second, 0).getTime() / 1000,
  );
}

function createDefaultCalculatorValues(): CalculatorFormValues {
  const now = Math.floor(Date.now() / 1000);
  return {
    allocation: 1_000_000,
    claimedSoFar: 0,
    start: now - 3 * MONTH,
    end: now + 9 * MONTH,
    cliffDays: 90,
    cliffReleaseBps: 1000,
    simulatedNow: now,
  };
}

function CalculatorResults({ values }: { values: CalculatorFormValues }) {
  const result = useMemo(
    () =>
      computeVesting({
        allocation: values.allocation,
        claimedSoFar: values.claimedSoFar,
        start: values.start,
        end: values.end,
        cliffDurationSec: values.cliffDays * DAY,
        cliffReleaseBps: values.cliffReleaseBps,
        now: values.simulatedNow,
      }),
    [values],
  );

  const progress =
    values.allocation > 0
      ? Math.min(100, (result.totalVested / values.allocation) * 100)
      : 0;

  return (
    <div className="flex flex-col justify-between gap-6 rounded-xl border border-border-low bg-background/60 p-5">
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">
            Claimable now
          </p>
          <p className="mt-1 font-mono text-3xl font-semibold text-accent">
            {formatTokens(result.claimable)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted">Total vested</p>
            <p className="font-mono font-medium">
              {formatTokens(result.totalVested)}
            </p>
          </div>
          <div>
            <p className="text-muted">Remaining</p>
            <p className="font-mono font-medium">
              {formatTokens(values.allocation - result.totalVested)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted">
          <span>Vesting progress</span>
          <span>{progress.toFixed(1)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-border-low">
          <div
            className="h-full rounded-full bg-linear-to-r from-accent to-highlight transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-muted">
          {result.beforeCliff
            ? "Before cliff — nothing claimable yet (position can still be minted on first claim)."
            : result.fullyVested
              ? "Fully vested — position becomes a permanent loyalty badge after final claim."
              : "Linear vesting active between cliff and end."}
        </p>
      </div>
    </div>
  );
}

export function VestingCalculator() {
  const form = useForm({
    defaultValues: createDefaultCalculatorValues(),
  });

  return (
    <section
      id="calculator"
      className="scroll-mt-24 space-y-6 rounded-2xl border border-border-low bg-card p-6 shadow-[0_24px_80px_-48px_rgba(124,58,237,0.35)]"
    >
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Interactive demo
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">
          Vesting schedule simulator
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Same formula as on-chain: cliff release plus linear vesting from cliff
          to end. Drag the timeline to see claimable amounts change over time.
        </p>
      </div>

      <form.Subscribe selector={(state) => state.values}>
        {(values) => (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <label className={labelClassName()}>
                <span className="font-medium">Allocation (raw units)</span>
                <form.Field name="allocation">
                  {(field) => (
                    <input
                      type="number"
                      min={0}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(Number(e.target.value) || 0)
                      }
                      className={`${fieldClassName()} font-mono`}
                    />
                  )}
                </form.Field>
              </label>

              <label className={labelClassName()}>
                <span className="font-medium">Already claimed</span>
                <form.Field name="claimedSoFar">
                  {(field) => (
                    <input
                      type="number"
                      min={0}
                      max={values.allocation}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(Number(e.target.value) || 0)
                      }
                      className={`${fieldClassName()} font-mono`}
                    />
                  )}
                </form.Field>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className={labelClassName()}>
                  <span className="font-medium">Start</span>
                  <form.Field name="start">
                    {(field) => (
                      <input
                        type="datetime-local"
                        value={toInputDate(field.state.value)}
                        onBlur={field.handleBlur}
                        onChange={(e) =>
                          field.handleChange(fromInputDate(e.target.value))
                        }
                        className={fieldClassName()}
                      />
                    )}
                  </form.Field>
                </label>
                <label className={labelClassName()}>
                  <span className="font-medium">End</span>
                  <form.Field name="end">
                    {(field) => (
                      <input
                        type="datetime-local"
                        value={toInputDate(field.state.value)}
                        onBlur={field.handleBlur}
                        onChange={(e) =>
                          field.handleChange(fromInputDate(e.target.value))
                        }
                        className={fieldClassName()}
                      />
                    )}
                  </form.Field>
                </label>
              </div>

              <form.Field name="cliffDays">
                {(field) => (
                  <label className={labelClassName()}>
                    <span className="font-medium">
                      Cliff duration — {field.state.value} days
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={365}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(Number(e.target.value))
                      }
                      className="w-full accent-accent"
                    />
                  </label>
                )}
              </form.Field>

              <form.Field name="cliffReleaseBps">
                {(field) => (
                  <label className={labelClassName()}>
                    <span className="font-medium">
                      Cliff release — {formatPercent(field.state.value)}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={10000}
                      step={100}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(Number(e.target.value))
                      }
                      className="w-full accent-accent"
                    />
                  </label>
                )}
              </form.Field>

              <label className={labelClassName()}>
                <span className="font-medium">Simulated time</span>
                <form.Field name="simulatedNow">
                  {(field) => (
                    <input
                      type="datetime-local"
                      value={toInputDate(field.state.value)}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(fromInputDate(e.target.value))
                      }
                      className={fieldClassName()}
                    />
                  )}
                </form.Field>
              </label>
            </div>

            <CalculatorResults values={values} />
          </div>
        )}
      </form.Subscribe>
    </section>
  );
}
