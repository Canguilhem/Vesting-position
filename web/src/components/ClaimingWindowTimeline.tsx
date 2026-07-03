/**
 * Illustrative claiming-window timeline for the marketing page.
 * Proportions are schematic (not tied to a real campaign).
 */

const VESTING_PCT = 62;
const GRACE_PCT = 23;
const GRACE_END_PCT = VESTING_PCT + GRACE_PCT;
/** Cliff sits early in the vesting segment (schematic). */
const CLIFF_PCT = 10;
const NOW_PCT = 38;

/** Example defaults — matches typical devnet campaign form. */
const EXAMPLE_CLIFF_RELEASE_BPS = 1000;

const PHASES = [
  {
    key: "vesting",
    title: "Vesting",
    badge: "Claims open",
    badgeClass: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30",
    recipient:
      "After start, wait out the cliff (if any) — then claim the cliff release % and anything vested linearly since. Transfer the NFT to sell remaining upside.",
    creator: "Tokens stream out as recipients claim.",
  },
  {
    key: "grace",
    title: "Grace period",
    badge: "Last chance",
    badgeClass: "bg-amber-500/20 text-amber-300 ring-amber-500/30",
    recipient:
      "Vesting is done — claim any remainder before the window closes.",
    creator: "Wait; clawback is not available yet.",
  },
  {
    key: "clawback",
    title: "After grace",
    badge: "Clawback open",
    badgeClass: "bg-red-500/20 text-red-300 ring-red-500/30",
    recipient: "Unclaimed allocations are gone — creator can recover them.",
    creator: "Claw back unclaimed tokens from no-shows.",
  },
] as const;

const BOUNDARIES = [
  { pct: 0, label: "Start", sublabel: "Campaign opens", align: "start" as const },
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
  const cliffReleaseLabel = formatExampleCliffRelease(EXAMPLE_CLIFF_RELEASE_BPS);

  const trackGradient = `linear-gradient(to right,
    rgb(16 185 129 / 0.55) 0%,
    rgb(16 185 129 / 0.55) ${VESTING_PCT}%,
    rgb(245 158 11 / 0.55) ${VESTING_PCT}%,
    rgb(245 158 11 / 0.55) ${GRACE_END_PCT}%,
    rgb(239 68 68 / 0.25) ${GRACE_END_PCT}%,
    rgb(239 68 68 / 0.25) 100%)`;

  return (
    <div className="rounded-xl border border-border-low bg-card/40 p-5 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Claiming window</p>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">
            Each campaign sets a cliff duration and cliff release % (basis
            points). Nothing is claimable before the cliff ends; at cliff, that
            % unlocks immediately and the remainder vests linearly to{" "}
            <span className="text-foreground/80">end</span>. After vesting, a
            grace buffer, then creator clawback of unclaimed tokens.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border-low bg-background/60 px-3 py-1.5 text-[11px] text-muted">
          <span
            className="h-2 w-2 rounded-full bg-highlight shadow-[0_0_8px_var(--color-highlight)]"
            aria-hidden
          />
          Example: you are here (mid-vest)
        </div>
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

          <div
            className="absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-highlight bg-background shadow-[0_0_12px_var(--color-highlight)]"
            style={{ left: `${NOW_PCT}%` }}
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
            <span className="mt-0.5 whitespace-nowrap text-[10px] text-muted">
              {cliffReleaseLabel} unlocks
            </span>
            <span className="whitespace-nowrap text-[10px] text-muted/80">
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
              <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-muted">
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
          <article
            key={phase.key}
            className="rounded-lg border border-border-low bg-background/50 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">{phase.title}</h4>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${phase.badgeClass}`}
              >
                {phase.badge}
              </span>
            </div>
            <dl className="mt-3 space-y-2 text-xs leading-relaxed">
              <div>
                <dt className="font-medium text-foreground/70">Recipients</dt>
                <dd className="mt-0.5 text-muted">{phase.recipient}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground/70">Creator</dt>
                <dd className="mt-0.5 text-muted">{phase.creator}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-muted">
        Cliff is optional per campaign (0 days = no wait). Release % is 0–100%
        in basis points — e.g. {cliffReleaseLabel} at cliff with{" "}
        {100 - EXAMPLE_CLIFF_RELEASE_BPS / 100}% vesting linearly until end.
        Try different values in the{" "}
        <a href="#calculator" className="text-accent hover:underline">
          vesting simulator
        </a>
        .
      </p>
    </div>
  );
}
