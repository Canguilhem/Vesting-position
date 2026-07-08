import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type GradientOutlineBadgeProps = {
  children: ReactNode;
  /** Tailwind gradient stops, e.g. `from-primary to-chart-2` */
  gradient?: string;
  className?: string;
};

export function GradientOutlineBadge({
  children,
  gradient = "from-primary via-chart-2 to-chart-4",
  className,
}: GradientOutlineBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md bg-gradient-to-r p-px shadow-[0_0_12px_-4px_var(--accent-glow)]",
        gradient,
        className
      )}
    >
      <span className="inline-flex items-center rounded-[calc(var(--radius-md)-1px)] bg-background/70 px-2.5 py-1 text-xs font-medium backdrop-blur-sm">
        <span className={cn("bg-gradient-to-r bg-clip-text ", gradient)}>
          {children}
        </span>
      </span>
    </span>
  );
}
