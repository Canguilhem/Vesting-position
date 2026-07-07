import type { ReactNode } from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type EntityCardProps = React.ComponentProps<typeof Card>;

export function EntityCard({ className, ...props }: EntityCardProps) {
  return (
    <Card
      className={cn("border-border-low ring-foreground/10", className)}
      {...props}
    />
  );
}

export function EntityCardHeader({
  title,
  description,
  action,
  badges,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  badges?: ReactNode;
  className?: string;
}) {
  return (
    <CardHeader className={className}>
      {badges}
      <CardTitle className="text-base font-semibold">{title}</CardTitle>
      {description && <CardDescription>{description}</CardDescription>}
      {action && <CardAction>{action}</CardAction>}
    </CardHeader>
  );
}

export function EntityCardContent({
  className,
  ...props
}: React.ComponentProps<typeof CardContent>) {
  return <CardContent className={cn("pt-0", className)} {...props} />;
}

export function EntityCardFooter({
  className,
  ...props
}: React.ComponentProps<typeof CardFooter>) {
  return (
    <CardFooter
      className={cn("border-border-low bg-card/40", className)}
      {...props}
    />
  );
}

type MetaRow = {
  label: ReactNode;
  value: ReactNode;
  className?: string;
  fullWidth?: boolean;
};

export function EntityCardMeta({
  rows,
  columns = 2,
  className,
}: {
  rows: MetaRow[];
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-3 gap-y-2 text-xs text-muted-foreground",
        columns === 2 ? "grid-cols-2" : "grid-cols-1",
        className,
      )}
    >
      {rows.map((row, index) => (
        <div
          key={index}
          className={cn(row.fullWidth && "col-span-full", row.className)}
        >
          <dt>{row.label}</dt>
          <dd className="mt-0.5 text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

type EntityCardButtonProps = React.ComponentProps<"button"> & {
  selected?: boolean;
  size?: EntityCardProps["size"];
};

export function EntityCardButton({
  selected = false,
  size = "default",
  className,
  children,
  ...props
}: EntityCardButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "group w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    >
      <Card
        size={size}
        className={cn(
          "border-border-low ring-foreground/10 transition",
          "group-hover:ring-accent/30",
          selected && "border-accent/50 bg-accent/10 ring-accent/40",
        )}
      >
        {children}
      </Card>
    </button>
  );
}
