import { SolanaProvider } from "@solana/react-hooks";
import { PropsWithChildren } from "react";
import { autoDiscover, createClient } from "@solana/client";
import { RPC_ENDPOINT } from "./config";

const websocketEndpoint = RPC_ENDPOINT.replace("https://", "wss://").replace(
  "http://",
  "ws://",
);

const client = createClient({
  endpoint: RPC_ENDPOINT,
  websocketEndpoint,
  walletConnectors: autoDiscover(),
});

export function Providers({ children }: PropsWithChildren) {
  return <SolanaProvider client={client}>{children}</SolanaProvider>;
}
