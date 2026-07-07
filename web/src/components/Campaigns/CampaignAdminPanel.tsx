import { useState } from "react";
import { useWalletConnection } from "@solana/react-hooks";
import type { CampaignRecord } from "../../hooks/useCampaigns";
import { useCampaignAdmin } from "../../hooks/useCampaignAdmin";
import { TruncatedTxLink } from "../Common/Common";
import { AppCard, AppCallout } from "../Common/AppCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  record: CampaignRecord;
};

type AdminActionId =
  | "freezeCollection"
  | "freezeAsset"
  | "excludeAsset"
  | "clawback"
  | "clawbackUnclaimed"
  | "cancelCampaign"
  | "closeCampaign";

const ADMIN_ACTIONS: {
  id: AdminActionId;
  label: string;
  description: string;
  destructive?: boolean;
}[] = [
  {
    id: "freezeCollection",
    label: "Freeze collection",
    description:
      "Freeze or unfreeze the mpl-core collection (loyalty badges after vesting).",
  },
  {
    id: "freezeAsset",
    label: "Freeze position NFT",
    description: "Freeze or unfreeze a specific position asset.",
  },
  {
    id: "excludeAsset",
    label: "Exclude live position",
    description:
      "Burn a position NFT and return unclaimed tokens to you (during the campaign).",
  },
  {
    id: "clawback",
    label: "Clawback live position",
    description:
      "After the grace period, burn a position and recover remaining unclaimed tokens.",
  },
  {
    id: "clawbackUnclaimed",
    label: "Clawback unclaimed",
    description:
      "Recover tokens for an allowlisted recipient who never claimed (uses bundled merkle proofs).",
  },
  {
    id: "cancelCampaign",
    label: "Cancel campaign",
    description:
      "Mistake safeguard — only works while no position has been minted.",
    destructive: true,
  },
  {
    id: "closeCampaign",
    label: "Close campaign",
    description:
      "Close the campaign PDA and vault after all tokens are claimed or clawed back.",
  },
];

export function CampaignAdminPanel({ record }: Props) {
  const { wallet, status } = useWalletConnection();
  const { run, isSending, signature, error } =
    useCampaignAdmin(record);

  const [selectedId, setSelectedId] = useState<AdminActionId | "">("");
  const [assetAddress, setAssetAddress] = useState("");
  const [originalRecipient, setOriginalRecipient] = useState("");

  const isCreator =
    status === "connected" &&
    wallet?.account.address != null &&
    String(record.account.creator) === String(wallet.account.address);

  if (!isCreator) return null;

  const selected = ADMIN_ACTIONS.find((a) => a.id === selectedId);
  const disabled = isSending;

  const runAction = (action: Parameters<typeof run>[0]): void => {
    void run(action);
  };

  return (
    <div className="space-y-3">
      {error && <AppCallout tone="error">{error}</AppCallout>}

      {signature && (
        <AppCallout tone="success" className="space-y-1">
          <p className="font-medium">Transaction confirmed</p>
          <TruncatedTxLink signature={signature} head={10} tail={10} />
        </AppCallout>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <nav
          className="flex shrink-0 flex-row flex-wrap gap-1 sm:w-40 sm:flex-col"
          aria-label="Admin instructions"
        >
          {ADMIN_ACTIONS.map((action) => (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant={selectedId === action.id ? "secondary" : "ghost"}
              className={`justify-start text-left ${
                action.destructive && selectedId !== action.id
                  ? "text-red-300/80"
                  : ""
              }`}
              onClick={() => setSelectedId(action.id)}
            >
              {action.label}
            </Button>
          ))}
        </nav>

        <AppCard variant="inset" padding="sm" className="min-w-0 flex-1">
          {!selected ? (
            <p className="text-xs text-muted-foreground">
              Choose an instruction to see details and submit.
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">{selected.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selected.description}
                </p>
              </div>

              {selected.id === "freezeCollection" && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    onClick={() =>
                      void runAction({
                        type: "freezeCollection",
                        shouldFreeze: true,
                      })
                    }
                  >
                    Freeze
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    onClick={() =>
                      void runAction({
                        type: "freezeCollection",
                        shouldFreeze: false,
                      })
                    }
                  >
                    Unfreeze
                  </Button>
                </div>
              )}

              {selected.id === "freezeAsset" && (
                <>
                  <Input
                    type="text"
                    value={assetAddress}
                    onChange={(e) => setAssetAddress(e.target.value)}
                    placeholder="Position asset address"
                    className="font-mono text-xs"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={disabled || !assetAddress.trim()}
                      onClick={() =>
                        void runAction({
                          type: "freezeAsset",
                          asset: assetAddress,
                          shouldFreeze: true,
                        })
                      }
                    >
                      Freeze asset
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={disabled || !assetAddress.trim()}
                      onClick={() =>
                        void runAction({
                          type: "freezeAsset",
                          asset: assetAddress,
                          shouldFreeze: false,
                        })
                      }
                    >
                      Unfreeze asset
                    </Button>
                  </div>
                </>
              )}

              {selected.id === "excludeAsset" && (
                <>
                  <Input
                    type="text"
                    value={assetAddress}
                    onChange={(e) => setAssetAddress(e.target.value)}
                    placeholder="Position asset address"
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled || !assetAddress.trim()}
                    onClick={() =>
                      void runAction({
                        type: "excludeAsset",
                        asset: assetAddress,
                      })
                    }
                  >
                    Exclude asset
                  </Button>
                </>
              )}

              {selected.id === "clawback" && (
                <>
                  <Input
                    type="text"
                    value={assetAddress}
                    onChange={(e) => setAssetAddress(e.target.value)}
                    placeholder="Position asset address"
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled || !assetAddress.trim()}
                    onClick={() =>
                      void runAction({ type: "clawback", asset: assetAddress })
                    }
                  >
                    Clawback position
                  </Button>
                </>
              )}

              {selected.id === "clawbackUnclaimed" && (
                <>
                  <Input
                    type="text"
                    value={originalRecipient}
                    onChange={(e) => setOriginalRecipient(e.target.value)}
                    placeholder="Original recipient wallet"
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled || !originalRecipient.trim()}
                    onClick={() =>
                      void runAction({
                        type: "clawbackUnclaimed",
                        originalRecipient,
                      })
                    }
                  >
                    Clawback unclaimed
                  </Button>
                </>
              )}

              {selected.id === "cancelCampaign" && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={disabled}
                  onClick={() => void runAction({ type: "cancelCampaign" })}
                >
                  Cancel campaign
                </Button>
              )}

              {selected.id === "closeCampaign" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => void runAction({ type: "closeCampaign" })}
                >
                  Close campaign
                </Button>
              )}
            </div>
          )}
        </AppCard>
      </div>
    </div>
  );
}
