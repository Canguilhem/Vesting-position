import type { Address } from "@solana/addresses";
import type { InitializeResult } from "../lib/initialize";
import { formatTokens } from "../lib/vesting";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ExplorerLinkButton,
  TruncatedExplorerLink,
  TruncatedTxLink,
} from "./Common/Common";
import { AppCallout, AppCard } from "./Common/AppCard";

function AddressRow({ label, value }: { label: string; value: string }) {
  return (
    <AppCard variant="inset" padding="sm">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">
        <TruncatedExplorerLink address={value} head={10} tail={10} />
      </dd>
    </AppCard>
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
  return (
    <Dialog
      open={result != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="gap-0 rounded-2xl border-border-low p-6 sm:max-w-lg">
        {result && (
          <>
            <DialogHeader className="space-y-1 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
                Success
              </p>
              <DialogTitle className="text-xl font-semibold">
                Campaign initialized
              </DialogTitle>
              <DialogDescription>
                Deposited {formatTokens(result.totalDeposit)} tokens. Recipients
                can claim after the start time if they are on the allowlist.
              </DialogDescription>
            </DialogHeader>

            <dl className="mt-5 space-y-2">
              <AddressRow label="Campaign PDA" value={result.campaign} />
              <AddressRow label="Collection" value={result.collection} />
              <AddressRow label="Token mint" value={result.mint} />
            </dl>

            {result.registryPersistError && (
              <AppCallout tone="warning" className="mt-4">
                Campaign is live on-chain, but saving the registry failed:{" "}
                {result.registryPersistError}
              </AppCallout>
            )}

            {result.allowlistPersistError && (
              <AppCallout tone="warning" className="mt-4">
                Campaign is live on-chain, but saving the allowlist failed:{" "}
                {result.allowlistPersistError}
              </AppCallout>
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

            <DialogFooter className="mt-5 border-0 bg-transparent p-0 sm:justify-start">
              <ExplorerLinkButton
                href={result.initializeExplorerUrl}
                label="View transaction on explorer"
              />
              {onViewCampaign && (
                <Button
                  type="button"
                  onClick={() => {
                    onViewCampaign(result.campaign);
                    onClose();
                  }}
                >
                  View campaign
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>

            <p className="mt-4 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
              <span>Tx</span>
              <TruncatedTxLink
                signature={result.initializeSignature}
                head={12}
                tail={12}
              />
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
