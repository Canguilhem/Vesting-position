import { QueryClientProvider } from "@tanstack/react-query";
import { SolanaProvider } from "@solana/react-hooks";
import { PropsWithChildren, useState } from "react";
import { autoDiscover, createClient } from "@solana/client";
import { RPC_ENDPOINT } from "./config";
import { createQueryClient } from "./lib/query-client";
import { QueryDevtools } from "./QueryDevtools";
import { Toaster } from "./components/ui/sonner";

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
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <SolanaProvider client={client}>{children}</SolanaProvider>
      <Toaster />
      <QueryDevtools />
    </QueryClientProvider>
  );
}
