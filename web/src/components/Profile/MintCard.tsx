import { ProfileMint } from "../../hooks/useProfile";
import { formatTokens } from "../../lib/vesting";
import { TruncatedExplorerLink } from "../Common/Common";

export function MintCard({ mint }: { mint: ProfileMint }) {
  return (
    <article className="rounded-xl border border-border-low bg-background/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{mint.label ?? "Distribution token"}</p>
          <p className="font-mono text-xs text-muted mt-0.5">
            <TruncatedExplorerLink address={String(mint.mint)} />
          </p>
        </div>
        <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
          {mint.source === "local" ? "Created here" : "On-chain only"}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs text-muted">
        <div>
          <dt>Supply</dt>
          <dd className="font-mono text-foreground">
            {mint.supply > 0n ? formatTokens(Number(mint.supply)) : "—"}
          </dd>
        </div>
        <div>
          <dt>Your balance</dt>
          <dd className="font-mono text-foreground">
            {formatTokens(Number(mint.walletBalance))}
          </dd>
        </div>
        <div>
          <dt>Decimals</dt>
          <dd className="font-mono text-foreground">{mint.decimals}</dd>
        </div>
        <div>
          <dt>Campaigns</dt>
          <dd className="font-mono text-foreground">
            {mint.campaignsUsingMint}
          </dd>
        </div>
      </dl>
    </article>
  );
}
