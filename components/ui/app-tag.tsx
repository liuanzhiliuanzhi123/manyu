import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const appTagVariants = cva(
  "inline-flex items-center gap-1 rounded-[999px] border px-2.5 py-1 text-[10px] font-medium tracking-[0.02em]",
  {
    variants: {
      tone: {
        neutral: "border-transparent bg-[var(--app-surface-muted)] text-[var(--app-text-secondary)]",
        brand: "border-transparent bg-[var(--app-brand-soft)] text-[var(--app-brand)]",
        warm: "border-transparent bg-[color:rgba(184,161,102,0.16)] text-[var(--app-gold)]",
        info: "border-transparent bg-[color:rgba(122,138,98,0.16)] text-[var(--app-info)]",
        success: "border-transparent bg-[color:rgba(109,135,80,0.16)] text-[var(--app-success)]",
        warning: "border-transparent bg-[color:rgba(180,139,78,0.16)] text-[var(--app-warning)]",
        error: "border-transparent bg-[color:rgba(184,90,77,0.15)] text-[var(--app-error)]",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
)

function AppTag({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof appTagVariants>) {
  return <span className={cn(appTagVariants({ tone, className }))} {...props} />
}

export { AppTag, appTagVariants }
