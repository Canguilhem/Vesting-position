import { PageSlice } from "../../lib/pagination";
import { Button } from "@/components/ui/button";
import { AppCard } from "./AppCard";

export { CopyButton } from "./CopyButton";
export { ExplorerLinkButton } from "./ExplorerLinkButton";
export { TruncatedExplorerLink } from "./TruncatedExplorerLink";
export { TruncatedTxLink } from "./TruncatedTxLink";
export { CopyIcon, ExternalLinkIcon, iconActionClass } from "./icons";
export { AppCard, AppCardButton, AppCallout } from "./AppCard";
export {
  EntityCard,
  EntityCardButton,
  EntityCardContent,
  EntityCardFooter,
  EntityCardHeader,
  EntityCardMeta,
} from "./EntityCard";
export { PageHeader, SectionHeader } from "./PageHeader";
export { GradientOutlineBadge } from "./GradientOutlineBadge";

export function EmptyState({ message }: { message: string }) {
  return (
    <AppCard variant="dashed" padding="lg" className="items-center justify-center">
      {message}
    </AppCard>
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
      <p className="text-xs text-muted-foreground">
        {label}: page {slice.page + 1} of {slice.totalPages} ({slice.total}{" "}
        total)
      </p>
      {slice.totalPages > 1 && (
        <div className="flex gap-2">
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={!slice.hasPrev}
            onClick={() => onPageChange(slice.page - 1)}
          >
            Previous
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={!slice.hasNext}
            onClick={() => onPageChange(slice.page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export function navLinkClass(isActive: boolean): string {
  return isActive
    ? "text-foreground"
    : "text-muted-foreground transition hover:text-foreground";
}
