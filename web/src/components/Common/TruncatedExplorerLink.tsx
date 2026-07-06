import { explorerAddressUrl } from "../../config";
import { truncate } from "../../lib/utils";
import { CopyButton } from "./CopyButton";
import { ExplorerLinkButton } from "./ExplorerLinkButton";

type Props = {
  address: string;
  head?: number;
  tail?: number;
  /** Stop click from bubbling (e.g. inside a selectable card button). */
  stopPropagation?: boolean;
  className?: string;
};

export function TruncatedExplorerLink({
  address,
  head = 8,
  tail = 8,
  stopPropagation = false,
  className = "",
}: Props) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="font-mono" title={address}>
        {truncate(address, head, tail)}
      </span>
      <CopyButton value={address} stopPropagation={stopPropagation} />
      <ExplorerLinkButton
        href={explorerAddressUrl(address)}
        stopPropagation={stopPropagation}
        label="View on explorer"
      />
    </span>
  );
}
