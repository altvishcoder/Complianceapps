import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "whitespace-nowrap inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-sm",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-sm",
        outline: 
          "text-foreground border-border bg-background",
        success:
          "border-transparent bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm",
        warning:
          "border-transparent bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm",
        info:
          "border-transparent bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
