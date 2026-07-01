import { useBalance, useWalletConnection } from "@solana/react-hooks";

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
        <span className="hidden rounded-lg border border-border-low bg-card/80 px-3 py-1.5 font-mono text-xs text-muted sm:inline">
          {fetching ? "…" : solBalance != null ? `${solBalance} SOL` : "—"}
        </span>
        <span className="rounded-lg border border-border-low bg-card/80 px-3 py-1.5 font-mono text-xs">
          {truncateAddress(address)}
        </span>
        <button
          type="button"
          onClick={() => disconnect()}
          className="rounded-lg border border-border-low bg-card px-3 py-1.5 text-sm font-medium transition hover:border-accent/40 hover:bg-accent/10 cursor-pointer"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {connectors.slice(0, 3).map((connector) => (
        <button
          key={connector.id}
          type="button"
          onClick={() => connect(connector.id)}
          disabled={status === "connecting"}
          className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
        >
          {status === "connecting" ? "Connecting…" : connector.name}
        </button>
      ))}
    </div>
  );
}
