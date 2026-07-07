import { toast } from "sonner";
import { explorerTxUrl } from "../config";
import { truncate } from "./utils";

export type TransactionToastOptions = {
  successMessage?: string;
  errorMessage?: string;
  /** When set, caller shows success toast after extra post-tx work (e.g. polling). */
  skipSuccessToast?: boolean;
};

export function toastTransactionSuccess(
  signature: string,
  message = "Transaction confirmed",
  description?: string,
) {
  toast.success(message, {
    description: description ?? truncate(signature, 8, 8),
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
