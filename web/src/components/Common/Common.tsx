import { explorerAddressUrl } from "../../config";
import { PageSlice } from "../../lib/pagination";
import { truncate } from "../../lib/utils";

export function CopyButton({ value }: { value: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(value)}
      className="rounded-md border border-border-low px-2 py-0.5 text-xs text-muted transition hover:border-accent/40 hover:text-foreground cursor-pointer"
    >
      Copy
    </button>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border-low px-4 py-8 text-center text-sm text-muted">
      {message}
    </div>
  );
}

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

export function ListPager<T>({
  slice,
  onPageChange,
  label,
}: {
  slice: PageSlice<T> | null;
  onPageChange: (page: number) => void;
  label: string;
}) {
  if (!slice || slice.total === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
      <p className="text-xs text-muted">
        {label}: page {slice.page + 1} of {slice.totalPages} ({slice.total}{" "}
        total)
      </p>
      {slice.totalPages > 1 && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!slice.hasPrev}
            onClick={() => onPageChange(slice.page - 1)}
            className="rounded-md border border-border-low px-2.5 py-1 text-xs transition hover:border-accent/30 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={!slice.hasNext}
            onClick={() => onPageChange(slice.page + 1)}
            className="rounded-md border border-border-low px-2.5 py-1 text-xs transition hover:border-accent/30 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
