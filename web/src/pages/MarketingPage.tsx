import { useEffect } from "react";
import { Link } from "react-router-dom";
import { EXPLORER_PROGRAM_URL, PROGRAM_ID } from "../config";
import { VestingCalculator } from "../components/VestingCalculator";
import { ClaimingWindowTimeline } from "../components/ClaimingWindowTimeline";

const FEATURES = [
  {
    title: "Tradeable positions",
    description:
      "Each vesting allocation is an mpl-core NFT Asset: transferable, composable, readable by any on-chain program.",
  },
  {
    title: "Partial claims",
    description:
      "Recipients claim a portion, then sell the remaining position on secondary markets before full vest.",
  },
  {
    title: "Merkle allowlists",
    description:
      "Per-recipient allocations in one campaign via Merkle tree: different amounts per wallet, verified on first claim.",
  },
  {
    title: "Flexible cliffs",
    description:
      "Configure cliff release from 0% (pure linear) to 100% (full unlock at cliff) per campaign.",
  },
  {
    title: "Transfer controls",
    description:
      "Set transferability at launch and adjust per collection or per asset with freeze instructions.",
  },
  {
    title: "Loyalty badges",
    description:
      "Fully claimed positions freeze permanently: on-chain proof of full vest, forever.",
  },
] as const;

const STEPS = [
  {
    step: "01",
    title: "Launch campaign",
    body: "Creator deposits tokens, sets schedule, and publishes a Merkle root for the allowlist.",
  },
  {
    step: "02",
    title: "Mint position",
    body: "Recipient proves allowlist membership on first claim. An mpl-core Asset encodes their schedule.",
  },
  {
    step: "03",
    title: "Claim & trade",
    body: "Hold or transfer the NFT. Any holder can claim vested tokens. Secondary buyers inherit claim rights.",
  },
  {
    step: "04",
    title: "Badge or clawback",
    body: "After full vest, the position becomes a loyalty badge. Unclaimed allocations return to creator after grace.",
  },
] as const;

function CopyButton({ value }: { value: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(value)}
      className="rounded-md border border-border-low px-2 py-1 text-xs text-muted transition hover:border-accent/40 hover:text-foreground cursor-pointer"
    >
      Copy
    </button>
  );
}

export function MarketingPage() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const target = document.querySelector(hash);
    target?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-16">
      <section className="mb-24 space-y-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-highlight animate-pulse" />
          Live on Solana Devnet · Turbine Builder Cohort Q2 2026
        </div>

        <div className="max-w-3xl space-y-5">
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Turn token vesting into{" "}
            <span className="text-accent">tradeable on-chain assets</span>
          </h1>
          <p className="text-lg leading-relaxed text-muted sm:text-xl">
            Vesting Positions transforms static allocations into mpl-core NFT
            primitives, transferable, composable with DeFi, and readable without
            off-chain indexing. Projects get programmable loyalty. Recipients
            get optionality.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href="#calculator"
            className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-fg shadow-[0_0_32px_-8px_var(--color-accent-glow)] transition hover:brightness-110"
          >
            Try the simulator
          </a>
          <Link
            to="/app"
            className="rounded-xl border border-border-low bg-card px-5 py-3 text-sm font-semibold transition hover:border-accent/30"
          >
            Open devnet app
          </Link>
          <a
            href={EXPLORER_PROGRAM_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-border-low bg-card px-5 py-3 text-sm font-semibold transition hover:border-accent/30"
          >
            View on Explorer
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Position type", value: "mpl-core Asset NFT" },
            { label: "Network", value: "Solana Devnet" },
            { label: "Stack", value: "Anchor + SPL Token" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border-low bg-card/60 px-4 py-3"
            >
              <p className="text-xs uppercase tracking-wider text-muted">
                {stat.label}
              </p>
              <p className="mt-1 text-sm font-medium">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="scroll-mt-24 mb-24 space-y-8">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Why it matters
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">
            Vesting that behaves like an asset class
          </h2>
          <p className="max-w-2xl text-muted">
            Today&apos;s vesting is administrative overhead. This protocol makes
            each allocation a first-class on-chain primitive with
            secondary-market liquidity and program composability.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="rounded-xl border border-border-low bg-card/50 p-5 transition hover:border-accent/25 hover:bg-card"
            >
              <h3 className="font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 mb-24 space-y-8">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Lifecycle
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">
            From campaign launch to loyalty badge
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((item) => (
            <article
              key={item.step}
              className="relative rounded-xl border border-border-low bg-card/50 p-5"
            >
              <span className="font-mono text-2xl font-bold text-accent/40">
                {item.step}
              </span>
              <h3 className="mt-3 font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {item.body}
              </p>
            </article>
          ))}
        </div>

        <ClaimingWindowTimeline />
      </section>

      <div className="mb-24">
        <VestingCalculator />
      </div>

      <section
        id="program"
        className="scroll-mt-24 rounded-2xl border border-border-low bg-card p-6"
      >
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            On-chain
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            Program & integration
          </h2>
          <p className="max-w-2xl text-sm text-muted">
            Connect your wallet in the{" "}
            <Link to="/app" className="text-accent hover:underline">
              devnet app
            </Link>{" "}
            to create tokens, launch campaigns, and claim vested allocations.
            Transactions are signed in your wallet and sent via framework-kit.
          </p>
        </div>

        <dl className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-low bg-background/60 px-4 py-3">
            <div>
              <dt className="text-xs text-muted">Program ID (devnet)</dt>
              <dd className="mt-1 font-mono text-sm break-all">{PROGRAM_ID}</dd>
            </div>
            <CopyButton value={PROGRAM_ID} />
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              to="/app"
              className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 font-medium text-accent transition hover:bg-accent/15"
            >
              Open devnet app →
            </Link>
            <a
              href={EXPLORER_PROGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-border-low px-4 py-2 transition hover:border-accent/30"
            >
              Solana Explorer →
            </a>
            <a
              href="https://turbin3.org"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-border-low px-4 py-2 transition hover:border-accent/30"
            >
              Turbine Builder Cohort →
            </a>
          </div>
        </dl>
      </section>
    </main>
  );
}
