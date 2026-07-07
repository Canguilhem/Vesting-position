import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_VARIANT,
} from "../../lib/campaign-status";
import { getCampaignDisplayName } from "../../lib/campaign-display";
import { computePctClaimed } from "../../lib/claim-progress";
import { canClaimPosition } from "../../lib/profile-positions";
import { appCampaignUrl } from "../../lib/app-routes";
import { formatTokens } from "../../lib/vesting";
import { useTransferPosition } from "../../hooks/useTransferPosition";
import type { PositionRecord } from "../../hooks/useProfile";
import { ClaimProgressBar } from "../ClaimProgress";
import { cn } from "@/lib/utils";

type Props = {
  positions: PositionRecord[];
};

function PositionStatusBadge({ position }: { position: PositionRecord }) {
  if (position.transferredAway) {
    return (
      <Badge variant="transferred" className="text-[10px]">
        Transferred
      </Badge>
    );
  }
  if (position.isFrozen) {
    return (
      <Badge variant="frozen" className="text-[10px]">
        Frozen
      </Badge>
    );
  }
  if (!position.isOriginalRecipient) {
    return (
      <Badge variant="received" className="text-[10px]">
        Received
      </Badge>
    );
  }
  return (
    <Badge
      variant={CAMPAIGN_STATUS_VARIANT[position.campaignStatus]}
      className="text-[10px]"
    >
      {CAMPAIGN_STATUS_LABELS[position.campaignStatus]}
    </Badge>
  );
}

function PositionTransferDialog({
  position,
  open,
  onOpenChange,
}: {
  position: PositionRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [recipient, setRecipient] = useState("");
  const { transfer, isSending, error } = useTransferPosition(position);

  const handleTransfer = () => {
    void transfer(recipient).then((sig) => {
      if (sig) {
        setRecipient("");
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer position NFT</DialogTitle>
          <DialogDescription>
            Send the position NFT to another wallet. The recipient can claim
            vested tokens while they hold the NFT.
          </DialogDescription>
        </DialogHeader>
        <Input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="Recipient wallet address"
          className="font-mono text-xs"
        />
        {error && <p className="text-xs text-red-200">{error}</p>}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={isSending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSending || !recipient.trim()}
            onClick={handleTransfer}
          >
            {isSending ? "Confirm in wallet…" : "Transfer NFT"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PositionActions({ position }: { position: PositionRecord }) {
  const [transferOpen, setTransferOpen] = useState(false);
  const { attributes } = position;
  const claimable = canClaimPosition(position);
  const canTransfer =
    !position.transferredAway &&
    !position.isFrozen &&
    position.campaign.account.isTransferable &&
    attributes.claimedSoFar < attributes.allocation;

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {claimable ? (
          <Button asChild variant="outline" size="xs">
            <Link to={appCampaignUrl(String(position.campaign.address))}>
              Claim
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="xs" disabled>
            Claim
          </Button>
        )}
        {canTransfer && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setTransferOpen(true)}
          >
            Transfer
          </Button>
        )}
      </div>
      {canTransfer && (
        <PositionTransferDialog
          position={position}
          open={transferOpen}
          onOpenChange={setTransferOpen}
        />
      )}
    </>
  );
}

function PositionDataRow({ position }: { position: PositionRecord }) {
  const { attributes } = position;
  const pctClaimed = computePctClaimed(
    attributes.claimedSoFar,
    attributes.allocation,
  );
  const fullyClaimed = attributes.claimedSoFar >= attributes.allocation;
  const showClaimable =
    !position.transferredAway && !fullyClaimed && position.claimable > 0;

  return (
    <TableRow>
      <TableCell>
        <div className="min-w-0 max-w-[14rem]">
          <Link
            to={appCampaignUrl(String(position.campaign.address))}
            className="block truncate text-xs font-medium text-foreground hover:text-primary"
            title={getCampaignDisplayName(position.campaign)}
          >
            {getCampaignDisplayName(position.campaign)}
          </Link>
        </div>
      </TableCell>
      <TableCell>
        <PositionStatusBadge position={position} />
      </TableCell>
      <TableCell className="min-w-[5rem]">
        <ClaimProgressBar pct={pctClaimed} />
      </TableCell>
      <TableCell className="text-right font-mono text-xs">
        {formatTokens(Number(attributes.allocation))}
      </TableCell>
      <TableCell className="text-right font-mono text-xs text-muted-foreground">
        {formatTokens(Number(attributes.claimedSoFar))}
        <span className="text-muted-foreground/80">
          {" "}
          ({pctClaimed.toFixed(1)}%)
        </span>
      </TableCell>
      <TableCell
        className={cn(
          "text-right font-mono text-xs",
          showClaimable ? "text-emerald-300" : "text-muted-foreground",
        )}
        title={
          position.transferredAway
            ? "Claim rights follow the current NFT holder"
            : undefined
        }
      >
        {position.transferredAway || fullyClaimed
          ? "—"
          : formatTokens(position.claimable)}
      </TableCell>
      <TableCell className="text-right">
        <PositionActions position={position} />
      </TableCell>
    </TableRow>
  );
}

export function PositionDataTable({ positions }: Props) {
  if (positions.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-border-low">
      <Table>
        <TableHeader>
          <TableRow className="border-border-low bg-card/40 hover:bg-card/40">
            <TableHead>Campaign</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead className="text-right">Allocation</TableHead>
            <TableHead className="text-right">Claimed</TableHead>
            <TableHead className="text-right">Claimable</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((position) => (
            <PositionDataRow
              key={String(position.asset)}
              position={position}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
