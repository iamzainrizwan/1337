import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-red/50 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-red text-fg-bright shadow-[0_0_0_1px_rgba(204,34,34,0.5)] hover:bg-red-bright hover:shadow-[0_0_20px_-4px_rgba(255,68,68,0.65)]",
        destructive:
          "bg-red-bright text-fg-bright hover:brightness-110",
        outline:
          "border border-border bg-transparent text-fg hover:bg-bg-alt hover:border-red/60 hover:text-fg-bright",
        secondary:
          "bg-bg-alt text-fg border border-border hover:bg-border/60",
        ghost: "text-fg-dim hover:bg-bg-alt hover:text-fg-bright",
        link: "text-blue-bright underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2 has-[>svg]:px-3",
        sm: "h-9 rounded-md px-3 has-[>svg]:px-2.5 text-xs",
        lg: "h-12 rounded-md px-6 text-base has-[>svg]:px-5",
        icon: "size-11 shrink-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
