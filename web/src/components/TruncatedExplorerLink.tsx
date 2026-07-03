import { explorerAddressUrl } from "../config";
import { truncate } from "../lib/utils";

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
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="font-mono" title={address}>
        {truncate(address, head, tail)}
      </span>
      <a
        href={explorerAddressUrl(address)}
        target="_blank"
        rel="noreferrer"
        onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
        className="shrink-0 rounded-md border border-border-low px-1.5 py-0.5 text-[10px] text-muted transition hover:border-accent/40 hover:text-accent"
      >
        Explorer
      </a>
    </span>
  );
}
