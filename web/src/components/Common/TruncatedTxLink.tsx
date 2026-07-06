import { explorerTxUrl } from "../../config";
import { truncate } from "../../lib/utils";
import { CopyButton } from "./CopyButton";
import { ExplorerLinkButton } from "./ExplorerLinkButton";

type Props = {
  signature: string;
  head?: number;
  tail?: number;
  stopPropagation?: boolean;
  className?: string;
};

export function TruncatedTxLink({
  signature,
  head = 8,
  tail = 8,
  stopPropagation = false,
  className = "",
}: Props) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="font-mono" title={signature}>
        {truncate(signature, head, tail)}
      </span>
      <CopyButton
        value={signature}
        stopPropagation={stopPropagation}
        label="Copy transaction signature"
      />
      <ExplorerLinkButton
        href={explorerTxUrl(signature)}
        stopPropagation={stopPropagation}
        label="View transaction on explorer"
      />
    </span>
  );
}
