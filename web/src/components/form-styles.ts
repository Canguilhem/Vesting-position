// TODO: refactor forms to have their own components

export function fieldClassName(): string {
  return "w-full rounded-lg border border-border-low bg-background/60 px-3 py-2 text-sm outline-none transition focus:border-accent/40";
}

export function labelClassName(): string {
  return "block space-y-1.5 text-sm";
}
