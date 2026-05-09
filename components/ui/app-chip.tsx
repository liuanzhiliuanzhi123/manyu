import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const appChipVariants = cva(
  "inline-flex items-center justify-center rounded-[9999px] border px-3.5 py-1.5 text-xs font-medium transition-colors",
  {
    variants: {
      selected: {
        true: "border-[var(--app-brand)] bg-[var(--app-brand-soft)] text-[var(--brand-deep)]",
        false: "border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text-secondary)] hover:border-[var(--app-line-strong)]",
      },
      compact: {
        true: "px-2.5 py-1 text-[11px]",
        false: "",
      },
    },
    defaultVariants: {
      selected: false,
      compact: false,
    },
  }
)

function AppChip({
  className,
  selected,
  compact,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof appChipVariants>) {
  return <button className={cn(appChipVariants({ selected, compact, className }))} {...props} />
}

export { AppChip, appChipVariants }
