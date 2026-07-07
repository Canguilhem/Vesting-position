import { PageSlice } from "../../lib/pagination";

export { CopyButton } from "./CopyButton";
export { ExplorerLinkButton } from "./ExplorerLinkButton";
export { TruncatedExplorerLink } from "./TruncatedExplorerLink";
export { TruncatedTxLink } from "./TruncatedTxLink";
export { CopyIcon, ExternalLinkIcon, iconActionClass } from "./icons";

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border-low px-4 py-8 text-center text-sm text-muted">
      {message}
    </div>
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

export function navLinkClass(isActive: boolean): string {
  return isActive
    ? "text-foreground"
    : "text-muted transition hover:text-foreground";
}
