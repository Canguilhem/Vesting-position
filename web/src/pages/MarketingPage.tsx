import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { EXPLORER_PROGRAM_URL, PROGRAM_ID } from "../config";
import { VestingCalculator } from "../components/VestingCalculator";
import { ClaimingWindowTimeline } from "../components/ClaimingWindowTimeline";
import {
  ExternalLinkIcon,
  TruncatedExplorerLink,
} from "../components/Common/Common";

const HIGHLIGHTS = [
  "Merkle allowlists",
  "Tradeable mpl-core NFTs",
  "Partial claims",
  "Flexible cliffs",
  "Loyalty badges",
] as const;

const STEPS = [
  {
    step: "01",
    title: "Launch campaign",
    body: "Deposit tokens, set vesting and cliff rules, and publish a Merkle root for per-wallet allocations.",
  },
  {
    step: "02",
    title: "Mint position",
    body: "Recipients prove allowlist membership on first claim. An mpl-core Asset encodes their schedule on-chain.",
  },
  {
    step: "03",
    title: "Claim & trade",
    body: "Claim vested tokens over time, transfer the NFT, or sell the remaining position: holders inherit claim rights.",
  },
  {
    step: "04",
    title: "Badge or clawback",
    body: "Fully vested positions freeze as loyalty badges. Unclaimed allocations return to the creator after grace.",
  },
] as const;

export function MarketingPage() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-10">
      <section className="mb-20 space-y-8">
        <div className="max-w-3xl space-y-5">
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Turn token vesting into{" "}
            <span className="text-accent">tradeable on-chain assets</span>
          </h1>
          <p className="text-lg leading-relaxed text-muted sm:text-xl">
            Each allocation becomes an mpl-core NFT: transferable, composable,
            and readable without off-chain indexing. Projects get programmable
            loyalty; recipients get optionality.
          </p>
        </div>

        <ul className="flex flex-wrap gap-2">
          {HIGHLIGHTS.map((item) => (
            <li
              key={item}
              className="rounded-full border border-border-low bg-card/60 px-3 py-1 text-xs text-muted"
            >
              {item}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-3 justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-highlight animate-pulse" />
            Live on Solana Devnet · Turbine Builder Cohort Q2 2026
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
              className="inline-flex items-center gap-2 rounded-xl border border-border-low bg-card px-5 py-3 text-sm font-semibold transition hover:border-accent/30"
            >
              <ExternalLinkIcon size={16} />
              View on Explorer
            </a>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 mb-20 space-y-8">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            How it works
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">
            From campaign launch to loyalty badge
          </h2>
          <p className="text-muted">
            A single lifecycle replaces static vesting spreadsheets with
            composable on-chain positions and a clear claiming window.
          </p>
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

      <div className="mb-20">
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
          <h2 className="text-2xl font-semibold tracking-tight">Program ID</h2>
          <p className="max-w-2xl text-sm text-muted">
            Deployed on devnet. Copy the program address or inspect it on Solana
            Explorer.
          </p>
        </div>

        <div className="mt-4 rounded-lg border border-border-low bg-background/60 px-4 py-3">
          <p className="text-xs text-muted">Program ID (devnet)</p>
          <div className="mt-1">
            <TruncatedExplorerLink address={PROGRAM_ID} head={12} tail={12} />
          </div>
        </div>
      </section>
    </main>
  );
}
