import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "border-transparent hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "border-transparent text-primary underline-offset-4 hover:underline",
        upcoming: "border-zinc-400/25 bg-zinc-500/15 text-zinc-300",
        active: "border-emerald-400/25 bg-emerald-500/15 text-emerald-300",
        grace: "border-amber-400/25 bg-amber-500/15 text-amber-300",
        closed: "border-red-400/25 bg-red-500/15 text-red-300",
        transferred: "border-amber-400/25 bg-amber-500/15 text-amber-300",
        frozen: "border-cyan-400/25 bg-cyan-400/15 text-cyan-200",
        received: "border-sky-400/25 bg-sky-500/15 text-sky-300",
        "claimed-full":
          "border-emerald-400/25 bg-emerald-500/15 text-emerald-300",
        "claimed-partial": "border-sky-400/25 bg-sky-500/15 text-sky-300",
        "claimed-empty": "border-zinc-400/25 bg-zinc-500/15 text-zinc-400",
        airdrop: "border-violet-400/25 bg-violet-500/15 text-violet-300",
        vesting: "border-indigo-400/25 bg-indigo-500/15 text-indigo-300",
        transferable: "border-sky-400/25 bg-sky-500/15 text-sky-300",
        "non-transferable":
          "border-zinc-400/25 bg-zinc-500/15 text-zinc-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
