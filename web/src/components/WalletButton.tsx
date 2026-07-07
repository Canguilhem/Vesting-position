import { useBalance, useWalletConnection } from "@solana/react-hooks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function WalletButton() {
  const { connectors, connect, disconnect, wallet, status } =
    useWalletConnection();

  const address = wallet?.account.address.toString();
  const { lamports, fetching } = useBalance(address, { skip: !address });

  const solBalance =
    lamports != null ? (Number(lamports) / 1e9).toFixed(4) : null;

  if (status === "connected" && address) {
    return (
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="hidden font-mono sm:inline-flex"
        >
          {fetching ? "…" : solBalance != null ? `${solBalance} SOL` : "—"}
        </Badge>
        <Badge variant="secondary" className="font-mono">
          {truncateAddress(address)}
        </Badge>
        <Button type="button" variant="outline" size="sm" onClick={() => disconnect()}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {connectors.slice(0, 3).map((connector) => (
        <Button
          key={connector.id}
          type="button"
          variant="secondary"
          onClick={() => connect(connector.id)}
          disabled={status === "connecting"}
        >
          {status === "connecting" ? "Connecting…" : connector.name}
        </Button>
      ))}
    </div>
  );
}
