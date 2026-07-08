import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { EXPLORER_PROGRAM_URL, PROGRAM_ID } from "../config";
import { VestingCalculator } from "../components/VestingCalculator";
import { ClaimingWindowTimeline } from "../components/ClaimingWindowTimeline";
import { ForProjectsSection } from "../components/marketing/ForProjectsSection";
import {
  ExternalLinkIcon,
  TruncatedExplorerLink,
  AppCard,
  PageHeader,
  GradientOutlineBadge,
} from "../components/Common/Common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const HIGHLIGHTS = [
  { label: "Merkle allowlists", gradient: "from-primary to-chart-2" },
  { label: "Tradeable mpl-core NFTs", gradient: "from-chart-2 to-chart-4" },
  { label: "Partial claims", gradient: "from-chart-4 to-primary" },
  { label: "Flexible cliffs", gradient: "from-primary via-chart-3 to-chart-2" },
  { label: "Loyalty badges", gradient: "from-chart-5 via-primary to-chart-2" },
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
        <PageHeader
          titleAs="h1"
          title={
            <>
              Turn token vesting into{" "}
              <span className="text-accent">tradeable on-chain assets</span>
            </>
          }
          description="Each allocation becomes an mpl-core NFT: transferable, composable, and readable without off-chain indexing. Projects get programmable loyalty; recipients get optionality."
        />

        <ul className="flex flex-wrap gap-2">
          {HIGHLIGHTS.map((item) => (
            <li key={item.label}>
              <GradientOutlineBadge gradient={item.gradient}>
                {item.label}
              </GradientOutlineBadge>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge
            variant="secondary"
            className="gap-2 border-accent/25 bg-accent/10 px-3 py-1 text-accent"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-highlight animate-pulse" />
            Live on Solana Devnet · Turbine Builder Cohort Q2 2026
          </Badge>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/app">Launch on devnet</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#for-projects">Contact for a demo</a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#calculator">Try the simulator</a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a
                href={EXPLORER_PROGRAM_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2"
              >
                <ExternalLinkIcon size={16} />
                Explorer
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 mb-20 space-y-8">
        <PageHeader
          eyebrow="How it works"
          title="From campaign launch to loyalty badge"
          description="A single lifecycle replaces static vesting spreadsheets with composable on-chain positions and a clear claiming window."
        />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((item) => (
            <AppCard key={item.step} variant="surface" padding="lg">
              <span className="font-mono text-2xl font-bold text-accent/40">
                {item.step}
              </span>
              <h3 className="mt-3 font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </AppCard>
          ))}
        </div>

        <ClaimingWindowTimeline />
      </section>

      <div className="mb-20">
        <VestingCalculator />
      </div>

      <AppCard
        id="program"
        variant="elevated"
        padding="xl"
        className="scroll-mt-24 gap-4 mb-20"
      >
        <PageHeader
          eyebrow="On-chain"
          title="Program ID"
          description="Deployed on devnet. Copy the program address or inspect it on Solana Explorer."
          className="block"
        />

        <AppCard variant="inset" padding="sm">
          <p className="text-xs text-muted-foreground">Program ID (devnet)</p>
          <div className="mt-1">
            <TruncatedExplorerLink address={PROGRAM_ID} head={12} tail={12} />
          </div>
        </AppCard>
      </AppCard>

      <ForProjectsSection />
    </main>
  );
}
