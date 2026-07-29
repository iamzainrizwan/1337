import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-none border px-2 py-0.5 text-[11px] font-mono font-medium w-fit whitespace-nowrap gap-1",
  {
    variants: {
      variant: {
        default: "border-border bg-bg-alt text-fg-dim",
        easy: "border-blue/40 bg-blue/10 text-blue-bright",
        medium: "border-purple/40 bg-purple/10 text-purple-bright",
        hard: "border-red-bright/40 bg-red-bright/10 text-red-bright",
        mastered: "border-blue-bright/40 bg-blue-bright/10 text-blue-bright",
        reviewing: "border-red/40 bg-red/10 text-red-bright",
        overdue: "border-red-bright/50 bg-red-bright/15 text-red-bright animate-pulse",
        not_started: "border-border bg-transparent text-fg-dim",
        outline: "border-border text-fg",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
