import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const appInputVariants = cva(
  "w-full rounded-[var(--app-radius-sm)] border text-[0.88rem] text-[var(--app-text-primary)] transition-[border-color,background-color,box-shadow,color] duration-200 placeholder:text-[var(--app-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-brand)]/18",
  {
    variants: {
      tone: {
        default: "border-[var(--app-line)] bg-[var(--app-surface-elevated)]",
        subtle: "border-[var(--app-line)] bg-[var(--app-surface)]",
      },
      density: {
        md: "h-[2.72rem] px-3.5",
        lg: "h-[2.95rem] px-4",
      },
    },
    defaultVariants: {
      tone: "default",
      density: "md",
    },
  }
)

const AppInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & VariantProps<typeof appInputVariants>
>(({ className, tone, density, ...props }, ref) => {
  return <input ref={ref} className={cn(appInputVariants({ tone, density, className }))} {...props} />
})
AppInput.displayName = "AppInput"

export { AppInput, appInputVariants }
