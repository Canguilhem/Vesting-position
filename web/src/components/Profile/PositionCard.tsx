import { Link } from "react-router-dom";
import { useTransferPosition } from "../../hooks/useTransferPosition";
import { useState } from "react";
import {
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
} from "../../lib/campaign-status";
import {
  EntityCard,
  EntityCardContent,
  EntityCardFooter,
  EntityCardHeader,
  EntityCardMeta,
  TruncatedExplorerLink,
  TruncatedTxLink,
} from "../Common/Common";
import { AppCard } from "../Common/AppCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTokens } from "../../lib/vesting";
import { appCampaignUrl } from "../../lib/app-routes";
import { PositionRecord } from "../../hooks/useProfile";

export function PositionCard({ position }: { position: PositionRecord }) {
  const { attributes } = position;
  const pctClaimed =
    attributes.allocation > 0n
      ? Number((attributes.claimedSoFar * 10000n) / attributes.allocation) / 100
      : 0;

  const canTransfer =
    !position.transferredAway &&
    !position.isFrozen &&
    position.campaign.account.isTransferable &&
    attributes.claimedSoFar < attributes.allocation;

  return (
    <PositionCardBody
      position={position}
      pctClaimed={pctClaimed}
      canTransfer={canTransfer}
    />
  );
}

function PositionCardBody({
  position,
  pctClaimed,
  canTransfer,
}: {
  position: PositionRecord;
  pctClaimed: number;
  canTransfer: boolean;
}) {
  const { campaign, attributes } = position;
  const [recipient, setRecipient] = useState("");
  const [showTransferForm, setShowTransferForm] = useState(false);
  const { transfer, isSending, signature, error } =
    useTransferPosition(position);

  const handleTransfer = () => {
    void transfer(recipient).then((sig) => {
      if (sig) {
        setRecipient("");
        setShowTransferForm(false);
      }
    });
  };

  const closeTransferForm = () => {
    setShowTransferForm(false);
    setRecipient("");
  };

  const fullyClaimed = attributes.claimedSoFar >= attributes.allocation;
  const statusNote = position.isFrozen
    ? fullyClaimed
      ? "Loyalty badge — frozen on-chain."
      : "Position NFT is frozen — transfers paused."
    : position.fullyVested && !fullyClaimed
      ? "Fully vested — freezes permanently after your final claim."
      : null;

  return (
    <EntityCard size="sm">
      <EntityCardHeader
        title="Vesting position"
        description={
          <>
            Asset{" "}
            <TruncatedExplorerLink
              address={String(position.asset)}
              className="font-mono"
            />
          </>
        }
        action={
          position.isFrozen ? (
            <Badge className="bg-zinc-500/20 text-zinc-400">Frozen</Badge>
          ) : (
            <Badge className={CAMPAIGN_STATUS_COLORS[position.campaignStatus]}>
              {CAMPAIGN_STATUS_LABELS[position.campaignStatus]}
            </Badge>
          )
        }
      />

      <EntityCardContent className="space-y-3">
        {position.transferredAway && (
          <p className="text-xs text-amber-200/90">
            You minted this position but no longer hold the NFT.
          </p>
        )}

        {!position.isOriginalRecipient && !position.transferredAway && (
          <p className="text-xs text-sky-200/90">
            You hold this position NFT — received by transfer.
          </p>
        )}

        <EntityCardMeta
          rows={[
            {
              label: "Allocation",
              value: (
                <span className="font-mono">
                  {formatTokens(Number(attributes.allocation))}
                </span>
              ),
            },
            {
              label: "Claimed",
              value: (
                <span className="font-mono">
                  {formatTokens(Number(attributes.claimedSoFar))} (
                  {pctClaimed.toFixed(1)}%)
                </span>
              ),
            },
            {
              label: "Claimable now",
              value: (
                <span className="font-mono text-emerald-300">
                  {formatTokens(position.claimable)}
                </span>
              ),
            },
            {
              label: "Holder",
              value:
                position.isOriginalRecipient && !position.transferredAway ? (
                  "You"
                ) : (
                  <TruncatedExplorerLink address={String(position.owner)} />
                ),
            },
            {
              label: "Campaign",
              value: (
                <TruncatedExplorerLink address={String(campaign.address)} />
              ),
              fullWidth: true,
            },
          ]}
        />

        {statusNote && (
          <p className="text-xs text-amber-200/90">{statusNote}</p>
        )}

        {canTransfer && showTransferForm && (
          <AppCard variant="inset" padding="sm" className="gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Transfer position
              </p>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={isSending}
                onClick={closeTransferForm}
              >
                Cancel
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Send the position NFT to another wallet. The recipient can claim
              vested tokens while they hold the NFT.
            </p>
            <Input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Recipient wallet address"
              className="font-mono text-xs"
            />
            {error && <p className="text-xs text-red-200">{error}</p>}
            {signature && (
              <p className="flex flex-wrap items-center gap-2 text-xs text-emerald-300">
                <span>Transfer confirmed</span>
                <TruncatedTxLink signature={signature} head={10} tail={10} />
              </p>
            )}
            <Button
              type="button"
              size="sm"
              disabled={isSending || !recipient.trim()}
              onClick={handleTransfer}
            >
              {isSending ? "Confirm in wallet…" : "Transfer NFT"}
            </Button>
          </AppCard>
        )}
      </EntityCardContent>

      <EntityCardFooter className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="xs" className="h-auto px-0">
          <Link to={appCampaignUrl(String(campaign.address))}>
            Claim in app →
          </Link>
        </Button>
        {canTransfer && !showTransferForm && (
          <Button
            type="button"
            variant="link"
            size="xs"
            className="h-auto p-0 text-xs"
            onClick={() => setShowTransferForm(true)}
          >
            Transfer
          </Button>
        )}
      </EntityCardFooter>
    </EntityCard>
  );
}
