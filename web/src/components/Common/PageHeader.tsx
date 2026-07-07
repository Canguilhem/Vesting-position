import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const titleClasses = {
  h1: "text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl",
  h2: "text-2xl font-semibold tracking-tight",
  h3: "text-lg font-semibold",
} as const;

type PageHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  titleAs?: keyof typeof titleClasses;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  titleAs = "h2",
  className,
}: PageHeaderProps) {
  const TitleTag = titleAs;

  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        className,
      )}
    >
      <div className="max-w-3xl space-y-2">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {eyebrow}
          </p>
        )}
        <TitleTag className={titleClasses[titleAs]}>{title}</TitleTag>
        {description && (
          <div className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {description}
          </div>
        )}
      </div>
      {actions}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <PageHeader
      title={title}
      description={description}
      titleAs="h3"
      className={cn("block", className)}
    />
  );
}
