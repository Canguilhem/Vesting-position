/**
 * Illustrative claiming-window timeline for the marketing page.
 * Proportions are schematic (not tied to a real campaign).
 */

import { AppCard } from "./Common/AppCard";
import { GradientOutlineBadge } from "./Common/GradientOutlineBadge";

const VESTING_PCT = 62;
const GRACE_PCT = 23;
const GRACE_END_PCT = VESTING_PCT + GRACE_PCT;
/** Cliff sits early in the vesting segment (schematic). */
const CLIFF_PCT = 10;

/** Example defaults — matches typical devnet campaign form. */
const EXAMPLE_CLIFF_RELEASE_BPS = 1000;

const PHASES = [
  {
    key: "vesting",
    title: "Vesting",
    badge: "Claims open",
    gradient: "from-emerald-500 to-chart-2",
    recipient:
      "After start, wait out the cliff (if any) then claim the cliff release % and anything vested linearly since. Transfer the NFT to sell remaining upside.",
    creator: "Tokens stream out as recipients claim.",
  },
  {
    key: "grace",
    title: "Grace period",
    badge: "Last chance",
    gradient: "from-amber-500 to-chart-5",
    recipient: "Vesting is done: claim any remainder before the window closes.",
    creator: "Wait; clawback is not available yet.",
  },
  {
    key: "clawback",
    title: "After grace",
    badge: "Clawback open",
    gradient: "from-red-500 to-chart-4",
    recipient: "Unclaimed allocations are gone: creator can recover them.",
    creator: "Claw back unclaimed tokens from no-shows.",
  },
] as const;

const BOUNDARIES = [
  {
    pct: 0,
    label: "Start",
    sublabel: "Campaign opens",
    align: "start" as const,
  },
  {
    pct: VESTING_PCT,
    label: "End",
    sublabel: "Vesting complete",
    align: "center" as const,
  },
  {
    pct: GRACE_END_PCT,
    label: "Grace ends",
    sublabel: "Clawback opens",
    align: "center" as const,
  },
];

function boundaryTransform(align: "start" | "center" | "end"): string {
  if (align === "start") return "translateX(0)";
  if (align === "end") return "translateX(-100%)";
  return "translateX(-50%)";
}

function formatExampleCliffRelease(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

export function ClaimingWindowTimeline() {
  const cliffReleaseLabel = formatExampleCliffRelease(
    EXAMPLE_CLIFF_RELEASE_BPS
  );

  const trackGradient = `linear-gradient(to right,
    rgb(16 185 129 / 0.55) 0%,
    rgb(16 185 129 / 0.55) ${VESTING_PCT}%,
    rgb(245 158 11 / 0.55) ${VESTING_PCT}%,
    rgb(245 158 11 / 0.55) ${GRACE_END_PCT}%,
    rgb(239 68 68 / 0.25) ${GRACE_END_PCT}%,
    rgb(239 68 68 / 0.25) 100%)`;

  return (
    <AppCard variant="muted" padding="lg" className="gap-6 sm:p-6">
      <div>
        <p className="text-sm font-medium">Claiming window</p>
        <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
          Each campaign sets a cliff duration and cliff release % (basis
          points). Nothing is claimable before the cliff ends; at cliff, that
          % unlocks immediately and the remainder vests linearly to{" "}
          <span className="text-foreground/80">end</span>. After vesting, a
          grace buffer, then creator clawback of unclaimed tokens.
        </p>
      </div>

      <div>
        <div
          className="relative h-4 rounded-full ring-1 ring-border-low"
          style={{ background: trackGradient }}
          role="img"
          aria-label="Schematic timeline: vesting with optional cliff, grace period, then clawback"
        >
          {BOUNDARIES.slice(1).map(({ pct }) => (
            <div
              key={pct}
              className="absolute inset-y-0 w-px bg-background/50"
              style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
            />
          ))}

          <div
            className="absolute inset-y-0 w-0.5 bg-accent"
            style={{ left: `${CLIFF_PCT}%`, transform: "translateX(-50%)" }}
            title="Cliff end — configurable per campaign"
          />
        </div>

        {/* Cliff annotation — separate row so it does not overlap Start */}
        <div className="relative mt-2 h-9 w-full" aria-hidden>
          <div
            className="absolute top-0 flex flex-col items-center text-center"
            style={{ left: `${CLIFF_PCT}%`, transform: "translateX(-50%)" }}
          >
            <span className="whitespace-nowrap text-[10px] font-medium text-accent">
              Cliff ends
            </span>
            <span className="mt-0.5 whitespace-nowrap text-[10px] text-muted-foreground">
              {cliffReleaseLabel} unlocks
            </span>
            <span className="whitespace-nowrap text-[10px] text-muted-foreground/80">
              then linear vest
            </span>
          </div>
        </div>

        <div className="relative mt-1 h-9 w-full" aria-hidden>
          {BOUNDARIES.map(({ pct, label, sublabel, align }) => (
            <div
              key={label}
              className="absolute top-0"
              style={{
                left: `${pct}%`,
                transform: boundaryTransform(align),
                textAlign: align === "center" ? "center" : align,
              }}
            >
              <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {label}
              </span>
              {sublabel && (
                <span className="mt-0.5 block whitespace-nowrap text-[11px] text-foreground/80">
                  {sublabel}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {PHASES.map((phase) => (
          <AppCard key={phase.key} variant="tile" padding="md">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">{phase.title}</h4>
              <GradientOutlineBadge gradient={phase.gradient}>
                {phase.badge}
              </GradientOutlineBadge>
            </div>
            <dl className="mt-3 space-y-2 text-xs leading-relaxed">
              <div>
                <dt className="font-medium text-foreground/70 underline">
                  Recipients
                </dt>
                <dd className="mt-0.5 text-muted-foreground">
                  {phase.recipient}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground/70 underline">
                  Creator
                </dt>
                <dd className="mt-0.5 text-muted-foreground">
                  {phase.creator}
                </dd>
              </div>
            </dl>
          </AppCard>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Cliff is optional per campaign (0 days = no wait). Release % is 0–100%
        in basis points — e.g. {cliffReleaseLabel} at cliff with{" "}
        {100 - EXAMPLE_CLIFF_RELEASE_BPS / 100}% vesting linearly until end. Try
        different values in the{" "}
        <a href="#calculator" className="text-accent hover:underline">
          vesting simulator
        </a>
        .
      </p>
    </AppCard>
  );
}
