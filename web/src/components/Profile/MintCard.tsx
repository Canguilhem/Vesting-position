import { ProfileMint } from "../../hooks/useProfile";
import { formatTokens } from "../../lib/vesting";
import {
  EntityCard,
  EntityCardContent,
  EntityCardHeader,
  EntityCardMeta,
  TruncatedExplorerLink,
} from "../Common/Common";
import { Badge } from "@/components/ui/badge";

export function MintCard({ mint }: { mint: ProfileMint }) {
  return (
    <EntityCard size="sm">
      <EntityCardHeader
        title={mint.label ?? "Distribution token"}
        description={
          <TruncatedExplorerLink address={String(mint.mint)} className="font-mono" />
        }
        action={
          <Badge variant="secondary" className="shrink-0">
            {mint.source === "local" ? "Created here" : "On-chain only"}
          </Badge>
        }
      />
      <EntityCardContent>
        <EntityCardMeta
          rows={[
            {
              label: "Supply",
              value: (
                <span className="font-mono">
                  {mint.supply > 0n ? formatTokens(Number(mint.supply)) : "—"}
                </span>
              ),
            },
            {
              label: "Your balance",
              value: (
                <span className="font-mono">
                  {formatTokens(Number(mint.walletBalance))}
                </span>
              ),
            },
            {
              label: "Decimals",
              value: <span className="font-mono">{mint.decimals}</span>,
            },
            {
              label: "Campaigns",
              value: <span className="font-mono">{mint.campaignsUsingMint}</span>,
            },
          ]}
        />
      </EntityCardContent>
    </EntityCard>
  );
}
