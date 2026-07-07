import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CLAIM_PROGRESS_BADGE_VARIANT,
  CLAIM_PROGRESS_BAR_STYLES,
  claimProgressTone,
  formatPctClaimedLabel,
} from "../lib/claim-progress";

type ClaimProgressBadgeProps = {
  pct: number;
  className?: string;
  compact?: boolean;
};

export function ClaimProgressBadge({
  pct,
  className,
  compact = false,
}: ClaimProgressBadgeProps) {
  const tone = claimProgressTone(pct);
  return (
    <Badge
      variant={CLAIM_PROGRESS_BADGE_VARIANT[tone]}
      className={className}
    >
      {compact
        ? `${pct >= 100 ? "100" : pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`
        : formatPctClaimedLabel(pct)}
    </Badge>
  );
}

export function ClaimProgressBar({
  pct,
  className,
}: {
  pct: number;
  className?: string;
}) {
  const tone = claimProgressTone(pct);
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-border-low/80",
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.min(100, Math.max(0, pct))}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500",
          CLAIM_PROGRESS_BAR_STYLES[tone],
        )}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

type ClaimProgressHeaderProps = {
  pct: number;
  label?: string;
  caption?: string;
  frozen?: boolean;
};

export function ClaimProgressHeader({
  pct,
  label = "Your position",
  caption,
  frozen = false,
}: ClaimProgressHeaderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="flex items-center gap-1.5">
          {frozen && <Badge variant="frozen">Frozen</Badge>}
          <ClaimProgressBadge pct={pct} />
        </div>
      </div>
      <ClaimProgressBar pct={pct} />
      {caption && (
        <p className="text-xs text-muted-foreground">{caption}</p>
      )}
    </div>
  );
}
