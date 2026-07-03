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
                className={`hidden h-px w-6 sm:block ${done || active ? "bg-accent/40" : "bg-border-low"}`}
                aria-hidden
              />
            )}
            <button
              type="button"
              disabled={!reachable || active}
              onClick={() => onGoTo(id)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition cursor-pointer disabled:cursor-default ${
                active
                  ? "border-accent/50 bg-accent/15 text-accent"
                  : done
                    ? "border-accent/25 text-accent hover:bg-accent/10"
                    : reachable
                      ? "border-border-low text-muted hover:border-accent/25 hover:text-foreground"
                      : "border-border-low text-muted/50"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  active
                    ? "bg-accent text-accent-fg"
                    : done
                      ? "bg-accent/30 text-accent"
                      : "bg-border-low text-muted"
                }`}
              >
                {id}
              </span>
              {label}
            </button>
          </div>
        );
      })}
    </nav>
  );
}
