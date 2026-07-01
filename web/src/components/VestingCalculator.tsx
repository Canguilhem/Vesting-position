import { useMemo, useState } from "react";
import {
  computeVesting,
  formatPercent,
  formatTokens,
} from "../lib/vesting";

const DAY = 86_400;
const MONTH = 30 * DAY;

function toInputDate(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 16);
}

function fromInputDate(value: string): number {
  return Math.floor(new Date(value).getTime() / 1000);
}

export function VestingCalculator() {
  const now = Math.floor(Date.now() / 1000);
  const [allocation, setAllocation] = useState(1_000_000);
  const [claimedSoFar, setClaimedSoFar] = useState(0);
  const [start, setStart] = useState(now - 3 * MONTH);
  const [end, setEnd] = useState(now + 9 * MONTH);
  const [cliffDays, setCliffDays] = useState(90);
  const [cliffReleaseBps, setCliffReleaseBps] = useState(1000);
  const [simulatedNow, setSimulatedNow] = useState(now);

  const result = useMemo(
    () =>
      computeVesting({
        allocation,
        claimedSoFar,
        start,
        end,
        cliffDurationSec: cliffDays * DAY,
        cliffReleaseBps,
        now: simulatedNow,
      }),
    [
      allocation,
      claimedSoFar,
      start,
      end,
      cliffDays,
      cliffReleaseBps,
      simulatedNow,
    ],
  );

  const progress =
    allocation > 0 ? Math.min(100, (result.totalVested / allocation) * 100) : 0;

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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Allocation (raw units)</span>
            <input
              type="number"
              min={0}
              value={allocation}
              onChange={(e) => setAllocation(Number(e.target.value))}
              className="w-full rounded-lg border border-border-low bg-background px-3 py-2 font-mono text-sm outline-none focus:border-accent/50"
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Already claimed</span>
            <input
              type="number"
              min={0}
              max={allocation}
              value={claimedSoFar}
              onChange={(e) => setClaimedSoFar(Number(e.target.value))}
              className="w-full rounded-lg border border-border-low bg-background px-3 py-2 font-mono text-sm outline-none focus:border-accent/50"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Start</span>
              <input
                type="datetime-local"
                value={toInputDate(start)}
                onChange={(e) => setStart(fromInputDate(e.target.value))}
                className="w-full rounded-lg border border-border-low bg-background px-3 py-2 text-sm outline-none focus:border-accent/50"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">End</span>
              <input
                type="datetime-local"
                value={toInputDate(end)}
                onChange={(e) => setEnd(fromInputDate(e.target.value))}
                className="w-full rounded-lg border border-border-low bg-background px-3 py-2 text-sm outline-none focus:border-accent/50"
              />
            </label>
          </div>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">
              Cliff duration — {cliffDays} days
            </span>
            <input
              type="range"
              min={0}
              max={365}
              value={cliffDays}
              onChange={(e) => setCliffDays(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">
              Cliff release — {formatPercent(cliffReleaseBps)}
            </span>
            <input
              type="range"
              min={0}
              max={10000}
              step={100}
              value={cliffReleaseBps}
              onChange={(e) => setCliffReleaseBps(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Simulated time</span>
            <input
              type="datetime-local"
              value={toInputDate(simulatedNow)}
              onChange={(e) => setSimulatedNow(fromInputDate(e.target.value))}
              className="w-full rounded-lg border border-border-low bg-background px-3 py-2 text-sm outline-none focus:border-accent/50"
            />
          </label>
        </div>

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
                  {formatTokens(allocation - result.totalVested)}
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
      </div>
    </section>
  );
}
