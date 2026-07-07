import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Token" },
  { id: 2, label: "Allowlist" },
  { id: 3, label: "Settings" },
] as const;

export function LaunchStepIndicator({
  current,
  maxReached,
  onGoTo,
}: {
  current: 1 | 2 | 3;
  maxReached: 1 | 2 | 3;
  onGoTo: (step: 1 | 2 | 3) => void;
}) {
  return (
    <nav aria-label="Launch progress" className="flex flex-wrap items-center gap-2">
      {STEPS.map(({ id, label }, index) => {
        const done = id < current;
        const active = id === current;
        const reachable = id <= maxReached;
        return (
          <div key={id} className="flex items-center gap-2">
            {index > 0 && (
              <span
                className={cn(
                  "hidden h-px w-6 sm:block",
                  done || active ? "bg-accent/40" : "bg-border-low",
                )}
                aria-hidden
              />
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!reachable || active}
              onClick={() => onGoTo(id)}
              className={cn(
                "gap-2 rounded-full",
                active &&
                  "border-accent/50 bg-accent/15 text-accent hover:bg-accent/15",
                done &&
                  "border-accent/25 text-accent hover:bg-accent/10",
                !reachable && "text-muted-foreground/50",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                  active
                    ? "bg-accent text-accent-fg"
                    : done
                      ? "bg-accent/30 text-accent"
                      : "bg-border-low text-muted-foreground",
                )}
              >
                {id}
              </span>
              {label}
            </Button>
          </div>
        );
      })}
    </nav>
  );
}
