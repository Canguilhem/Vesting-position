import type { Address } from "@solana/addresses";
import type { InitializeResult } from "../lib/initialize";
import { formatTokens } from "../lib/vesting";
import { truncate } from "../lib/utils";

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border-low bg-background/50 px-3 py-2">
      <div className="min-w-0">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="mt-0.5 font-mono text-xs break-all">{value}</dd>
      </div>
      <button
        type="button"
        onClick={() => navigator.clipboard.writeText(value)}
        className="shrink-0 rounded-md border border-border-low px-2 py-1 text-xs text-muted transition hover:border-accent/40 hover:text-foreground cursor-pointer"
      >
        Copy
      </button>
    </div>
  );
}

export function CampaignSuccessModal({
  result,
  onClose,
  onViewCampaign,
}: {
  result: InitializeResult | null;
  onClose: () => void;
  onViewCampaign?: (campaign: Address) => void;
}) {
  if (!result) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-success-title"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border-low bg-card p-6 shadow-2xl">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Success
          </p>
          <h3 id="campaign-success-title" className="text-xl font-semibold">
            Campaign initialized
          </h3>
          <p className="text-sm text-muted">
            Deposited {formatTokens(result.totalDeposit)} tokens. Recipients can
            claim after the start time if they are on the allowlist.
          </p>
        </div>

        <dl className="mt-5 space-y-2">
          <CopyRow label="Campaign PDA" value={result.campaign} />
          <CopyRow label="Collection" value={result.collection} />
          <CopyRow label="Token mint" value={result.mint} />
        </dl>

        {result.registryPersistError && (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Campaign is live on-chain, but saving the registry failed:{" "}
            {result.registryPersistError}
          </p>
        )}

        {result.allowlistPersistError && (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Campaign is live on-chain, but saving the allowlist failed:{" "}
            {result.allowlistPersistError}
          </p>
        )}

        {result.registrySaved && (
          <p className="mt-4 text-xs text-emerald-400">
            Campaign registered for browse and discovery.
          </p>
        )}

        {result.allowlistSaved && (
          <p className="mt-4 text-xs text-emerald-400">
            Allowlist saved — recipients can claim with proofs from this
            campaign.
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={result.initializeExplorerUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-border-low px-4 py-2 text-sm font-medium transition hover:border-accent/30"
          >
            View transaction
          </a>
          {onViewCampaign && (
            <button
              type="button"
              onClick={() => {
                onViewCampaign(result.campaign);
                onClose();
              }}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:brightness-110 cursor-pointer"
            >
              View campaign
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-low px-4 py-2 text-sm transition hover:border-accent/30 cursor-pointer"
          >
            Close
          </button>
        </div>

        <p className="mt-4 font-mono text-[10px] text-muted break-all">
          Tx: {truncate(result.initializeSignature, 12, 12)}
        </p>
      </div>
    </div>
  );
}
