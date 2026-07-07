import { useEffect, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import type { Address } from "@solana/addresses";
import {
  createDefaultCampaignFormValues,
  type InitializeResult,
} from "../../lib/initialize";
import type { AllowListSnapshot } from "../../lib/allow-list";
import { totalAllowlistAllocationRaw } from "../../lib/allow-list";
import { useInitialize } from "../../hooks/useInitialize";
import { rawToTokens } from "../../lib/vesting";
import { CampaignSuccessModal } from "../CampaignSuccessModal";
import { Button } from "@/components/ui/button";
import { AppCallout, AppCard } from "../Common/AppCard";
import { PageHeader } from "../Common/PageHeader";
import { LaunchStepIndicator } from "./LaunchStepIndicator";
import { LaunchStepAllowlist } from "./LaunchStepAllowlist";
import { LaunchStepSettings } from "./LaunchStepSettings";
import {
  LaunchStepToken,
  type LaunchStepTokenHandle,
  type TokenStepMode,
} from "./LaunchStepToken";

type LaunchStep = 1 | 2 | 3;

export function LaunchCampaignWizard({
  prefilledMint,
  onViewCampaign,
}: {
  prefilledMint?: Address | null;
  onViewCampaign?: (campaign: Address) => void;
}) {
  const [step, setStep] = useState<LaunchStep>(1);
  const [maxReached, setMaxReached] = useState<LaunchStep>(1);
  const [tokenMode, setTokenMode] = useState<TokenStepMode>("existing");
  const [mint, setMint] = useState(prefilledMint ? String(prefilledMint) : "");
  const [allowlistSnapshot, setAllowlistSnapshot] =
    useState<AllowListSnapshot | null>(null);
  const [allowlistError, setAllowlistError] = useState<string | null>(null);
  const [allowlistParsing, setAllowlistParsing] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [lastResult, setLastResult] = useState<InitializeResult | null>(null);

  const tokenStepRef = useRef<LaunchStepTokenHandle>(null);
  const { initialize } = useInitialize();

  const form = useForm({
    defaultValues: createDefaultCampaignFormValues(
      prefilledMint ? String(prefilledMint) : null,
    ),
    onSubmit: async ({ value }) => {
      if (!allowlistSnapshot) {
        setSubmitError("Upload an allowlist before launching.");
        return;
      }

      setSubmitError(null);
      try {
        const result = await initialize(value, { allowlistSnapshot });
        setLastResult(result);
        setShowModal(true);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : String(err));
      }
    },
  });

  useEffect(() => {
    if (prefilledMint) {
      setMint(String(prefilledMint));
      form.setFieldValue("mint", String(prefilledMint));
    }
  }, [prefilledMint, form]);

  useEffect(() => {
    if (mint.trim()) {
      form.setFieldValue("mint", mint.trim());
    }
  }, [mint, form]);

  useEffect(() => {
    if (!allowlistSnapshot) return;
    form.setFieldValue("merkleRootHex", allowlistSnapshot.merkleRoot);
    const totalRaw = totalAllowlistAllocationRaw(allowlistSnapshot);
    form.setFieldValue("totalDeposit", String(rawToTokens(totalRaw)));
  }, [allowlistSnapshot, form]);

  function goToStep(next: LaunchStep) {
    setStepError(null);
    setStep(next);
    setMaxReached((prev) => (next > prev ? next : prev));
  }

  async function handleNext() {
    setStepError(null);

    if (step === 1) {
      const result = await tokenStepRef.current?.advance();
      if (!result?.ok) {
        setStepError(result?.error ?? "Complete the token step first.");
        return;
      }
      goToStep(2);
      return;
    }

    if (step === 2) {
      if (!allowlistSnapshot) {
        setStepError("Upload an allowlist CSV before continuing.");
        return;
      }
      goToStep(3);
    }
  }

  function handleBack() {
    setStepError(null);
    if (step === 2) goToStep(1);
    if (step === 3) goToStep(2);
  }

  const nextLabel =
    step === 1 && tokenMode === "create" && !mint.trim()
      ? "Create token & continue"
      : "Continue";

  return (
    <>
      <AppCard variant="panel" padding="lg" className="gap-6">
        <div className="space-y-4">
          <PageHeader
            title="Launch a campaign"
            description="Step-by-step: choose or create a distribution token, upload your allowlist, then configure vesting and initialize on devnet."
            className="block"
          />

          <LaunchStepIndicator
            current={step}
            maxReached={maxReached}
            onGoTo={goToStep}
          />
        </div>

        {step === 1 && (
          <LaunchStepToken
            ref={tokenStepRef}
            mode={tokenMode}
            mint={mint}
            onModeChange={setTokenMode}
            onMintChange={setMint}
          />
        )}

        {step === 2 && (
          <LaunchStepAllowlist
            snapshot={allowlistSnapshot}
            error={allowlistError}
            parsing={allowlistParsing}
            onSnapshotChange={setAllowlistSnapshot}
            onErrorChange={setAllowlistError}
            onParsingChange={setAllowlistParsing}
          />
        )}

        {step === 3 && (
          <LaunchStepSettings
            campaignForm={form}
            mint={mint}
            allowlistSnapshot={allowlistSnapshot}
            submitError={submitError}
            onSubmit={() => void form.handleSubmit()}
          />
        )}

        {stepError && (
          <AppCallout tone="error">{stepError}</AppCallout>
        )}

        {step < 3 && (
          <div className="flex flex-wrap gap-3">
            {step > 1 && (
              <Button type="button" variant="outline" onClick={handleBack}>
                Back
              </Button>
            )}
            <Button type="button" onClick={() => void handleNext()}>
              {nextLabel}
            </Button>
          </div>
        )}

        {step === 3 && (
          <Button type="button" variant="outline" onClick={handleBack}>
            Back to allowlist
          </Button>
        )}
      </AppCard>

      <CampaignSuccessModal
        result={showModal ? lastResult : null}
        onClose={() => {
          setShowModal(false);
          setLastResult(null);
        }}
        onViewCampaign={(campaign) => {
          onViewCampaign?.(campaign);
        }}
      />
    </>
  );
}
