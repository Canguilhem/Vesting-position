import { useState, type ReactNode } from "react";
import { useWalletConnection } from "@solana/react-hooks";
import type { CampaignRecord } from "../../hooks/useCampaigns";
import { useCampaignAdmin } from "../../hooks/useCampaignAdmin";
import { formatCampaignTimestamp } from "../../lib/campaign-status";

type Props = {
  record: CampaignRecord;
  /** Omit outer title when nested under Profile campaign cards. */
  embedded?: boolean;
};

function AdminActionGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border-low bg-card/30 px-3 py-3 space-y-2">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function CampaignAdminPanel({ record, embedded = false }: Props) {
  const { wallet, status } = useWalletConnection();
  const { run, isSending, signature, explorerTxUrl, error } =
    useCampaignAdmin(record);

  const [assetAddress, setAssetAddress] = useState("");
  const [originalRecipient, setOriginalRecipient] = useState("");

  const isCreator =
    status === "connected" &&
    wallet?.account.address != null &&
    String(record.account.creator) === String(wallet.account.address);

  if (!isCreator) return null;

  const disabled = isSending;
  const btnClass =
    "rounded-md border border-border-low px-3 py-1.5 text-xs font-medium transition hover:border-accent/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

  const runAction = (action: Parameters<typeof run>[0]): void => {
    void run(action);
  };

  return (
    <div
      className={
        embedded
          ? "space-y-3 border-t border-border-low pt-3"
          : "space-y-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5"
      }
    >
      {!embedded && (
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Campaign admin</h3>
          <p className="text-sm text-muted">
            Creator-only instructions for this campaign. Claim window ends{" "}
            {formatCampaignTimestamp(
              record.account.end + record.account.gracePeriod,
            )}
            .
          </p>
        </div>
      )}

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

      <div className="space-y-3">
        <AdminActionGroup
          title="Freeze collection"
          description="Freeze or unfreeze the mpl-core collection (loyalty badges after vesting)."
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              className={btnClass}
              onClick={() => void runAction({ type: "freezeCollection", shouldFreeze: true })}
            >
              Freeze collection
            </button>
            <button
              type="button"
              disabled={disabled}
              className={btnClass}
              onClick={() => void runAction({ type: "freezeCollection", shouldFreeze: false })}
            >
              Unfreeze collection
            </button>
          </div>
        </AdminActionGroup>

        <AdminActionGroup
          title="Freeze position NFT"
          description="Freeze or unfreeze a specific position asset."
        >
          <input
            type="text"
            value={assetAddress}
            onChange={(e) => setAssetAddress(e.target.value)}
            placeholder="Position asset address"
            className="w-full rounded-md border border-border-low bg-background px-3 py-2 font-mono text-xs"
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
        </AdminActionGroup>

        <AdminActionGroup
          title="Exclude live position"
          description="Burn a position NFT and return unclaimed tokens to you (during the campaign)."
        >
          <input
            type="text"
            value={assetAddress}
            onChange={(e) => setAssetAddress(e.target.value)}
            placeholder="Position asset address"
            className="w-full rounded-md border border-border-low bg-background px-3 py-2 font-mono text-xs"
          />
          <button
            type="button"
            disabled={disabled || !assetAddress.trim()}
            className={btnClass}
            onClick={() =>
              void runAction({ type: "excludeAsset", asset: assetAddress })
            }
          >
            Exclude asset
          </button>
        </AdminActionGroup>

        <AdminActionGroup
          title="Clawback live position"
          description="After the grace period, burn a position and recover remaining unclaimed tokens."
        >
          <input
            type="text"
            value={assetAddress}
            onChange={(e) => setAssetAddress(e.target.value)}
            placeholder="Position asset address"
            className="w-full rounded-md border border-border-low bg-background px-3 py-2 font-mono text-xs"
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
        </AdminActionGroup>

        <AdminActionGroup
          title="Clawback unclaimed allocation"
          description="Recover tokens for an allowlisted recipient who never claimed (uses bundled merkle proofs)."
        >
          <input
            type="text"
            value={originalRecipient}
            onChange={(e) => setOriginalRecipient(e.target.value)}
            placeholder="Original recipient wallet"
            className="w-full rounded-md border border-border-low bg-background px-3 py-2 font-mono text-xs"
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
        </AdminActionGroup>

        <AdminActionGroup
          title="Cancel campaign"
          description="Mistake safeguard — only works while no position has been minted."
        >
          <button
            type="button"
            disabled={disabled}
            className={`${btnClass} border-red-500/40 text-red-200 hover:border-red-400/60`}
            onClick={() => void runAction({ type: "cancelCampaign" })}
          >
            Cancel campaign
          </button>
        </AdminActionGroup>

        <AdminActionGroup
          title="Close campaign"
          description="Close the campaign PDA and vault after all tokens are claimed or clawed back."
        >
          <button
            type="button"
            disabled={disabled}
            className={btnClass}
            onClick={() => void runAction({ type: "closeCampaign" })}
          >
            Close campaign
          </button>
        </AdminActionGroup>
      </div>
    </div>
  );
}
