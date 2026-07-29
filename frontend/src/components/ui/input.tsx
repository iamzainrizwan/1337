import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 rounded-md border border-border bg-bg-alt px-3 py-2 text-sm text-fg placeholder:text-fg-dim transition-colors outline-none focus-visible:border-red focus-visible:ring-2 focus-visible:ring-red/30 disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
