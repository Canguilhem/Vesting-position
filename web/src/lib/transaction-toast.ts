import { toast } from "sonner";
import { explorerTxUrl } from "../config";
import { truncate } from "./utils";

export type TransactionToastOptions = {
  successMessage?: string;
  errorMessage?: string;
};

export function toastTransactionSuccess(
  signature: string,
  message = "Transaction confirmed",
) {
  toast.success(message, {
    description: truncate(signature, 8, 8),
    action: {
      label: "Explorer",
      onClick: () => window.open(explorerTxUrl(signature), "_blank", "noopener"),
    },
  });
}

export function toastTransactionError(
  error: unknown,
  message = "Transaction failed",
) {
  const description =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Something went wrong. Try again.";

  toast.error(message, { description });
}
