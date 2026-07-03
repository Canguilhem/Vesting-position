import { useState } from "react";
import { useWalletConnection } from "@solana/react-hooks";
import type { CampaignRecord } from "../../hooks/useCampaigns";
import { useCampaignAdmin } from "../../hooks/useCampaignAdmin";

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

const inputClass =
  "w-full rounded-md border border-border-low bg-background px-3 py-2 font-mono text-xs";

export function CampaignAdminPanel({ record }: Props) {
  const { wallet, status } = useWalletConnection();
  const { run, isSending, signature, explorerTxUrl, error } =
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
  const btnClass =
    "rounded-md border border-border-low px-3 py-1.5 text-xs font-medium transition hover:border-accent/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

  const runAction = (action: Parameters<typeof run>[0]): void => {
    void run(action);
  };

  return (
    <div className="space-y-3 border-t border-border-low pt-3">
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {signature && explorerTxUrl && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm space-y-1">
          <p className="font-medium text-emerald-200">Transaction confirmed</p>
          <a
            href={explorerTxUrl}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            View on Explorer
          </a>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <nav
          className="flex shrink-0 flex-row flex-wrap gap-1 sm:w-40 sm:flex-col"
          aria-label="Admin instructions"
        >
          {ADMIN_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => setSelectedId(action.id)}
              className={`rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition cursor-pointer ${
                selectedId === action.id
                  ? "bg-accent/20 text-accent"
                  : "text-muted hover:bg-card/60 hover:text-foreground"
              } ${action.destructive && selectedId !== action.id ? "text-red-300/80" : ""}`}
            >
              {action.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 rounded-lg border border-border-low bg-card/30 px-3 py-3">
          {!selected ? (
            <p className="text-xs text-muted">
              Choose an instruction to see details and submit.
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">{selected.label}</p>
                <p className="mt-1 text-xs text-muted">
                  {selected.description}
                </p>
              </div>

              {selected.id === "freezeCollection" && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={disabled}
                    className={btnClass}
                    onClick={() =>
                      void runAction({
                        type: "freezeCollection",
                        shouldFreeze: true,
                      })
                    }
                  >
                    Freeze
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    className={btnClass}
                    onClick={() =>
                      void runAction({
                        type: "freezeCollection",
                        shouldFreeze: false,
                      })
                    }
                  >
                    Unfreeze
                  </button>
                </div>
              )}

              {selected.id === "freezeAsset" && (
                <>
                  <input
                    type="text"
                    value={assetAddress}
                    onChange={(e) => setAssetAddress(e.target.value)}
                    placeholder="Position asset address"
                    className={inputClass}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={disabled || !assetAddress.trim()}
                      className={btnClass}
                      onClick={() =>
                        void runAction({
                          type: "freezeAsset",
                          asset: assetAddress,
                          shouldFreeze: true,
                        })
                      }
                    >
                      Freeze asset
                    </button>
                    <button
                      type="button"
                      disabled={disabled || !assetAddress.trim()}
                      className={btnClass}
                      onClick={() =>
                        void runAction({
                          type: "freezeAsset",
                          asset: assetAddress,
                          shouldFreeze: false,
                        })
                      }
                    >
                      Unfreeze asset
                    </button>
                  </div>
                </>
              )}

              {selected.id === "excludeAsset" && (
                <>
                  <input
                    type="text"
                    value={assetAddress}
                    onChange={(e) => setAssetAddress(e.target.value)}
                    placeholder="Position asset address"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    disabled={disabled || !assetAddress.trim()}
                    className={btnClass}
                    onClick={() =>
                      void runAction({
                        type: "excludeAsset",
                        asset: assetAddress,
                      })
                    }
                  >
                    Exclude asset
                  </button>
                </>
              )}

              {selected.id === "clawback" && (
                <>
                  <input
                    type="text"
                    value={assetAddress}
                    onChange={(e) => setAssetAddress(e.target.value)}
                    placeholder="Position asset address"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    disabled={disabled || !assetAddress.trim()}
                    className={btnClass}
                    onClick={() =>
                      void runAction({ type: "clawback", asset: assetAddress })
                    }
                  >
                    Clawback position
                  </button>
                </>
              )}

              {selected.id === "clawbackUnclaimed" && (
                <>
                  <input
                    type="text"
                    value={originalRecipient}
                    onChange={(e) => setOriginalRecipient(e.target.value)}
                    placeholder="Original recipient wallet"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    disabled={disabled || !originalRecipient.trim()}
                    className={btnClass}
                    onClick={() =>
                      void runAction({
                        type: "clawbackUnclaimed",
                        originalRecipient,
                      })
                    }
                  >
                    Clawback unclaimed
                  </button>
                </>
              )}

              {selected.id === "cancelCampaign" && (
                <button
                  type="button"
                  disabled={disabled}
                  className={`${btnClass} border-red-500/40 text-red-200 hover:border-red-400/60`}
                  onClick={() => void runAction({ type: "cancelCampaign" })}
                >
                  Cancel campaign
                </button>
              )}

              {selected.id === "closeCampaign" && (
                <button
                  type="button"
                  disabled={disabled}
                  className={btnClass}
                  onClick={() => void runAction({ type: "closeCampaign" })}
                >
                  Close campaign
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
