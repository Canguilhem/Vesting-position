import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TruncatedExplorerLink } from "../Common/Common";
import { formatTokens } from "../../lib/vesting";
import type { ProfileMint } from "../../hooks/useProfile";

type Props = {
  mints: ProfileMint[];
};

export function MintDataTable({ mints }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-border-low">
      <Table>
        <TableHeader>
          <TableRow className="border-border-low bg-card/40 hover:bg-card/40">
            <TableHead>Token</TableHead>
            <TableHead className="text-right">Supply</TableHead>
            <TableHead className="text-right">Your balance</TableHead>
            <TableHead className="text-right">Decimals</TableHead>
            <TableHead className="text-right">Campaigns</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mints.map((mint) => (
            <TableRow key={String(mint.mint)}>
              <TableCell>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-xs font-medium text-foreground">
                      {mint.label ?? "Distribution token"}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {mint.source === "local" ? "Created here" : "On-chain"}
                    </Badge>
                  </div>
                  <TruncatedExplorerLink address={String(mint.mint)} />
                </div>
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                {mint.supply > 0n ? formatTokens(Number(mint.supply)) : "—"}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {formatTokens(Number(mint.walletBalance))}
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                {mint.decimals}
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                {mint.campaignsUsingMint}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
