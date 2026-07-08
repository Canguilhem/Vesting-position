import { Link } from "react-router-dom";
import { CONTACT_EMAIL, SETUP_CALL_URL, contactMailto } from "../../lib/gtm";
import { AppCard, SectionHeader } from "../Common/Common";
import { Button } from "@/components/ui/button";

const SECTION_GRADIENT = "from-primary via-chart-2 to-chart-4";

export function ForProjectsSection() {
  const demoMailto = contactMailto(
    "Vesting Positions demo request",
    [
      "Hi, we would like to see a demo.",
      "",
      "Project name:",
      "Launch timeline:",
      "Approx. recipients:",
    ].join("\n")
  );

  return (
    <section id="for-projects" className="scroll-mt-24">
      <div
        className={`rounded-xl p-px shadow-[0_0_12px_-4px_var(--accent-glow)] ${SECTION_GRADIENT}`}
      >
        <AppCard
          variant="elevated"
          padding="xl"
          className="rounded-[calc(var(--radius-xl)-1px)] border-0 bg-background/70 text-center backdrop-blur-sm"
        >
          <div className="flex flex-col items-center gap-7">
            <SectionHeader
              title="Contact us for a guided demo"
              description="Launching an airdrop, team allocation, or community vest? We will walk you through a devnet campaign end to end: allowlist, schedule, claims, and position NFTs recipients can trade."
              className="mx-auto max-w-2xl"
            />

            <div className="mx-auto grid w-full max-w-3xl gap-3 sm:grid-cols-3">
              {[
                {
                  k: "setup",
                  t: "30 min setup",
                  d: "We prep allowlist and schedule together.",
                },
                {
                  k: "pilot",
                  t: "Devnet pilot",
                  d: "Run a real campaign flow before mainnet.",
                },
                {
                  k: "feedback",
                  t: "Fast feedback loop",
                  d: "We iterate on UX and the protocol edge cases.",
                },
              ].map((item) => (
                <AppCard
                  key={item.k}
                  variant="inset"
                  padding="md"
                  className="gap-1 text-left"
                >
                  <p className="text-sm font-semibold">{item.t}</p>
                  <p className="text-xs text-muted-foreground">{item.d}</p>
                </AppCard>
              ))}
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {SETUP_CALL_URL ? (
                <Button asChild size="lg">
                  <a href={SETUP_CALL_URL} target="_blank" rel="noreferrer">
                    Book a demo
                  </a>
                </Button>
              ) : (
                <Button asChild size="lg">
                  <a href={demoMailto}>Contact us for a demo</a>
                </Button>
              )}
              <Button asChild variant="outline" size="lg">
                <Link to="/app">Explore the devnet app</Link>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-accent hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              {SETUP_CALL_URL ? (
                <>
                  {" · "}
                  <a
                    href={SETUP_CALL_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    Schedule a call
                  </a>
                </>
              ) : null}
            </p>
          </div>
        </AppCard>
      </div>
    </section>
  );
}
