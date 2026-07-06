import { Link } from "react-router-dom";
import { useTransferPosition } from "../../hooks/useTransferPosition";
import { useState } from "react";
import {
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
} from "../../lib/campaign-status";
import { TruncatedExplorerLink, TruncatedTxLink } from "../Common/Common";
import { formatTokens } from "../../lib/vesting";
import { PositionRecord } from "../../hooks/useProfile";

export function PositionCard({ position }: { position: PositionRecord }) {
  const { campaign, attributes } = position;
  const pctClaimed =
    attributes.allocation > 0n
      ? Number((attributes.claimedSoFar * 10000n) / attributes.allocation) / 100
      : 0;

  const canTransfer =
    !position.transferredAway &&
    campaign.account.isTransferable &&
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
  const { transfer, isSending, signature, error } =
    useTransferPosition(position);

  const handleTransfer = () => {
    void transfer(recipient).then((sig) => {
      if (sig) setRecipient("");
    });
  };

  return (
    <article className="rounded-xl border border-border-low bg-background/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">Vesting position</p>
          <p className="font-mono text-xs text-muted mt-0.5">
            Asset <TruncatedExplorerLink address={String(position.asset)} />
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${CAMPAIGN_STATUS_COLORS[position.campaignStatus]}`}
        >
          {CAMPAIGN_STATUS_LABELS[position.campaignStatus]}
        </span>
      </div>

      {position.transferredAway && (
        <p className="text-xs text-amber-200/90">
          You minted this position but no longer hold the NFT.
        </p>
      )}

      {!position.isOriginalRecipient && !position.transferredAway && (
        <p className="text-xs text-sky-200/90">
          You hold this position NFT - received by transfer.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-2 text-xs text-muted">
        <div>
          <dt>Allocation</dt>
          <dd className="font-mono text-foreground">
            {formatTokens(Number(attributes.allocation))}
          </dd>
        </div>
        <div>
          <dt>Claimed</dt>
          <dd className="font-mono text-foreground">
            {formatTokens(Number(attributes.claimedSoFar))} (
            {pctClaimed.toFixed(1)}%)
          </dd>
        </div>
        <div>
          <dt>Claimable now</dt>
          <dd className="font-mono text-emerald-300">
            {formatTokens(position.claimable)}
          </dd>
        </div>
        <div>
          <dt>Holder</dt>
          <dd className="text-foreground">
            {position.isOriginalRecipient && !position.transferredAway ? (
              "You"
            ) : (
              <TruncatedExplorerLink address={String(position.owner)} />
            )}
          </dd>
        </div>
        <div className="col-span-2">
          <dt>Campaign</dt>
          <dd className="text-[10px] text-foreground/90">
            <TruncatedExplorerLink address={String(campaign.address)} />
          </dd>
        </div>
      </dl>

      {position.fullyVested && (
        <p className="text-xs text-amber-200/90">
          Fully vested — position may be frozen as a loyalty badge.
        </p>
      )}

      {canTransfer && (
        <div className="rounded-lg border border-border-low bg-card/40 px-3 py-3 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Transfer position
          </p>
          <p className="text-xs text-muted">
            Send the position NFT to another wallet. The recipient can claim
            vested tokens while they hold the NFT.
          </p>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Recipient wallet address"
            className="w-full rounded-md border border-border-low bg-background px-3 py-2 font-mono text-xs"
          />
          {error && <p className="text-xs text-red-200">{error}</p>}
          {signature && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-emerald-300">
              <span>Transfer confirmed</span>
              <TruncatedTxLink signature={signature} head={10} tail={10} />
            </p>
          )}
          <button
            type="button"
            onClick={handleTransfer}
            disabled={isSending || !recipient.trim()}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg transition hover:brightness-110 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {isSending ? "Confirm in wallet…" : "Transfer NFT"}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link
          to="/app"
          className="text-xs text-muted hover:text-foreground transition"
        >
          Claim in app →
        </Link>
      </div>
    </article>
  );
}
