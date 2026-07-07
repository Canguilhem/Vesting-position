import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * App card variants — use instead of ad-hoc rounded-xl border classes.
 *
 * - surface: default list / grid cards
 * - panel: primary detail panels (claim, calculator results)
 * - section: grouped form / wizard blocks
 * - muted: softer emphasis (timelines, summaries)
 * - inset: nested blocks inside a panel
 * - tile: compact grid tiles
 * - elevated: solid card surface (marketing sections)
 * - dashed: empty / placeholder states
 * - success | warning | error: status callouts
 * - selected: interactive selected state (or use AppCardButton)
 */
export const appCardVariants = cva("flex flex-col border text-sm", {
  variants: {
    variant: {
      surface: "rounded-xl border-border-low bg-card/50",
      panel: "rounded-xl border-border-low bg-background/60",
      section: "rounded-xl border-border-low bg-card/30",
      muted: "rounded-xl border-border-low bg-card/40",
      inset: "rounded-lg border-border-low bg-card/40",
      tile: "rounded-lg border-border-low bg-background/50",
      elevated: "rounded-xl border-border-low bg-card",
      dashed:
        "rounded-xl border-dashed border-border-low bg-transparent text-center text-muted-foreground",
      success:
        "rounded-lg border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
      warning:
        "rounded-lg border-amber-500/30 bg-amber-500/10 text-amber-200",
      error: "rounded-lg border-red-500/30 bg-red-500/10 text-red-200",
      selected: "rounded-xl border-accent/50 bg-accent/10",
    },
    padding: {
      none: "",
      sm: "p-3",
      md: "p-4",
      lg: "p-5",
      xl: "p-6",
    },
  },
  defaultVariants: {
    variant: "surface",
    padding: "md",
  },
});

export type AppCardVariant = NonNullable<
  VariantProps<typeof appCardVariants>["variant"]
>;

type AppCardProps = React.ComponentProps<"div"> &
  VariantProps<typeof appCardVariants>;

export function AppCard({
  className,
  variant,
  padding,
  ...props
}: AppCardProps) {
  return (
    <div
      className={cn(appCardVariants({ variant, padding }), className)}
      {...props}
    />
  );
}

type AppCardButtonProps = React.ComponentProps<"button"> & {
  selected?: boolean;
  padding?: VariantProps<typeof appCardVariants>["padding"];
};

export function AppCardButton({
  className,
  selected = false,
  padding = "md",
  ...props
}: AppCardButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        appCardVariants({
          variant: selected ? "selected" : "surface",
          padding,
        }),
        "w-full text-left transition cursor-pointer hover:border-accent/30 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}

type AppCalloutProps = React.ComponentProps<"div"> & {
  tone: "success" | "warning" | "error";
};

export function AppCallout({ tone, className, ...props }: AppCalloutProps) {
  return (
    <AppCard
      variant={tone}
      padding="sm"
      className={cn("text-sm", className)}
      {...props}
    />
  );
}
