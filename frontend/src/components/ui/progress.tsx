import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  indicatorClassName,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-border/60 relative h-2 w-full overflow-hidden rounded-none",
        className
      )}
      {...props}
    >
      <motion.div
        className={cn("h-full rounded-none bg-red", indicatorClassName)}
        initial={{ width: 0 }}
        animate={{ width: `${value ?? 0}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
