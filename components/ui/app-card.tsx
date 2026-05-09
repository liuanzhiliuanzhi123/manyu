import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const appCardVariants = cva(
  "rounded-[var(--app-radius-lg)] border transition-[border-color,background-color,box-shadow,transform] duration-200",
  {
    variants: {
      tone: {
        default: "border-[var(--app-line)] bg-[var(--app-surface-elevated)]",
        soft: "border-[var(--app-line)] bg-[var(--app-surface)]",
        elevated:
          "border-[color:rgba(230,232,221,0.95)] bg-[var(--app-surface-elevated)] shadow-[var(--app-shadow-soft)]",
        outline: "border-[var(--app-line)] bg-transparent",
      },
      padding: {
        none: "p-0",
        sm: "p-3.5",
        md: "p-4",
        lg: "p-5",
      },
      interactive: {
        true: "card-hover hover:border-[var(--app-line-strong)]",
        false: "",
      },
    },
    defaultVariants: {
      tone: "default",
      padding: "md",
      interactive: false,
    },
  }
)

function AppCard({
  className,
  tone,
  padding,
  interactive,
  ...props
}: React.ComponentProps<"section"> & VariantProps<typeof appCardVariants>) {
  return (
    <section className={cn(appCardVariants({ tone, padding, interactive, className }))} {...props} />
  )
}

export { AppCard, appCardVariants }
